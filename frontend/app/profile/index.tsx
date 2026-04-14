import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Image,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icons';
import { authApi } from '@/api/auth';
import { mediaApi } from '@/api/media';
import { useAuthStore } from '@/store/authStore';
import { Colors, Typography, Spacing, Radius } from '@/constants/theme';
import { format } from 'date-fns';
import type { User, UserLanguage } from '@/types/api';
import { useThemedStyles } from '@/utils/themedStyles';
import { useColors } from '@/context/ThemeContext'

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-', 'Unknown'];
const GENDERS      = ['Male', 'Female', 'Other', 'Prefer not to say'];

function SectionLabel({ title }: { title: string }) {
  const C = useColors();
  return <Text style={[styles.sectionLabel, { color: C.textMuted }]}>{title}</Text>;
}

function InfoRow({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  const C = useColors();
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>{icon}</View>
      <View style={styles.infoContent}>
        <Text style={[styles.infoLabel, { color: C.textMuted }]}>{label}</Text>
        <Text style={[styles.infoValue, { color: C.textPrimary }]} numberOfLines={2}>{value || '—'}</Text>
      </View>
    </View>
  );
}

function EditableField({
  label, value, onChangeText, placeholder, keyboardType, multiline, icon,
}: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; keyboardType?: any; multiline?: boolean; icon: React.ReactNode;
}) {
  const C = useColors();
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: C.textSecondary }]}>{label}</Text>
      <View style={[styles.fieldInput, { borderColor: C.textSecondary }]}>{label}</View>
      <View style={[styles.fieldInput,{ borderColor: C.border, backgroundColor: C.surfaceAlt }, multiline && { height: 88, alignItems: 'flex-start', paddingTop: Spacing.sm }]}>
        <View style={styles.fieldIcon}>{icon}</View>
        <TextInput
          style={[styles.fieldText, multiline && styles.fieldTextMulti]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder ?? label}
          placeholderTextColor={Colors.textMuted}
          keyboardType={keyboardType}
          multiline={multiline}
          numberOfLines={multiline ? 3 : 1}
          autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
        />
      </View>
    </View>
  );
}

