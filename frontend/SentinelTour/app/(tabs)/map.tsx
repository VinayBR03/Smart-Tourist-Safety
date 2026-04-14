import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput,
  TouchableOpacity, FlatList, ActivityIndicator,
  Linking, Platform, Keyboard,
} from 'react-native';
import MapView, { Marker, Circle, Polygon, PROVIDER_DEFAULT, Region } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import Animated, {
  FadeIn, FadeOut, SlideInDown, SlideOutDown,
} from 'react-native-reanimated';
import { zonesApi } from '@/api/zones';
import { locationApi } from '@/api/location';
import { Typography, Spacing, Radius } from '@/constants/theme';
import { Icon } from '@/components/ui/Icons';
import { Badge, riskVariant } from '@/components/ui/Badge';
import type { ZoneWithStatus, RiskLevel } from '@/types/api';
import { Config } from '@/constants/config';
import { useThemedStyles } from '@/utils/themedStyles';
import { useColors } from '@/context/ThemeContext';
import { useTheme } from '@/hooks/useTheme';

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  importance?: number;
  address?: { city?: string; state?: string; country?: string };
}

const ZONE_COLORS: Record<RiskLevel, { fill: string; stroke: string }> = {
  LOW:    { fill: 'rgba(16,185,129,0.12)',  stroke: '#10b981' },
  MEDIUM: { fill: 'rgba(245,158,11,0.15)',  stroke: '#f59e0b' },
  HIGH:   { fill: 'rgba(239,68,68,0.18)',   stroke: '#ef4444' },
};

const DEFAULT_REGION: Region = {
  latitude: 20.5937, longitude: 78.9629,
  latitudeDelta: 20, longitudeDelta: 20,
};

