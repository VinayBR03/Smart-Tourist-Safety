// app/(tabs)/map.tsx
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
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';

interface NominatimResult {
  place_id:     number;
  display_name: string;
  lat:          string;
  lon:          string;
  type:         string;
  importance?:  number;
  address?: {
    road?: string; suburb?: string; city?: string;
    state?: string; country?: string;
  };
  // Distance from user injected client-side
  _distanceKm?: number;
}

const ZONE_COLORS: Record<RiskLevel, { fill: string; stroke: string }> = {
  LOW:    { fill: 'rgba(16,185,129,0.14)',  stroke: '#10b981' },
  MEDIUM: { fill: 'rgba(245,158,11,0.16)',  stroke: '#f59e0b' },
  HIGH:   { fill: 'rgba(239,68,68,0.20)',   stroke: '#ef4444' },
};

const DEFAULT_REGION: Region = {
  latitude: 20.5937, longitude: 78.9629,
  latitudeDelta: 20, longitudeDelta: 20,
};

const VIEWBOX_DELTA = 1.5; // ~150 km bias radius

type MapType = 'standard' | 'satellite';

// ─── Haversine distance in km ─────────────────────────────
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

// ─── Compute polygon centroid from [lon, lat][] ───────────
// Used when center_latitude / center_longitude is null in the API response.
function computeCentroid(coords: Array<[number, number]>): { lat: number; lon: number } | null {
  if (!coords || coords.length === 0) return null;
  // Use simple average (sufficient for campus-sized polygons)
  const sum = coords.reduce(
    (acc, [lon, lat]) => ({ lon: acc.lon + lon, lat: acc.lat + lat }),
    { lon: 0, lat: 0 }
  );
  return { lat: sum.lat / coords.length, lon: sum.lon / coords.length };
}

// ─── Resolve zone coordinates from various API shapes ─────
// The backend may return:
//   a) coordinates: [[lon, lat], ...]            ← flat ring array (expected)
//   b) coordinates: { type: "Polygon", coordinates: [[[lon,lat],...]] } ← GeoJSON
//   c) coordinates: null                         ← not serialized
// We normalise all cases to Array<[number,number]> | null.
function resolveCoordinates(zone: ZoneWithStatus): Array<[number, number]> | null {
  const raw = zone.geometry as any;
  if (!raw) return null;

  // Already a flat array of [lon, lat] pairs
  if (Array.isArray(raw) && raw.length > 0 && Array.isArray(raw[0])) {
    return raw as Array<[number, number]>;
  }

  // GeoJSON Polygon: { type: "Polygon", coordinates: [ring1, ring2, ...] }
  if (raw?.type === 'Polygon' && Array.isArray(raw.coordinates?.[0])) {
    return raw.coordinates[0] as Array<[number, number]>;
  }

  // GeoJSON MultiPolygon: { type: "MultiPolygon", coordinates: [[ring1], ...] }
  if (raw?.type === 'MultiPolygon' && Array.isArray(raw.coordinates?.[0]?.[0])) {
    return raw.coordinates[0][0] as Array<[number, number]>;
  }

  return null;
}

// ─── Resolve zone center ──────────────────────────────────
function resolveCenter(zone: ZoneWithStatus, coords: Array<[number, number]> | null) {
  if (zone.center_latitude != null && zone.center_longitude != null) {
    return { lat: zone.center_latitude, lon: zone.center_longitude };
  }
  if (coords) return computeCentroid(coords);
  return null;
}