function ChipRow({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.chipRow}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt}
          style={[styles.chip, value === opt && styles.chipActive]}
          onPress={() => onChange(opt)}
        >
          <Text style={[styles.chipText, value === opt && styles.chipTextActive]}>{opt}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function ProfileScreen() {
  const t = useThemedStyles();
  const { user, setUser }       = useAuthStore();
  const queryClient             = useQueryClient();
  const { edit: editParam }     = useLocalSearchParams<{ edit?: string }>();

  // Auto-enter edit mode if navigated with ?edit=true
  const [editing,  setEditing]  = useState(editParam === 'true');
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  const [form, setForm] = useState({
    full_name:          user?.full_name          ?? '',
    phone:              user?.phone              ?? '',
    gender:             user?.gender             ?? '',
    date_of_birth:      user?.date_of_birth      ? user.date_of_birth.split('T')[0] : '',
    nationality:        user?.nationality        ?? '',
    emergency_contact:  user?.emergency_contact  ?? '',
    blood_group:        user?.blood_group        ?? '',
    medical_conditions: user?.medical_conditions ?? '',
    allergies:          user?.allergies          ?? '',
  });

  const setFullName         = (v: string) => setForm((p) => ({ ...p, full_name:          v }));
  const setPhone            = (v: string) => setForm((p) => ({ ...p, phone:              v }));
  const setGender           = (v: string) => setForm((p) => ({ ...p, gender:             v }));
  const setDateOfBirth      = (v: string) => setForm((p) => ({ ...p, date_of_birth:      v }));
  const setNationality      = (v: string) => setForm((p) => ({ ...p, nationality:        v }));
  const setEmergencyContact = (v: string) => setForm((p) => ({ ...p, emergency_contact:  v }));
  const setBloodGroup       = (v: string) => setForm((p) => ({ ...p, blood_group:        v }));
  const setMedicalConditions= (v: string) => setForm((p) => ({ ...p, medical_conditions: v }));
  const setAllergies        = (v: string) => setForm((p) => ({ ...p, allergies:          v }));

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // ── Save mutation — strip empty strings to avoid backend validation errors ──
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, string> = {};
      Object.entries(form).forEach(([k, v]) => {
        if (v.trim() !== '') payload[k] = v.trim();
      });
      // Wait for the PATCH to actually commit on the backend
      await authApi.updateProfile(payload as Partial<User>);
      // Then fetch the authoritative copy
      return authApi.me();
    },
    onSuccess: (updatedUser) => {
      // setUser replaces entirely — guaranteed fresh from DB
      setUser(updatedUser);
      queryClient.setQueryData(['auth', 'me'], updatedUser);
      setEditing(false);
      Alert.alert('Saved', 'Profile updated successfully.');
    },
    onError: (err: any) => {
      console.error('[Profile save]', err?.response?.status, err?.response?.data);
      const detail = err?.response?.data?.detail;
      Alert.alert(
        'Save Failed',
        typeof detail === 'string' ? detail : `Error ${err?.response?.status ?? 'unknown'} — check your inputs.`
      );
    },
  });

  // ── Photo picker + upload ─────────────────────────────
  const handlePickPhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Allow photo access to update your profile photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images','livePhotos'],
      allowsEditing: true, aspect: [1, 1], quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setPhotoUri(asset.uri);

      let mimeType = 'image/jpeg'; // Safe default

      if (asset.mimeType) {
        mimeType = asset.mimeType;
      } else {
        const extension = asset.uri.split('.').pop()?.toLowerCase() || 'unknown';
        const map: Record<string, string> = {
          'png': 'image/png',
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'mp4': 'video/mp4',
          'heic': 'image/jpeg', // S3/Browsers prefer JPEG over HEIC for profile photos
        };
        mimeType = map[extension] || 'image/jpeg';
      }

      try {
        const upload = await mediaApi.requestUpload({
          media_type:      'PROFILE_PHOTO',
          content_type:    mimeType,
          file_size_bytes: asset.fileSize ?? 500_000,
        });

        // Use XHR for reliable local file upload
        await uploadViaXHR(asset.uri, upload.upload_url, mimeType);
        await mediaApi.confirmUpload(upload.s3_key, 'PROFILE_PHOTO');
        Alert.alert('Photo Updated', 'Profile photo saved.');
      } catch (err) {
        console.warn('[Profile] Photo upload error:', err);
        setPhotoUri(null);
        Alert.alert('Upload Failed', 'Could not upload photo. Please try again.');
      }
    }
  }, []);

  const handleCancel = () => {
    setForm({
      full_name:          user?.full_name          ?? '',
      phone:              user?.phone              ?? '',
      gender:             user?.gender             ?? '',
      date_of_birth:      user?.date_of_birth      ? user.date_of_birth.split('T')[0] : '',
      nationality:        user?.nationality        ?? '',
      emergency_contact:  user?.emergency_contact  ?? '',
      blood_group:        user?.blood_group        ?? '',
      medical_conditions: user?.medical_conditions ?? '',
      allergies:          user?.allergies          ?? '',
    });
    setEditing(false);
  };

  const langLabel: Record<UserLanguage, string> = {
    en: 'English', hi: 'हिंदी', kn: 'ಕನ್ನಡ',
    te: 'తెలుగు', ta: 'தமிழ்', ml: 'മലയാളം',
  };

  const verifiedSince = user?.created_at
    ? format(new Date(user.created_at), 'MMM yyyy')
    : null;

  return (
    <View style={[styles.root, t.bg]}>
      <Header
        title="My Profile"
        showBack
        rightEl={
          editing ? (
            <TouchableOpacity
              style={styles.saveHeaderBtn}
              onPress={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending
                ? <ActivityIndicator size="small" color={Colors.primary} />
                : <Text style={styles.saveHeaderBtnText}>Save</Text>
              }
            </TouchableOpacity>
          ) : (
            // Edit icon — opens edit mode (no redirect to settings)
            <TouchableOpacity
              style={styles.editHeaderBtn}
              onPress={() => setEditing(true)}
            >
              <Icon.Edit size={16} color={Colors.primary} />
            </TouchableOpacity>
          )
        }
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Avatar ─────────────────────────────────── */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.avatarSection}>
          <TouchableOpacity
            style={styles.avatarWrap}
            onPress={editing ? handlePickPhoto : undefined}
            activeOpacity={editing ? 0.75 : 1}
          >
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.avatarImage} />
            ) : (
              <Avatar name={user?.full_name} size={88} />
            )}
            {editing && (
              <View style={styles.avatarOverlay}>
                <Icon.Camera size={22} color="#fff" />
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.avatarMeta}>
            <Text style={[styles.avatarName, t.textPrimary]}>{user?.full_name ?? 'Tourist'}</Text>
            <Text style={[styles.avatarEmail, t.textMuted]}>{user?.email}</Text>
            <View style={styles.avatarBadges}>
              {user?.is_verified && <Badge label="Verified" variant="success" size="sm" dot />}
              <Badge label={user?.role ?? 'TOURIST'} variant="info" size="sm" />
              {verifiedSince && <Badge label={`Since ${verifiedSince}`} variant="muted" size="sm" />}
            </View>
          </View>
        </Animated.View>

        {/* ── Personal Info ───────────────────────────── */}
        <Animated.View entering={FadeInDown.duration(400).delay(80)}>
          <SectionLabel title="Personal Information" />
          <Card>
            {editing ? (
              <>
                <EditableField label="Full Name" value={form.full_name} onChangeText={setFullName}
                  placeholder="John Doe" icon={<Icon.User size={16} color={Colors.textMuted} />} />
                <View style={styles.fieldDivider} />
                <EditableField label="Phone Number" value={form.phone} onChangeText={setPhone}
                  placeholder="+91 98765 43210" keyboardType="phone-pad" icon={<Icon.Phone size={16} color={Colors.textMuted} />} />
                <View style={styles.fieldDivider} />
                <EditableField label="Date of Birth" value={form.date_of_birth} onChangeText={setDateOfBirth}
                  placeholder="1990-01-31" keyboardType="numbers-and-punctuation" icon={<Icon.Clock size={16} color={Colors.textMuted} />} />
                <View style={styles.fieldDivider} />
                <EditableField label="Nationality" value={form.nationality} onChangeText={setNationality}
                  placeholder="Indian" icon={<Icon.Globe size={16} color={Colors.textMuted} />} />
                <View style={styles.fieldDivider} />
                <View style={styles.field}>
                  <Text style={[styles.fieldLabel, t.textSecondary]}>Gender</Text>
                  <ChipRow options={GENDERS} value={form.gender} onChange={setGender} />
                </View>
              </>
            ) : (
              <>
                <InfoRow label="Full Name"    value={user?.full_name  ?? ''} icon={<Icon.User  size={16} color={Colors.textMuted} />} />
                <View style={styles.fieldDivider} />
                <InfoRow label="Phone"        value={user?.phone      ?? ''} icon={<Icon.Phone size={16} color={Colors.textMuted} />} />
                <View style={styles.fieldDivider} />
                <InfoRow label="Gender"       value={user?.gender     ?? ''} icon={<Icon.User  size={16} color={Colors.textMuted} />} />
                <View style={styles.fieldDivider} />
                <InfoRow label="Date of Birth" value={user?.date_of_birth ? format(new Date(user.date_of_birth), 'MMM d, yyyy') : ''}
                  icon={<Icon.Clock size={16} color={Colors.textMuted} />} />
                <View style={styles.fieldDivider} />
                <InfoRow label="Nationality"  value={user?.nationality ?? ''} icon={<Icon.Globe size={16} color={Colors.textMuted} />} />
              </>
            )}
          </Card>
        </Animated.View>

        {/* ── Account (read-only) ─────────────────────── */}
        <Animated.View entering={FadeInDown.duration(400).delay(140)}>
          <SectionLabel title="Account" />
          <Card>
            <InfoRow label="Email Address"      value={user?.email ?? ''} icon={<Icon.Lock size={16} color={Colors.textMuted} />} />
            <View style={styles.fieldDivider} />
            <InfoRow label="Preferred Language" value={langLabel[(user?.preferred_language as UserLanguage) ?? 'en']}
              icon={<Icon.Globe size={16} color={Colors.textMuted} />} />
            <View style={styles.fieldDivider} />
            <InfoRow label="Member Since" value={user?.created_at ? format(new Date(user.created_at), 'MMM d, yyyy') : ''}
              icon={<Icon.CheckCircle size={16} color={Colors.success} />} />
          </Card>
        </Animated.View>

        {/* ── Medical & Emergency ─────────────────────── */}
        <Animated.View entering={FadeInDown.duration(400).delay(200)}>
          <SectionLabel title="Medical & Emergency" />
          <Card>
            {editing ? (
              <>
                <EditableField label="Emergency Contact" value={form.emergency_contact} onChangeText={set('emergency_contact')}
                  placeholder="+91 98765 43210" keyboardType="phone-pad" icon={<Icon.Phone size={16} color={Colors.error} />} />
                <View style={styles.fieldDivider} />
                <View style={styles.field}>
                  <Text style={[styles.fieldLabel, t.textSecondary]}>Blood Group</Text>
                  <ChipRow options={BLOOD_GROUPS} value={form.blood_group} onChange={setBloodGroup} />
                </View>
                <View style={styles.fieldDivider} />
                <EditableField label="Medical Conditions" value={form.medical_conditions} onChangeText={setMedicalConditions}
                  placeholder="e.g. Diabetes, Hypertension..." multiline icon={<Icon.Activity size={16} color={Colors.textMuted} />} />
                <View style={styles.fieldDivider} />
                <EditableField label="Allergies" value={form.allergies} onChangeText={setAllergies}
                  placeholder="e.g. Penicillin, Pollen..." multiline icon={<Icon.AlertTriangle size={16} color={Colors.textMuted} />} />
              </>
            ) : (
              <>
                <View style={styles.medicalAlert}>
                  <Icon.Shield size={14} color={Colors.primary} />
                  <Text style={styles.medicalAlertText}>Shared only with emergency responders during incidents</Text>
                </View>
                <View style={styles.fieldDivider} />
                <InfoRow label="Emergency Contact"  value={user?.emergency_contact  ?? ''} icon={<Icon.Phone     size={16} color={Colors.error}    />} />
                <View style={styles.fieldDivider} />
                <InfoRow label="Blood Group"        value={user?.blood_group        ?? ''} icon={<Icon.Activity  size={16} color={Colors.heartRate} />} />
                <View style={styles.fieldDivider} />
                <InfoRow label="Medical Conditions" value={user?.medical_conditions ?? 'None specified'} icon={<Icon.Activity    size={16} color={Colors.textMuted} />} />
                <View style={styles.fieldDivider} />
                <InfoRow label="Allergies"          value={user?.allergies          ?? 'None specified'} icon={<Icon.AlertTriangle size={16} color={Colors.textMuted} />} />
              </>
            )}
          </Card>
        </Animated.View>

        {/* ── Edit mode actions ───────────────────────── */}
        {editing && (
          <Animated.View entering={FadeInDown.duration(300)} style={styles.editActions}>
            <TouchableOpacity style={[styles.cancelBtn, t.surface,]} onPress={handleCancel}>
              <Icon.X size={16} color={Colors.textSecondary} />
              <Text style={[styles.cancelBtnText, t.textSecondary]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, saveMutation.isPending && styles.btnDisabled]}
              onPress={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending
                ? <ActivityIndicator size="small" color="#fff" />
                : <><Icon.CheckCircle size={16} color="#fff" /><Text style={styles.saveBtnText}>Save Changes</Text></>
              }
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ── Go to settings link ─────────────────────── */}
        {!editing && (
          <Animated.View entering={FadeInDown.duration(400).delay(260)}>
            <TouchableOpacity style={[styles.settingsLink, t.surface, t.border]} onPress={() => router.push('/settings')} activeOpacity={0.8}>
              <Icon.Settings size={18} color={Colors.textSecondary} />
              <Text style={[styles.settingsLinkText, t.textSecondary]}>Change password, language, or delete account</Text>
              <Icon.ChevronRight size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          </Animated.View>
        )}

        <View style={{ height: Spacing['4xl'] }} />
      </ScrollView>
    </View>
  );
}

