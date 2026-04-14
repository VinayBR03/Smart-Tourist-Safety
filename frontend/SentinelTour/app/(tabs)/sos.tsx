import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, ScrollView, Alert, Image,
  ActivityIndicator, Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withRepeat, withTiming, withSpring, withSequence, Easing,
  FadeInDown, FadeIn, cancelAnimation,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Icon } from '@/components/ui/Icons';
import { Badge } from '@/components/ui/Badge';
import { incidentsApi } from '@/api/incidents';
import { mediaApi } from '@/api/media';
import { Typography, Spacing, Radius } from '@/constants/theme';
import { useThemedStyles } from '@/utils/themedStyles';

const HOLD_MS       = 3000;
const LIGHT_PATTERN = Array.from({ length: 30 }, () => 100);

type SOSState = 'idle' | 'holding' | 'confirmed' | 'sent' | 'error';
interface MediaItem { uri: string; type: 'image' | 'video'; fileName: string; }

// ─── Animated SOS button ──────────────────────────────────
function SOSButton({ state, onPressIn, onPressOut }: { state: SOSState; onPressIn: () => void; onPressOut: () => void }) {
  const outerScale   = useSharedValue(1);
  const outerOpacity = useSharedValue(0.35);
  const innerScale   = useSharedValue(1);
  const progressPct  = useSharedValue(0);

  useEffect(() => {
    if (state === 'idle') {
      outerScale.value   = withRepeat(withTiming(1.28, { duration: 1600, easing: Easing.inOut(Easing.ease) }), -1, true);
      outerOpacity.value = withRepeat(withTiming(0.08, { duration: 1600, easing: Easing.inOut(Easing.ease) }), -1, true);
      progressPct.value  = 0;
    } else if (state === 'holding') {
      cancelAnimation(outerScale); cancelAnimation(outerOpacity);
      outerScale.value   = withRepeat(withTiming(1.45, { duration: 350 }), -1, true);
      outerOpacity.value = withRepeat(withTiming(0.22, { duration: 350 }), -1, true);
      innerScale.value   = withSpring(0.91);
      progressPct.value  = withTiming(1, { duration: HOLD_MS, easing: Easing.linear });
    } else if (state === 'confirmed' || state === 'sent') {
      cancelAnimation(outerScale); cancelAnimation(outerOpacity);
      outerScale.value = withSpring(1); outerOpacity.value = withTiming(0);
      innerScale.value = withSpring(1); progressPct.value  = 1;
    } else {
      cancelAnimation(outerScale);
      progressPct.value = withSpring(0); innerScale.value = withSpring(1);
    }
  }, [state]);

  const outerStyle = useAnimatedStyle(() => ({ transform: [{ scale: outerScale.value }], opacity: outerOpacity.value }));
  const innerStyle = useAnimatedStyle(() => ({ transform: [{ scale: innerScale.value }] }));

  const SIZE = 180; const RADIUS = 80; const CIRC = 2 * Math.PI * RADIUS;
  const isConfirmed = state === 'confirmed' || state === 'sent';
  const btnColor    = isConfirmed ? '#10B981' : '#DC2626';

  return (
    <View style={styles.sosButtonOuter}>
      <Animated.View style={[styles.sosPulseRing, { borderColor: btnColor }, outerStyle]} />
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          <Circle cx={SIZE/2} cy={SIZE/2} r={RADIUS} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={5} />
          {(state === 'holding' || isConfirmed) && (
            <Circle cx={SIZE/2} cy={SIZE/2} r={RADIUS} fill="none"
              stroke={isConfirmed ? '#10B981' : '#DC2626'} strokeWidth={5} strokeLinecap="round"
              strokeDasharray={CIRC} strokeDashoffset={isConfirmed ? 0 : CIRC * 0.4}
              transform={`rotate(-90 ${SIZE/2} ${SIZE/2})`}
            />
          )}
        </Svg>
      </View>
      <Animated.View style={innerStyle}>
        <TouchableOpacity
          style={[styles.sosButton, { backgroundColor: btnColor }]}
          onPressIn={onPressIn} onPressOut={onPressOut} activeOpacity={1}
        >
          {isConfirmed
            ? <Icon.CheckCircle size={52} color="#fff" strokeWidth={2.5} />
            : <Icon.ShieldAlert  size={52} color="#fff" strokeWidth={2}   />
          }
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

function uploadViaXHR(fileUri: string, presignedUrl: string, contentType: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', presignedUrl);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.onreadystatechange = () => {
      if (xhr.readyState !== 4) return;
      xhr.status === 200 ? resolve() : reject(new Error(`S3 upload status: ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error('XHR network error'));
    xhr.send({ uri: fileUri, type: contentType, name: 'upload' } as any);
  });
}

// ─── Main screen ──────────────────────────────────────────
export default function SOSScreen() {
  const t = useThemedStyles();
  const queryClient = useQueryClient();

  const [sosState,        setSOSState]        = useState<SOSState>('idle');
  const [description,     setDescription]     = useState('');
  const [mediaItems,      setMediaItems]      = useState<MediaItem[]>([]);
  const [location,        setLocation]        = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const locationRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const holdTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { locationRef.current = location; }, [location]);

  useEffect(() => {
    let cancelled = false;
    const fetchLocation = async () => {
      setLocationLoading(true);
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') { setLocationLoading(false); return; }
        for (const accuracy of [Location.Accuracy.High, Location.Accuracy.Balanced, Location.Accuracy.Low]) {
          if (cancelled) return;
          try {
            const loc = await Location.getCurrentPositionAsync({ accuracy, timeInterval: 3000, mayShowUserSettingsDialog: true });
            if (!cancelled) {
              const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
              setLocation(coords); locationRef.current = coords; setLocationLoading(false); return;
            }
          } catch { /* try next */ }
        }
      } catch { /* ignore */ }
      try {
        const last = await Location.getLastKnownPositionAsync();
        if (last && !cancelled) {
          const coords = { latitude: last.coords.latitude, longitude: last.coords.longitude };
          setLocation(coords); locationRef.current = coords;
        }
      } catch { /* no last known */ }
      if (!cancelled) setLocationLoading(false);
    };
    fetchLocation();
    return () => { cancelled = true; Vibration.cancel(); if (holdTimer.current) clearTimeout(holdTimer.current); };
  }, []);

  const sosIncidentMutation = useMutation({
    mutationFn: async () => {
      let finalCoords = locationRef.current;
      if (!finalCoords) {
        try {
          const emergency = await Promise.race([
            Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
          ]) as Location.LocationObject;
          finalCoords = { latitude: emergency.coords.latitude, longitude: emergency.coords.longitude };
          setLocation(finalCoords); locationRef.current = finalCoords;
        } catch {
          finalCoords = { latitude: 0, longitude: 0 };
        }
      }
      const incident = await incidentsApi.create({
        description: description.trim() || 'SOS emergency triggered via mobile app',
        source: 'MOBILE', latitude: finalCoords.latitude, longitude: finalCoords.longitude,
        is_auto_generated: false,
      });
      await Promise.allSettled(mediaItems.map(async (item) => {
        const mediaType   = item.type === 'image' ? 'INCIDENT_EVIDENCE_PHOTO' : 'INCIDENT_EVIDENCE_VIDEO';
        const contentType = item.type === 'image' ? 'image/jpeg' : 'video/mp4';
        const uploadInfo  = await mediaApi.requestUpload({ media_type: mediaType as any, content_type: contentType, file_size_bytes: 2_000_000, incident_id: incident.id });
        await uploadViaXHR(item.uri, uploadInfo.upload_url, contentType);
        await mediaApi.confirmUpload(uploadInfo.s3_key, mediaType, incident.id);
      }));
      return incident;
    },
    onSuccess: () => {
      setSOSState('sent');
      queryClient.invalidateQueries({ queryKey: ['incidents', 'me'] });
    },
    onError: (err: any) => {
      const detail  = err?.response?.data?.detail;
      const message = Array.isArray(detail) ? detail.map((d: any) => d.msg).join('\n') : typeof detail === 'string' ? detail : err?.message ?? 'Unknown error';
      setSOSState('error'); Vibration.cancel();
      Alert.alert('SOS Failed', `Could not send emergency alert.\n\n${message}\n\nPlease call emergency services directly.`,
        [{ text: 'OK', onPress: () => setSOSState('idle') }]);
    },
  });

  const startHold = useCallback(() => {
    setSOSState('holding');
    Vibration.vibrate(LIGHT_PATTERN, true);
    holdTimer.current = setTimeout(() => {
      Vibration.cancel(); Vibration.vibrate(600);
      setSOSState('confirmed');
      setTimeout(() => sosIncidentMutation.mutate(), 700);
    }, HOLD_MS);
  }, [sosIncidentMutation]);

  const handlePressIn = useCallback(() => {
    if (sosState !== 'idle') return;
    if (locationLoading) {
      Alert.alert('Location Still Loading', 'Your location is still being acquired. Send SOS anyway?',
        [{ text: 'Cancel', style: 'cancel' }, { text: 'Send Anyway', style: 'destructive', onPress: () => startHold() }]);
      return;
    }
    startHold();
  }, [sosState, locationLoading, startHold]);

  const handlePressOut = useCallback(() => {
    if (sosState !== 'holding') return;
    Vibration.cancel();
    if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; }
    setSOSState('idle');
  }, [sosState]);

  const pickMedia = async (type: 'image' | 'video') => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission Required', 'Allow media access to attach evidence.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: type === 'image' ? ImagePicker.MediaTypeOptions.Images : ImagePicker.MediaTypeOptions.Videos,
      quality: 0.75, allowsMultipleSelection: false,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setMediaItems((prev) => [...prev, { uri: asset.uri, type, fileName: asset.fileName ?? `${type}-${Date.now()}.${type === 'image' ? 'jpg' : 'mp4'}` }]);
    }
  };

  const removeMedia = (uri: string) => setMediaItems((prev) => prev.filter((m) => m.uri !== uri));

  const handleReset = () => { setSOSState('idle'); setDescription(''); setMediaItems([]); Vibration.cancel(); };

  const isSent = sosState === 'sent';

  return (
    <View style={[styles.root, t.bg]}>
      <Header title="Emergency SOS" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {!isSent && (
          <Animated.View entering={FadeInDown.duration(400)} style={styles.instructionCard}>
            <Icon.Info size={18} color="#3B82F6" />
            <Text style={[styles.instructionText, t.textSecondary]}>
              {sosState === 'idle' ? 'Press and hold the button for 3 seconds to send an emergency alert.'
               : sosState === 'holding' ? 'Keep holding... Release to cancel.'
               : sosState === 'confirmed' ? 'Confirmed — sending alert...'
               : 'Submitting your SOS request...'}
            </Text>
          </Animated.View>
        )}

        {isSent && (
          <Animated.View entering={FadeIn.duration(600)} style={styles.sentCard}>
            <View style={styles.sentIconWrap}><Icon.CheckCircle size={48} color="#10B981" /></View>
            <Text style={styles.sentTitle}>Alert Sent</Text>
            <Text style={[styles.sentSub, t.textSecondary]}>Emergency responders have been notified. Stay calm and remain at your location.</Text>
            <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
              <Text style={styles.resetBtnText}>Done</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {!isSent && (
          <View style={styles.buttonArea}>
            <SOSButton state={sosState} onPressIn={handlePressIn} onPressOut={handlePressOut} />
            <Text style={[
              styles.stateLabel,
              { color: sosState === 'holding' ? '#EF4444' : sosState === 'confirmed' ? '#10B981' : t.C.textMuted },
            ]}>
              {sosState === 'idle' ? 'HOLD TO ACTIVATE' : sosState === 'holding' ? 'HOLD...' : sosState === 'confirmed' ? 'CONFIRMED' : 'SENDING...'}
            </Text>
          </View>
        )}

        {!isSent && (
          <View style={styles.locationRow}>
            <Icon.MapPin size={14} color={locationLoading ? '#F59E0B' : location ? '#10B981' : '#EF4444'} />
            <Text style={[styles.locationText, t.textMuted]}>
              {locationLoading ? 'Acquiring location...' : location ? `Location ready: ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}` : 'Location unavailable — SOS will still work'}
            </Text>
            {locationLoading && <ActivityIndicator size="small" color="#F59E0B" style={{ marginLeft: 6 }} />}
          </View>
        )}

        {!isSent && (
          <Animated.View entering={FadeInDown.duration(400).delay(160)} style={styles.section}>
            <Text style={[styles.sectionTitle, t.textPrimary]}>Describe Your Emergency</Text>
            <Text style={[styles.sectionSub, t.textMuted]}>Optional — helps responders prepare</Text>
            <View style={[styles.textAreaWrap, t.surface, t.border]}>
              <TextInput
                style={[styles.textArea, { color: t.C.textPrimary }]}
                value={description} onChangeText={setDescription}
                placeholder="e.g. Injured at trail near checkpoint 3..."
                placeholderTextColor={t.C.textMuted}
                multiline numberOfLines={4} autoCapitalize="sentences"
                maxLength={500} editable={sosState === 'idle'}
              />
              <Text style={[styles.charCount, t.textMuted]}>{description.length}/500</Text>
            </View>
          </Animated.View>
        )}

        {!isSent && (
          <Animated.View entering={FadeInDown.duration(400).delay(220)} style={styles.section}>
            <Text style={[styles.sectionTitle, t.textPrimary]}>Attach Evidence</Text>
            <Text style={[styles.sectionSub, t.textMuted]}>Photos or videos to assist responders</Text>
            <View style={styles.mediaActions}>
              <TouchableOpacity style={[styles.mediaActionBtn, t.surface, t.border]} onPress={() => pickMedia('image')} disabled={sosState !== 'idle'}>
                <Icon.Camera size={22} color={t.C.textSecondary} />
                <Text style={[styles.mediaActionText, t.textSecondary]}>Add Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.mediaActionBtn, t.surface, t.border]} onPress={() => pickMedia('video')} disabled={sosState !== 'idle'}>
                <Icon.Video size={22} color={t.C.textSecondary} />
                <Text style={[styles.mediaActionText, t.textSecondary]}>Add Video</Text>
              </TouchableOpacity>
            </View>
            {mediaItems.length > 0 && (
              <View style={styles.mediaGrid}>
                {mediaItems.map((item) => (
                  <View key={item.uri} style={styles.mediaThumb}>
                    <Image source={{ uri: item.uri }} style={styles.mediaImage} />
                    <View style={styles.mediaTypeBadge}>
                      {item.type === 'video' ? <Icon.Video size={10} color="#fff" /> : <Icon.Camera size={10} color="#fff" />}
                    </View>
                    <TouchableOpacity style={styles.mediaRemove} onPress={() => removeMedia(item.uri)}>
                      <Icon.X size={12} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </Animated.View>
        )}

        {!isSent && (
          <Animated.View entering={FadeInDown.duration(400).delay(280)} style={[styles.emergencyInfo, t.surface, t.border]}>
            <View style={styles.emergencyInfoHeader}>
              <Icon.Phone size={16} color={t.C.textSecondary} />
              <Text style={[styles.emergencyInfoTitle, t.textSecondary]}>Emergency Numbers</Text>
            </View>
            <View style={styles.emergencyNumbers}>
              {[
                { label: 'Police', number: '100' }, { label: 'Ambulance', number: '108' },
                { label: 'Fire', number: '101' },   { label: 'Disaster', number: '112' },
              ].map((e) => (
                <View key={e.label} style={styles.emergencyNumber}>
                  <Text style={[styles.emergencyNumberLabel, t.textMuted]}>{e.label}</Text>
                  <Text style={[styles.emergencyNumberValue, t.textPrimary]}>{e.number}</Text>
                </View>
              ))}
            </View>
          </Animated.View>
        )}

        <View style={{ height: Spacing['2xl'] }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:          { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.base, paddingBottom: Spacing['4xl'], alignItems: 'center' },
  instructionCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm,
    backgroundColor: 'rgba(59,130,246,0.08)', borderRadius: Radius.lg,
    borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)',
    padding: Spacing.md, marginTop: Spacing.base, width: '100%',
  },
  instructionText: { flex: 1, fontSize: Typography.sm, fontFamily: 'Inter_400Regular', lineHeight: 20 },
  sentCard: {
    width: '100%', alignItems: 'center', gap: Spacing.md,
    backgroundColor: 'rgba(16,185,129,0.06)', borderRadius: Radius['2xl'],
    borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)',
    padding: Spacing['2xl'], marginTop: Spacing.lg,
  },
  sentIconWrap: { width: 88, height: 88, borderRadius: 44, backgroundColor: 'rgba(16,185,129,0.1)', alignItems: 'center', justifyContent: 'center' },
  sentTitle:    { fontSize: Typography['2xl'], fontFamily: 'SpaceGrotesk_700Bold', color: '#10B981' },
  sentSub:      { fontSize: Typography.sm, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 22 },
  resetBtn:     { backgroundColor: '#10B981', borderRadius: Radius.lg, paddingHorizontal: Spacing['2xl'], paddingVertical: Spacing.sm, marginTop: Spacing.sm },
  resetBtnText: { color: '#fff', fontSize: Typography.md, fontFamily: 'SpaceGrotesk_600SemiBold' },
  buttonArea:   { alignItems: 'center', paddingVertical: Spacing['2xl'], width: '100%' },
  sosButtonOuter: { width: 180, height: 180, alignItems: 'center', justifyContent: 'center' },
  sosPulseRing:   { position: 'absolute', width: 180, height: 180, borderRadius: 90, borderWidth: 2 },
  sosButton:      { width: 140, height: 140, borderRadius: 70, alignItems: 'center', justifyContent: 'center', shadowColor: '#DC2626', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.55, shadowRadius: 24, elevation: 16 },
  stateLabel:     { marginTop: Spacing.lg, fontSize: Typography.sm, fontFamily: 'SpaceGrotesk_700Bold', letterSpacing: 2.5, textTransform: 'uppercase' },
  locationRow:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.base },
  locationText:   { fontSize: Typography.xs, fontFamily: 'Inter_400Regular' },
  section:        { width: '100%', gap: Spacing.sm, marginBottom: Spacing.base },
  sectionTitle:   { fontSize: Typography.md, fontFamily: 'SpaceGrotesk_700Bold' },
  sectionSub:     { fontSize: Typography.xs, fontFamily: 'Inter_400Regular', marginTop: -4 },
  textAreaWrap:   { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.md },
  textArea:       { fontFamily: 'Inter_400Regular', fontSize: Typography.sm, textAlignVertical: 'top', minHeight: 96 },
  charCount:      { fontSize: Typography.xs, fontFamily: 'Inter_400Regular', textAlign: 'right', marginTop: 4 },
  mediaActions:   { flexDirection: 'row', gap: Spacing.sm },
  mediaActionBtn: { flex: 1, height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, borderRadius: Radius.lg, borderWidth: 1.5, borderStyle: 'dashed' },
  mediaActionText:{ fontSize: Typography.sm, fontFamily: 'Inter_500Medium' },
  mediaGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  mediaThumb:     { width: 80, height: 80, borderRadius: Radius.md, overflow: 'hidden', position: 'relative' },
  mediaImage:     { width: '100%', height: '100%' },
  mediaTypeBadge: { position: 'absolute', bottom: 4, left: 4, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 4, padding: 3 },
  mediaRemove:    { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 8, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  emergencyInfo:  { width: '100%', borderRadius: Radius.xl, borderWidth: 1, padding: Spacing.md, gap: Spacing.md },
  emergencyInfoHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  emergencyInfoTitle:  { fontSize: Typography.sm, fontFamily: 'SpaceGrotesk_600SemiBold' },
  emergencyNumbers:    { flexDirection: 'row', justifyContent: 'space-between' },
  emergencyNumber:     { alignItems: 'center', gap: 4 },
  emergencyNumberLabel:{ fontSize: Typography.xs, fontFamily: 'Inter_400Regular' },
  emergencyNumberValue:{ fontSize: Typography.lg, fontFamily: 'SpaceGrotesk_700Bold' },
});