// ─── Main screen ──────────────────────────────────────────
export default function MapScreen() {
  const t = useThemedStyles();
  const { theme } = useTheme();
  const mapRef = useRef<MapView>(null);

  const [searchQuery,      setSearchQuery]      = useState('');
  const [searchResults,    setSearchResults]    = useState<NominatimResult[]>([]);
  const [searching,        setSearching]        = useState(false);
  const [selectedResult,   setSelectedResult]   = useState<NominatimResult | null>(null);
  const [showBottomSheet,  setShowBottomSheet]  = useState(false);
  const [showLayersPanel,  setShowLayersPanel]  = useState(false);
  const [mapType,          setMapType]          = useState<MapType>('standard');
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: zones } = useQuery({
    queryKey: ['zones'], queryFn: zonesApi.list, staleTime: 60_000,
  });

  const { data: myLocation } = useQuery({
    queryKey: ['location', 'me'],
    queryFn:  locationApi.getMyLocation,
    refetchInterval: 30_000,
    retry: false,
    enabled: useAuthStore.getState().isAuthenticated,
  });

  // Fly to user location on first load
  useEffect(() => {
    if (myLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude:       myLocation.latitude,
        longitude:      myLocation.longitude,
        latitudeDelta:  0.015,
        longitudeDelta: 0.015,
      }, 800);
    }
  }, [myLocation?.latitude, myLocation?.longitude]);

  // ── Nominatim search with proximity bias ──────────────
  const handleSearch = useCallback((text: string) => {
    setSearchQuery(text);
    setSelectedResult(null);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (text.trim().length < 3) { setSearchResults([]); return; }
    setSearching(true);

    searchTimeout.current = setTimeout(async () => {
      try {
        let url = `${Config.NOMINATIM_URL}/search?format=json&q=${encodeURIComponent(text)}&limit=10&addressdetails=1`;

        if (myLocation) {
          const { latitude: lat, longitude: lon } = myLocation;
          // Proximity hint — Nominatim boosts near results in ranking
          url += `&lat=${lat}&lon=${lon}`;
          // Viewbox biases results to the region around user (bounded=0 = prefer but not restrict)
          url += `&viewbox=${lon - VIEWBOX_DELTA},${lat + VIEWBOX_DELTA},${lon + VIEWBOX_DELTA},${lat - VIEWBOX_DELTA}&bounded=0`;
        }

        const res  = await fetch(url, { headers: { 'User-Agent': 'SentinelTour/1.0' } });
        const data: NominatimResult[] = await res.json();

        // Annotate each result with its distance from the user
        let annotated = data;
        if (myLocation) {
          annotated = data.map((r) => ({
            ...r,
            _distanceKm: haversineKm(
              myLocation.latitude, myLocation.longitude,
              parseFloat(r.lat), parseFloat(r.lon)
            ),
          }));

          // Sort: importance delta > 0.05 wins; otherwise nearest first
          annotated.sort((a, b) => {
            const importanceDiff = (b.importance ?? 0) - (a.importance ?? 0);
            if (Math.abs(importanceDiff) > 0.05) return importanceDiff;
            return (a._distanceKm ?? 999) - (b._distanceKm ?? 999);
          });
        }

        setSearchResults(annotated);
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
    setShowLayersPanel(false);
    mapRef.current?.animateToRegion({
      latitude:       parseFloat(result.lat),
      longitude:      parseFloat(result.lon),
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

  // ── Zone rendering ────────────────────────────────────
  const renderZone = (zone: ZoneWithStatus) => {
    const risk    = zone.status?.risk_level ?? 'LOW';
    const palette = ZONE_COLORS[risk];

    // Circle zone (has radius + center)
    if (zone.radius_meters && zone.center_latitude && zone.center_longitude) {
      return (
        <Circle
          key={`zone-${zone.id}`}
          center={{ latitude: zone.center_latitude, longitude: zone.center_longitude }}
          radius={zone.radius_meters}
          fillColor={palette.fill}
          strokeColor={palette.stroke}
          strokeWidth={2}
        />
      );
    }

    // Polygon zone — resolve coordinates handling multiple API response shapes
    const coords = resolveCoordinates(zone);
    if (coords && coords.length > 2) {
      return (
        <Polygon
          key={`zone-${zone.id}`}
          coordinates={coords.map(([lng, lat]) => ({ latitude: lat, longitude: lng }))}
          fillColor={palette.fill}
          strokeColor={palette.stroke}
          strokeWidth={2}
          tappable={false}
        />
      );
    }

    return null;
  };

  // ── Zone label markers ────────────────────────────────
  const renderZoneLabel = (zone: ZoneWithStatus) => {
    const risk   = zone.status?.risk_level ?? 'LOW';
    const coords = resolveCoordinates(zone);
    const center = resolveCenter(zone, coords);
    if (!center) return null;
    return (
      <Marker
        key={`label-${zone.id}`}
        coordinate={{ latitude: center.lat, longitude: center.lon }}
        anchor={{ x: 0.5, y: 0.5 }}
        tracksViewChanges={false}
      >
        <View style={[styles.zoneLabel, { borderColor: ZONE_COLORS[risk].stroke }]}>
          <Text style={[styles.zoneLabelText, { color: ZONE_COLORS[risk].stroke }]}>
            {zone.name}
          </Text>
        </View>
      </Marker>
    );
  };

  // ── Map style ─────────────────────────────────────────
  // Satellite mode ignores customMapStyle (Google Maps renders satellite tiles)
  const customStyle = theme === 'dark' && mapType === 'standard' ? darkMapStyle : [];

  return (
    <SafeAreaView style={[styles.container, t.bg]} edges={['top']}>

      {/* ── Search bar ─────────────────────────────── */}
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
            <TouchableOpacity
              onPress={handleClearSearch}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon.X size={16} color={t.C.textMuted} />
            </TouchableOpacity>
          )}
          {searching && (
            <ActivityIndicator size="small" color={t.C.primary} style={{ marginLeft: 4 }} />
          )}
        </View>

        {/* Layers / map-type toggle button */}
        <TouchableOpacity
          style={[
            styles.layersBtn, t.surface, t.border,
            showLayersPanel && { borderColor: t.C.primary, backgroundColor: 'rgba(59,130,246,0.1)' },
          ]}
          onPress={() => {
            setShowLayersPanel((p) => !p);
            Keyboard.dismiss();
            setSearchResults([]);
          }}
        >
          <Icon.Layers size={18} color={showLayersPanel ? t.C.primary : t.C.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* ── Search results ─────────────────────────── */}
      {searchResults.length > 0 && (
        <Animated.View
          entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)}
          style={[styles.dropdown, t.surface, t.border]}
        >
          <FlatList
            data={searchResults}
            keyExtractor={(item) => String(item.place_id)}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              // Build sub-line: area/suburb + state + country
              const addr = item.address;
              const parts = [
                addr?.road ?? addr?.suburb,
                addr?.city,
                addr?.state,
                addr?.country,
              ].filter(Boolean).slice(0, 3).join(', ');
              return (
                <TouchableOpacity
                  style={styles.dropdownItem}
                  onPress={() => handleSelectResult(item)}
                >
                  <View style={styles.dropdownIcon}>
                    <Icon.MapPin size={14} color={t.C.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.dropdownTitle, t.textPrimary]} numberOfLines={1}>
                      {item.display_name.split(',')[0]}
                    </Text>
                    <Text style={[styles.dropdownSub, t.textMuted]} numberOfLines={1}>
                      {parts || item.display_name.split(',').slice(1, 3).join(',')}
                    </Text>
                  </View>
                  {/* Distance badge */}
                  {item._distanceKm != null && (
                    <View style={[styles.distanceBadge, { backgroundColor: `${t.C.primary}18` }]}>
                      <Text style={[styles.distanceText, { color: t.C.primary }]}>
                        {formatDistance(item._distanceKm)}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            }}
            ItemSeparatorComponent={() => (
              <View style={[styles.separator, { backgroundColor: t.C.border }]} />
            )}
          />
        </Animated.View>
      )}

      {/* ── Layers panel: zone legend + map type ───── */}
      {showLayersPanel && (
        <Animated.View
          entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)}
          style={[styles.layersPanel, t.surface, t.border]}
        >
          {/* Map type */}
          <Text style={[styles.layersSectionTitle, t.textMuted]}>MAP TYPE</Text>
          <View style={styles.mapTypeRow}>
            {(['standard', 'satellite'] as MapType[]).map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.mapTypeBtn,
                  { borderColor: t.C.border, backgroundColor: t.C.surfaceAlt },
                  mapType === type && { borderColor: t.C.primary, backgroundColor: 'rgba(59,130,246,0.12)' },
                ]}
                onPress={() => setMapType(type)}
              >
                <Text style={{ fontSize: 20 }}>
                  {type === 'standard' ? '🗺' : '🛰'}
                </Text>
                <Text style={[
                  styles.mapTypeLabel,
                  { color: mapType === type ? t.C.primary : t.C.textSecondary },
                ]}>
                  {type === 'standard' ? 'Default' : 'Satellite'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Zone risk legend */}
          <View style={[styles.layersDivider, { backgroundColor: t.C.border }]} />
          <Text style={[styles.layersSectionTitle, t.textMuted]}>ZONE RISK</Text>
          {(['LOW', 'MEDIUM', 'HIGH'] as RiskLevel[]).map((level) => (
            <View key={level} style={styles.legendRow}>
              <View style={[styles.legendSwatch, { backgroundColor: ZONE_COLORS[level].stroke }]} />
              <Text style={[styles.legendLabel, t.textSecondary]}>{level}</Text>
              <View style={[styles.legendFill, { backgroundColor: ZONE_COLORS[level].fill, borderColor: ZONE_COLORS[level].stroke }]} />
            </View>
          ))}
        </Animated.View>
      )}

      {/* ── Map ──────────────────────────────────────── */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={DEFAULT_REGION}
        showsUserLocation
        showsMyLocationButton={false}
        mapType={mapType}
        customMapStyle={customStyle}
      >
        {/* Zone polygons / circles */}
        {zones?.map(renderZone)}

        {/* Zone label markers */}
        {zones?.map(renderZoneLabel)}

        {/* Selected search result pin */}
        {selectedResult && (
          <Marker
            coordinate={{
              latitude:  parseFloat(selectedResult.lat),
              longitude: parseFloat(selectedResult.lon),
            }}
            tracksViewChanges={false}
          >
            <View style={styles.searchPin}>
              <Icon.MapPin size={28} color={t.C.primary} />
              <View style={[styles.searchPinDot, { backgroundColor: t.C.primary }]} />
            </View>
          </Marker>
        )}
      </MapView>

      {/* ── My location button ────────────────────── */}
      <TouchableOpacity
        style={[styles.myLocationBtn, t.surface, t.border]}
        onPress={() => {
          if (myLocation) {
            mapRef.current?.animateToRegion({
              latitude:       myLocation.latitude,
              longitude:      myLocation.longitude,
              latitudeDelta:  0.015,
              longitudeDelta: 0.015,
            }, 600);
          }
          setShowLayersPanel(false);
        }}
      >
        <Icon.MapPin size={20} color={t.C.primary} />
      </TouchableOpacity>

      {/* ── Place detail bottom sheet ─────────────── */}
      {showBottomSheet && selectedResult && (
        <Animated.View
          entering={SlideInDown.springify().damping(18)}
          exiting={SlideOutDown.duration(250)}
          style={[styles.bottomSheet, t.surface, { borderTopColor: t.C.border }]}
        >
          <View style={[styles.sheetHandle, { backgroundColor: t.C.border }]} />

          <View style={styles.sheetContent}>
            {/* Header row */}
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

            {/* Coordinates + distance row */}
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
                <Text style={[styles.coordLabel, t.textMuted]}>Distance</Text>
                <Text style={[styles.coordValue, t.textPrimary]}>
                  {selectedResult._distanceKm != null
                    ? formatDistance(selectedResult._distanceKm)
                    : selectedResult.type}
                </Text>
              </View>
            </View>

            {/* Nearby zones */}
            {zones && zones.length > 0 && (
              <View style={styles.nearbyZones}>
                <Text style={[styles.nearbyZonesTitle, t.textSecondary]}>Zones in area</Text>
                <View style={styles.nearbyZonesRow}>
                  {zones.slice(0, 3).map((z) => (
                    <Badge
                      key={z.id}
                      label={`${z.name} · ${z.status?.risk_level ?? 'LOW'}`}
                      variant={riskVariant(z.status?.risk_level ?? 'LOW')}
                      size="sm"
                    />
                  ))}
                </View>
              </View>
            )}

            {/* Directions CTA */}
            <TouchableOpacity
              style={styles.directionsBtn}
              onPress={handleDirections}
              activeOpacity={0.85}
            >
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

// ─── Dark map style ───────────────────────────────────────
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

  // Search bar
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
  searchInput: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: Typography.sm },
  layersBtn: {
    width: 48, height: 48, borderRadius: Radius.xl,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },

  // Search dropdown
  dropdown: {
    position: 'absolute', top: 116, left: Spacing.base, right: Spacing.base,
    zIndex: 20, borderRadius: Radius.xl, borderWidth: 1,
    maxHeight: 320, overflow: 'hidden',
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
    flexShrink: 0,
  },
  dropdownTitle: { fontSize: Typography.sm, fontFamily: 'Inter_500Medium' },
  dropdownSub:   { fontSize: Typography.xs, fontFamily: 'Inter_400Regular', marginTop: 1 },
  separator:     { height: 1, marginLeft: 56 },
  distanceBadge: {
    paddingHorizontal: 6, paddingVertical: 3,
    borderRadius: Radius.full, flexShrink: 0,
  },
  distanceText: { fontSize: 10, fontFamily: 'SpaceGrotesk_600SemiBold' },

  // Layers panel
  layersPanel: {
    position: 'absolute', top: 116, right: Spacing.base,
    zIndex: 15, borderRadius: Radius.xl, borderWidth: 1,
    padding: Spacing.md, gap: Spacing.sm,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 8,
    minWidth: 180,
  },
  layersSectionTitle: {
    fontSize: 9, fontFamily: 'SpaceGrotesk_700Bold',
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4,
  },
  mapTypeRow:  { flexDirection: 'row', gap: Spacing.xs },
  mapTypeBtn:  {
    flex: 1, alignItems: 'center', gap: 4, paddingVertical: Spacing.sm,
    borderRadius: Radius.lg, borderWidth: 1.5,
  },
  mapTypeLabel: { fontSize: Typography.xs, fontFamily: 'Inter_500Medium' },
  layersDivider:{ height: 1, marginVertical: Spacing.xs },
  legendRow:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  legendSwatch:{ width: 10, height: 10, borderRadius: 5 },
  legendLabel: { flex: 1, fontSize: Typography.xs, fontFamily: 'Inter_500Medium' },
  legendFill:  { width: 20, height: 12, borderRadius: 3, borderWidth: 1 },

  // Zone labels
  zoneLabel: {
    backgroundColor: 'rgba(17,24,39,0.88)', borderRadius: Radius.sm,
    borderWidth: 1, paddingHorizontal: 6, paddingVertical: 3,
  },
  zoneLabelText: { fontSize: 10, fontFamily: 'SpaceGrotesk_700Bold' },

  // Search pin
  searchPin:    { alignItems: 'center' },
  searchPinDot: { width: 8, height: 8, borderRadius: 4, marginTop: -4 },

  // My location button
  myLocationBtn: {
    position: 'absolute', bottom: 180, right: Spacing.base,
    width: 48, height: 48, borderRadius: 24,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 8,
  },

  // Bottom sheet
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
    backgroundColor: 'rgba(59,130,246,0.12)',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  sheetTitle:   { fontSize: Typography.md, fontFamily: 'SpaceGrotesk_700Bold', flex: 1 },
  sheetAddress: { fontSize: Typography.xs, fontFamily: 'Inter_400Regular', marginTop: 2 },
  coordRow:     { flexDirection: 'row', borderRadius: Radius.lg, padding: Spacing.md },
  coordItem:    { flex: 1, alignItems: 'center', gap: 4 },
  coordDivider: { width: 1 },
  coordLabel:   { fontSize: 10, fontFamily: 'Inter_400Regular', textTransform: 'uppercase', letterSpacing: 0.5 },
  coordValue:   { fontSize: Typography.sm, fontFamily: 'SpaceGrotesk_600SemiBold' },
  nearbyZones:      { gap: Spacing.sm },
  nearbyZonesTitle: { fontSize: Typography.xs, fontFamily: 'Inter_500Medium', textTransform: 'uppercase', letterSpacing: 0.5 },
  nearbyZonesRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  directionsBtn: {
    height: 50, backgroundColor: '#3B82F6', borderRadius: Radius.lg,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
  },
  directionsBtnText: { color: '#fff', fontSize: Typography.base, fontFamily: 'SpaceGrotesk_600SemiBold' },
  directionsHint:    { fontSize: Typography.xs, fontFamily: 'Inter_400Regular', textAlign: 'center' },
});