// ─── XHR upload helper ────────────────────────────────────
async function uploadViaXHR(fileUri: string, presignedUrl: string, contentType: string): Promise<void> {
  // 1. Get the actual binary data from the local URI
  const response = await fetch(fileUri);
  const blob = await response.blob();

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', presignedUrl);
    xhr.setRequestHeader('Content-Type', contentType);

    xhr.onreadystatechange = () => {
      if (xhr.readyState !== 4) return;
      if (xhr.status === 200) {
        resolve();
      } else {
        // Log the S3 error body (it's XML) to see exactly why it failed
        console.warn('S3 Error Body:', xhr.responseText);
        reject(new Error(`S3 status ${xhr.status}`));
      }
    };
    
    xhr.onerror = () => reject(new Error('XHR network error'));
    
    // 2. Send the raw binary blob, not the metadata object
    xhr.send(blob);
  });
}

const styles = StyleSheet.create({
  root:         { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingHorizontal: Spacing.base, paddingBottom: Spacing['4xl'] },
  saveHeaderBtn: {
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
    backgroundColor: 'rgba(59,130,246,0.12)', borderRadius: Radius.md,
    borderWidth: 1, borderColor: 'rgba(59,130,246,0.3)',
  },
  saveHeaderBtnText: { fontSize: Typography.sm, fontFamily: 'SpaceGrotesk_600SemiBold', color: Colors.primary },
  editHeaderBtn: {
    width: 36, height: 36, borderRadius: Radius.md,
    backgroundColor: 'rgba(59,130,246,0.08)', borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarSection: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.md },
  avatarWrap:    { position: 'relative' },
  avatarImage:   { width: 88, height: 88, borderRadius: 26, borderWidth: 2, borderColor: Colors.primary },
  avatarOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 26, backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarMeta:   { alignItems: 'center', gap: Spacing.xs },
  avatarName:   { fontSize: Typography['2xl'], fontFamily: 'SpaceGrotesk_700Bold', color: Colors.textPrimary },
  avatarEmail:  { fontSize: Typography.sm, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  avatarBadges: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: Spacing.xs, marginTop: 4 },
  sectionLabel: {
    fontSize: Typography.xs, fontFamily: 'SpaceGrotesk_700Bold', color: Colors.textMuted,
    letterSpacing: 0.8, textTransform: 'uppercase', marginTop: Spacing.base, marginBottom: Spacing.sm,
  },
  infoRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, paddingVertical: Spacing.sm },
  infoIcon:    { width: 28, alignItems: 'center', paddingTop: 2 },
  infoContent: { flex: 1 },
  infoLabel:   { fontSize: Typography.xs, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginBottom: 2 },
  infoValue:   { fontSize: Typography.sm, fontFamily: 'Inter_500Medium', color: Colors.textPrimary, lineHeight: 20 },
  field:       { gap: Spacing.xs, paddingVertical: Spacing.sm },
  fieldLabel:  { fontSize: Typography.xs, fontFamily: 'Inter_500Medium', color: Colors.textSecondary, letterSpacing: 0.3 },
  fieldInput:  {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surfaceAlt, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, minHeight: 48, gap: Spacing.sm,
  },
  fieldIcon:      { width: 20, alignItems: 'center' },
  fieldText:      { flex: 1, color: Colors.textPrimary, fontFamily: 'Inter_400Regular', fontSize: Typography.sm },
  fieldTextMulti: { textAlignVertical: 'top', paddingVertical: Spacing.xs },
  fieldDivider:   { height: 1, backgroundColor: Colors.border },
  chipRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  chip: {
    paddingHorizontal: Spacing.sm, paddingVertical: 6,
    borderRadius: Radius.full, backgroundColor: Colors.surfaceAlt,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  chipActive:     { backgroundColor: 'rgba(59,130,246,0.12)', borderColor: Colors.primary },
  chipText:       { fontSize: Typography.xs, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  chipTextActive: { color: Colors.primary },
  medicalAlert: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: 'rgba(59,130,246,0.06)', borderRadius: Radius.md,
    padding: Spacing.sm, borderWidth: 1, borderColor: 'rgba(59,130,246,0.15)', marginBottom: Spacing.xs,
  },
  medicalAlertText: { flex: 1, fontSize: Typography.xs, fontFamily: 'Inter_400Regular', color: Colors.textSecondary },
  editActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.base },
  cancelBtn: {
    flex: 1, height: 50, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: Spacing.xs, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface,
  },
  cancelBtnText: { fontSize: Typography.sm, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  saveBtn: {
    flex: 2, height: 50, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: Spacing.sm, borderRadius: Radius.lg, backgroundColor: Colors.primary,
  },
  saveBtnText: { fontSize: Typography.sm, fontFamily: 'SpaceGrotesk_600SemiBold', color: '#fff' },
  btnDisabled: { opacity: 0.55 },
  settingsLink: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.surface, borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, marginTop: Spacing.base,
  },
  settingsLinkText: { flex: 1, fontSize: Typography.sm, fontFamily: 'Inter_400Regular', color: Colors.textSecondary },
});