export default function MapScreen() {
  const t = useThemedStyles();
  const { theme } = useTheme();
  const mapRef = useRef<MapView>(null);

  const [searchQuery,      setSearchQuery]      = useState('');
  const [searchResults,    setSearchResults]    = useState<NominatimResult[]>([]);
  const [searching,        setSearching]        = useState(false);
  const [selectedResult,   setSelectedResult]   = useState<NominatimResult | null>(null);
  const [showBottomSheet,  setShowBottomSheet]  = useState(false);
  const [showZoneLegend,   setShowZoneLegend]   = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: zones } = useQuery({
    queryKey: ['zones'], queryFn: zonesApi.list, staleTime: 60_000,
  });

  const { data: myLocation } = useQuery({
    queryKey: ['location', 'me'],
    queryFn:  locationApi.getMyLocation,
    refetchInterval: 30_000,
    retry: false,
  });

  // Fly to user location on first load — zoomed in tightly
  useEffect(() => {
    if (myLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude:      myLocation.latitude,
        longitude:     myLocation.longitude,
        latitudeDelta: 0.015,   // tight street-level zoom
        longitudeDelta:0.015,
      }, 800);
    }
  }, [myLocation?.latitude, myLocation?.longitude]);

  // Search Nominatim with proximity bias toward user location
  const handleSearch = useCallback((text: string) => {
    setSearchQuery(text);
    setSelectedResult(null);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (text.trim().length < 3) { setSearchResults([]); return; }
    setSearching(true);
    searchTimeout.current = setTimeout(async () => {
      try {
        // Add viewbox + bounded to bias results near user location when available
        const proximityParams = myLocation
          ? `&lat=${myLocation.latitude}&lon=${myLocation.longitude}`
          : '';
        const url = `${Config.NOMINATIM_URL}/search?format=json&q=${encodeURIComponent(text)}&limit=8&addressdetails=1${proximityParams}`;
        const res  = await fetch(url, { headers: { 'User-Agent': 'SentinelTour/1.0' } });
        const data: NominatimResult[] = await res.json();
        // Sort: important results first, then by proximity if we have location
        const sorted = data.sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0));
        setSearchResults(sorted);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 450);
  }, [myLocation]);

  const handleSelectResult = (result: NominatimResult) => {
    setSelectedResult(result);
    setSearchResults([]);
    setSearchQuery(result.display_name.split(',')[0]);
    Keyboard.dismiss();
    setShowBottomSheet(true);
    mapRef.current?.animateToRegion({
      latitude:  parseFloat(result.lat),
      longitude: parseFloat(result.lon),
      latitudeDelta:  0.02,
      longitudeDelta: 0.02,
    }, 800);
  };

  const handleClearSearch = () => {
    setSearchQuery(''); setSearchResults([]);
    setSelectedResult(null); setShowBottomSheet(false);
  };

  const handleDirections = () => {
    if (!selectedResult) return;
    const lat   = selectedResult.lat;
    const lon   = selectedResult.lon;
    const label = encodeURIComponent(selectedResult.display_name.split(',')[0]);
    const url   = Platform.select({
      ios:     `maps:0,0?q=${label}@${lat},${lon}`,
      android: `geo:${lat},${lon}?q=${lat},${lon}(${label})`,
    }) ?? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}`;
    Linking.openURL(url).catch(() =>
      Linking.openURL(`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}`)
    );
  };

  const renderZone = (zone: ZoneWithStatus) => {
    const risk    = zone.status?.risk_level ?? 'LOW';
    const palette = ZONE_COLORS[risk];
    if (zone.radius_meters && zone.center_latitude && zone.center_longitude) {
      return (
        <Circle key={`zone-${zone.id}`}
          center={{ latitude: zone.center_latitude, longitude: zone.center_longitude }}
          radius={zone.radius_meters}
          fillColor={palette.fill} strokeColor={palette.stroke} strokeWidth={1.5}
        />
      );
    }
    if (zone.coordinates && zone.coordinates.length > 2) {
      return (
        <Polygon key={`zone-${zone.id}`}
          coordinates={zone.coordinates.map(([lng, lat]) => ({ latitude: lat, longitude: lng }))}
          fillColor={palette.fill} strokeColor={palette.stroke} strokeWidth={1.5}
        />
      );
    }
    return null;
  };

  // Map style adapts to theme
  const mapStyle = theme === 'dark' ? darkMapStyle : [];

  return (
    <SafeAreaView style={[styles.container, t.bg]} edges={['top']}>

      {/* ── Search bar ─────────────────────────────────── */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchBar, t.surface, t.border]}>
          <Icon.Search size={18} color={t.C.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: t.C.textPrimary }]}
            placeholder="Search tourist spots, places..."
            placeholderTextColor={t.C.textMuted}
            value={searchQuery}
            onChangeText={handleSearch}
            returnKeyType="search"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={handleClearSearch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Icon.X size={16} color={t.C.textMuted} />
            </TouchableOpacity>
          )}
          {searching && <ActivityIndicator size="small" color={t.C.primary} style={{ marginLeft: 4 }} />}
        </View>

        <TouchableOpacity
          style={[styles.legendBtn, t.surface, t.border, showZoneLegend && { borderColor: t.C.primary, backgroundColor: 'rgba(59,130,246,0.1)' }]}
          onPress={() => setShowZoneLegend((p) => !p)}
        >
          <Icon.Layers size={18} color={showZoneLegend ? t.C.primary : t.C.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* ── Search results dropdown ─────────────────────── */}
      {searchResults.length > 0 && (
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)}
          style={[styles.dropdown, t.surface, t.border]}
        >
          <FlatList
            data={searchResults}
            keyExtractor={(item) => String(item.place_id)}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.dropdownItem} onPress={() => handleSelectResult(item)}>
                <View style={styles.dropdownIcon}>
                  <Icon.MapPin size={14} color={t.C.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.dropdownTitle, t.textPrimary]} numberOfLines={1}>
                    {item.display_name.split(',')[0]}
                  </Text>
                  <Text style={[styles.dropdownSub, t.textMuted]} numberOfLines={1}>
                    {item.display_name.split(',').slice(1, 3).join(',')}
                  </Text>
                </View>
                <Icon.ChevronRight size={14} color={t.C.textMuted} />
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: t.C.border }]} />}
          />
        </Animated.View>
      )}

      {/* ── Zone legend ─────────────────────────────────── */}
      {showZoneLegend && (
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)}
          style={[styles.legend, t.surface, t.border]}
        >
          <Text style={[styles.legendTitle, t.textSecondary]}>Zone Risk Levels</Text>
          {(['LOW', 'MEDIUM', 'HIGH'] as RiskLevel[]).map((level) => (
            <View key={level} style={styles.legendRow}>
              <View style={[styles.legendSwatch, { backgroundColor: ZONE_COLORS[level].stroke }]} />
              <Text style={[styles.legendLabel, t.textSecondary]}>{level}</Text>
            </View>
          ))}
        </Animated.View>
      )}

      {/* ── Map ─────────────────────────────────────────── */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={DEFAULT_REGION}
        showsUserLocation
        showsMyLocationButton={false}
        mapType="standard"
        customMapStyle={mapStyle}
      >
        {zones?.map(renderZone)}

        {zones?.map((zone) => {
          if (!zone.center_latitude || !zone.center_longitude) return null;
          const risk = zone.status?.risk_level ?? 'LOW';
          return (
            <Marker key={`label-${zone.id}`}
              coordinate={{ latitude: zone.center_latitude, longitude: zone.center_longitude }}
              anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}
            >
              <View style={[styles.zoneLabel, { borderColor: ZONE_COLORS[risk].stroke }]}>
                <Text style={[styles.zoneLabelText, { color: ZONE_COLORS[risk].stroke }]}>{zone.name}</Text>
              </View>
            </Marker>
          );
        })}

        {selectedResult && (
          <Marker
            coordinate={{ latitude: parseFloat(selectedResult.lat), longitude: parseFloat(selectedResult.lon) }}
            tracksViewChanges={false}
          >
            <View style={styles.searchPin}>
              <Icon.MapPin size={28} color={t.C.primary} />
              <View style={[styles.searchPinDot, { backgroundColor: t.C.primary }]} />
            </View>
          </Marker>
        )}
      </MapView>

      {/* ── My location button (Navigation icon — unchanged) ── */}
      <TouchableOpacity
        style={[styles.myLocationBtn, t.surface, t.border]}
        onPress={() => {
          if (myLocation) {
            mapRef.current?.animateToRegion({
              latitude:      myLocation.latitude,
              longitude:     myLocation.longitude,
              latitudeDelta:  0.015,
              longitudeDelta: 0.015,
            }, 600);
          }
        }}
      >
        <Icon.MapPin size={20} color={t.C.primary} />
      </TouchableOpacity>

      {/* ── Place detail bottom sheet ────────────────────── */}
      {showBottomSheet && selectedResult && (
        <Animated.View
          entering={SlideInDown.springify().damping(18)}
          exiting={SlideOutDown.duration(250)}
          style={[styles.bottomSheet, t.surface, { borderTopColor: t.C.border }]}
        >
          <View style={[styles.sheetHandle, { backgroundColor: t.C.border }]} />

          <View style={styles.sheetContent}>
            <View style={styles.sheetHeader}>
              <View style={styles.sheetIconWrap}>
                <Icon.MapPin size={20} color={t.C.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sheetTitle, t.textPrimary]} numberOfLines={2}>
                  {selectedResult.display_name.split(',')[0]}
                </Text>
                <Text style={[styles.sheetAddress, t.textMuted]} numberOfLines={1}>
                  {selectedResult.display_name.split(',').slice(1, 4).join(', ')}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowBottomSheet(false)}>
                <Icon.X size={20} color={t.C.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={[styles.coordRow, t.surfaceAlt]}>
              <View style={styles.coordItem}>
                <Text style={[styles.coordLabel, t.textMuted]}>Latitude</Text>
                <Text style={[styles.coordValue, t.textPrimary]}>
                  {parseFloat(selectedResult.lat).toFixed(5)}
                </Text>
              </View>
              <View style={[styles.coordDivider, { backgroundColor: t.C.border }]} />
              <View style={styles.coordItem}>
                <Text style={[styles.coordLabel, t.textMuted]}>Longitude</Text>
                <Text style={[styles.coordValue, t.textPrimary]}>
                  {parseFloat(selectedResult.lon).toFixed(5)}
                </Text>
              </View>
              <View style={[styles.coordDivider, { backgroundColor: t.C.border }]} />
              <View style={styles.coordItem}>
                <Text style={[styles.coordLabel, t.textMuted]}>Type</Text>
                <Text style={[styles.coordValue, t.textPrimary]} numberOfLines={1}>
                  {selectedResult.type}
                </Text>
              </View>
            </View>

            {zones && zones.length > 0 && (
              <View style={styles.nearbyZones}>
                <Text style={[styles.nearbyZonesTitle, t.textSecondary]}>Zones in area</Text>
                <View style={styles.nearbyZonesRow}>
                  {zones.slice(0, 3).map((z) => (
                    <Badge key={z.id} label={`${z.name} · ${z.status?.risk_level ?? 'LOW'}`}
                      variant={riskVariant(z.status?.risk_level ?? 'LOW')} size="sm" />
                  ))}
                </View>
              </View>
            )}

            <TouchableOpacity style={styles.directionsBtn} onPress={handleDirections} activeOpacity={0.85}>
              <Icon.Navigation size={18} color="#fff" />
              <Text style={styles.directionsBtnText}>Get Directions</Text>
            </TouchableOpacity>

            <Text style={[styles.directionsHint, t.textMuted]}>
              Opens in your installed maps application
            </Text>
          </View>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1a1f2e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#9ca3af' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#111827' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#374151' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#4b5563' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
  { featureType: 'poi', stylers: [{ visibility: 'simplified' }] },
];

const styles = StyleSheet.create({
  container: { flex: 1 },
  map:       { flex: 1 },

  searchContainer: {
    position: 'absolute', top: 56, left: Spacing.base, right: Spacing.base,
    zIndex: 10, flexDirection: 'row', gap: Spacing.sm,
  },
  searchBar: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    borderRadius: Radius.xl, borderWidth: 1,
    paddingHorizontal: Spacing.md, height: 48, gap: Spacing.sm,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  searchInput: {
    flex: 1, fontFamily: 'Inter_400Regular', fontSize: Typography.sm,
  },
  legendBtn: {
    width: 48, height: 48, borderRadius: Radius.xl,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },

  dropdown: {
    position: 'absolute', top: 116, left: Spacing.base, right: Spacing.base,
    zIndex: 20, borderRadius: Radius.xl, borderWidth: 1,
    maxHeight: 280, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5, shadowRadius: 16, elevation: 16,
  },
  dropdownItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, gap: Spacing.sm,
  },
  dropdownIcon: {
    width: 28, height: 28, borderRadius: Radius.sm,
    backgroundColor: 'rgba(59,130,246,0.1)', alignItems: 'center', justifyContent: 'center',
  },
  dropdownTitle: { fontSize: Typography.sm, fontFamily: 'Inter_500Medium' },
  dropdownSub:   { fontSize: Typography.xs, fontFamily: 'Inter_400Regular', marginTop: 1 },
  separator:     { height: 1, marginLeft: 56 },

  legend: {
    position: 'absolute', top: 116, right: Spacing.base,
    zIndex: 15, borderRadius: Radius.lg, borderWidth: 1,
    padding: Spacing.md, gap: Spacing.sm,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 8,
    minWidth: 140,
  },
  legendTitle: {
    fontSize: Typography.xs, fontFamily: 'SpaceGrotesk_700Bold',
    letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 2,
  },
  legendRow:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  legendSwatch:{ width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontSize: Typography.xs, fontFamily: 'Inter_500Medium' },

  zoneLabel: {
    backgroundColor: 'rgba(17,24,39,0.85)', borderRadius: Radius.sm,
    borderWidth: 1, paddingHorizontal: 6, paddingVertical: 3,
  },
  zoneLabelText: { fontSize: 10, fontFamily: 'SpaceGrotesk_700Bold' },

  searchPin:    { alignItems: 'center' },
  searchPinDot: { width: 8, height: 8, borderRadius: 4, marginTop: -4 },

  myLocationBtn: {
    position: 'absolute', bottom: 180, right: Spacing.base,
    width: 48, height: 48, borderRadius: 24,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 8,
  },

  bottomSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.5, shadowRadius: 20, elevation: 20,
  },
  sheetHandle:  { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 12 },
  sheetContent: { padding: Spacing.base, paddingBottom: 32, gap: Spacing.md },
  sheetHeader:  { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  sheetIconWrap:{
    width: 40, height: 40, borderRadius: Radius.md,
    backgroundColor: 'rgba(59,130,246,0.12)', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  sheetTitle:   { fontSize: Typography.md, fontFamily: 'SpaceGrotesk_700Bold', flex: 1 },
  sheetAddress: { fontSize: Typography.xs, fontFamily: 'Inter_400Regular', marginTop: 2 },

  coordRow:     { flexDirection: 'row', borderRadius: Radius.lg, padding: Spacing.md },
  coordItem:    { flex: 1, alignItems: 'center', gap: 4 },
  coordDivider: { width: 1 },
  coordLabel:   { fontSize: 10, fontFamily: 'Inter_400Regular', textTransform: 'uppercase', letterSpacing: 0.5 },
  coordValue:   { fontSize: Typography.sm, fontFamily: 'SpaceGrotesk_600SemiBold' },

  nearbyZones:     { gap: Spacing.sm },
  nearbyZonesTitle:{ fontSize: Typography.xs, fontFamily: 'Inter_500Medium', textTransform: 'uppercase', letterSpacing: 0.5 },
  nearbyZonesRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },

  directionsBtn: {
    height: 50, backgroundColor: '#3B82F6', borderRadius: Radius.lg,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
  },
  directionsBtnText: { color: '#fff', fontSize: Typography.base, fontFamily: 'SpaceGrotesk_600SemiBold' },
  directionsHint:    { fontSize: Typography.xs, fontFamily: 'Inter_400Regular', textAlign: 'center' },
});
