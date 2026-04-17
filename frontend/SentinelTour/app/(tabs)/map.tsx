// app/(tabs)/map.tsx
import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput,
  TouchableOpacity, FlatList, ActivityIndicator,
  Linking, Platform, Keyboard,
} from 'react-native';
import * as MapLibreGL from '@maplibre/maplibre-react-native';
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

// Suppress the "No API key" warning from MapLibre
MapLibreGL.setAccessToken(null);

// ─── OSM tile style ───────────────────────────────────────
const OSM_STYLE = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: 'osm-tiles',
      type: 'raster',
      source: 'osm',
      minzoom: 0,
      maxzoom: 19,
    },
  ],
} as any;

interface NominatimResult {
  place_id:      number;
  display_name:  string;
  lat:           string;
  lon:           string;
  type:          string;
  class:         string;
  importance?:   number;
  place_rank?:   number;
  extratags?: {
    tourism?:       string;
    historic?:      string;
    amenity?:       string;
    wikipedia?:     string;
    wikidata?:      string;
    opening_hours?: string;
    [key: string]:  string | undefined;
  };
  address?: {
    road?: string; suburb?: string; city?: string;
    state?: string; country?: string;
  };
  namedetails?: { [key: string]: string };
  _distanceKm?:   number;
  _score?:        number;
  _distanceTier?: 'walking' | 'cycling' | 'driving';
  _isClosed?:     boolean;
  _hasWiki?:      boolean;
  _isTourism?:    boolean;
}

const ZONE_COLORS: Record<RiskLevel, { fill: string; stroke: string }> = {
  LOW:    { fill: 'rgba(16,185,129,0.14)',  stroke: '#10b981' },
  MEDIUM: { fill: 'rgba(245,158,11,0.16)',  stroke: '#f59e0b' },
  HIGH:   { fill: 'rgba(239,68,68,0.20)',   stroke: '#ef4444' },
};

const DEFAULT_CENTER: [number, number] = [78.9629, 20.5937]; // [lon, lat]
const DEFAULT_ZOOM = 4;

// ─── Helpers ──────────────────────────────────────────────
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
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

function distanceTier(km: number): 'walking' | 'cycling' | 'driving' {
  if (km <= 1) return 'walking';
  if (km <= 3) return 'cycling';
  return 'driving';
}

function isLikelyOpen(oh?: string): boolean | null {
  if (!oh) return null;
  if (oh.toLowerCase() === '24/7') return true;
  if (oh.toLowerCase() === 'closed') return false;
  return null;
}

const TOURISM_CLASSES = new Set(['tourism', 'historic', 'leisure', 'natural', 'amenity']);
const TOURISM_TYPES   = new Set([
  'museum', 'attraction', 'viewpoint', 'artwork', 'gallery',
  'zoo', 'theme_park', 'aquarium', 'monument', 'ruins',
  'castle', 'fort', 'heritage', 'archaeological_site',
]);

function isTourismResult(r: NominatimResult): boolean {
  return TOURISM_CLASSES.has(r.class) || TOURISM_TYPES.has(r.type) ||
    !!r.extratags?.tourism || !!r.extratags?.historic;
}

function scoreResult(r: NominatimResult): number {
  let score = (r.importance ?? 0) * 100;
  if (r._isTourism)             score *= 1.5;
  if (r._hasWiki)               score += 20;
  const rank = r.place_rank ?? 30;
  if (rank <= 12)               score += 15;
  else if (rank <= 16)          score += 8;
  if (r._distanceTier === 'walking') score += 10;
  else if (r._distanceTier === 'cycling') score += 5;
  if (r._isClosed === true)     score -= 15;
  return score;
}

// ─── Zone GeoJSON builders ────────────────────────────────
function resolveCoordinates(zone: ZoneWithStatus): Array<[number, number]> | null {
  const raw = zone.geometry as any;
  if (!raw) return null;
  if (Array.isArray(raw) && Array.isArray(raw[0])) return raw;
  if (raw?.type === 'Polygon')      return raw.coordinates?.[0] ?? null;
  if (raw?.type === 'MultiPolygon') return raw.coordinates?.[0]?.[0] ?? null;
  return null;
}

function resolveCenter(zone: ZoneWithStatus, coords: Array<[number, number]> | null) {
  if (zone.center_latitude != null && zone.center_longitude != null)
    return { lat: zone.center_latitude, lon: zone.center_longitude };
  if (!coords || coords.length === 0) return null;
  const sum = coords.reduce((a, [lon, lat]) => ({ lon: a.lon + lon, lat: a.lat + lat }), { lon: 0, lat: 0 });
  return { lat: sum.lat / coords.length, lon: sum.lon / coords.length };
}

function zonesToGeoJSON(zones: ZoneWithStatus[], risk: RiskLevel) {
  const features = zones
    .filter((z) => (z.status?.risk_level ?? 'LOW') === risk)
    .map((z) => {
      const coords = resolveCoordinates(z);
      if (z.radius_meters && z.center_latitude && z.center_longitude) {
        // Approximate circle as polygon (36 points)
        const cx = z.center_longitude, cy = z.center_latitude, r = z.radius_meters / 111320;
        const pts = Array.from({ length: 36 }, (_, i) => {
          const a = (i * 10 * Math.PI) / 180;
          return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as [number, number];
        });
        pts.push(pts[0]);
        return { type: 'Feature', properties: { id: z.id, name: z.name }, geometry: { type: 'Polygon', coordinates: [pts] } };
      }
      if (coords && coords.length > 2) {
        const ring = [...coords];
        if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) ring.push(ring[0]);
        return { type: 'Feature', properties: { id: z.id, name: z.name }, geometry: { type: 'Polygon', coordinates: [ring] } };
      }
      return null;
    })
    .filter(Boolean);
  return { type: 'FeatureCollection', features };
}

function tierLabel(tier?: string) {
  if (tier === 'walking') return '🚶';
  if (tier === 'cycling') return '🚲';
  return '🚗';
}

// ─── Main screen ──────────────────────────────────────────
export default function MapScreen() {
  const t = useThemedStyles();
  const { theme } = useTheme();
  const cameraRef = useRef<any>(null);

  const [mapBounds, setMapBounds]       = useState<{ ne: [number,number]; sw: [number,number] } | null>(null);
  const [searchQuery, setSearchQuery]   = useState('');
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([]);
  const [searching, setSearching]       = useState(false);
  const [selectedResult, setSelectedResult] = useState<NominatimResult | null>(null);
  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const [showLayersPanel, setShowLayersPanel] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const userLang = useRef<string>(
    (() => {
      try { return Intl.DateTimeFormat().resolvedOptions().locale?.split('-')[0] ?? 'en'; }
      catch { return 'en'; }
    })()
  );

  const { data: zones } = useQuery({
    queryKey: ['zones'], queryFn: zonesApi.list, staleTime: 60_000,
  });

  const { data: myLocation } = useQuery({
    queryKey: ['location', 'me'],
    queryFn: locationApi.getMyLocation,
    refetchInterval: 30_000,
    retry: false,
  });

  // Fly to user on first load
  useEffect(() => {
    if (myLocation && cameraRef.current) {
      cameraRef.current.setCamera({
        centerCoordinate: [myLocation.longitude, myLocation.latitude],
        zoomLevel: 14,
        animationDuration: 800,
      });
    }
  }, [myLocation?.latitude, myLocation?.longitude]);

  // ── Search ────────────────────────────────────────────
  const handleSearch = useCallback((text: string) => {
    setSearchQuery(text);
    setSelectedResult(null);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (text.trim().length < 3) { setSearchResults([]); return; }
    setSearching(true);

    searchTimeout.current = setTimeout(async () => {
      try {
        const lang = userLang.current;
        let viewbox: string | null = null;
        let bounded = '0';

        if (mapBounds) {
          const { ne, sw } = mapBounds;
          viewbox = `${sw[0]},${ne[1]},${ne[0]},${sw[1]}`;
          bounded = '1';
        }

        const params = new URLSearchParams({
          format: 'jsonv2', q: text, limit: '5',
          addressdetails: '1', extratags: '1', namedetails: '1',
          'accept-language': lang,
          ...(viewbox ? { viewbox, bounded } : {}),
        });

        const res  = await fetch(`${Config.NOMINATIM_URL}/search?${params}`, {
          headers: { 'User-Agent': 'SentinelTour/1.0' },
        });
        let data: NominatimResult[] = await res.json();

        // Fallback: unbounded with location hint
        if (data.length < 2 && myLocation && viewbox) {
          const fb = new URLSearchParams({
            format: 'jsonv2', q: text, limit: '5',
            addressdetails: '1', extratags: '1', namedetails: '1',
            'accept-language': lang, viewbox, bounded: '0',
            lat: String(myLocation.latitude), lon: String(myLocation.longitude),
          });
          const fbRes  = await fetch(`${Config.NOMINATIM_URL}/search?${fb}`, {
            headers: { 'User-Agent': 'SentinelTour/1.0' },
          });
          const fbData: NominatimResult[] = await fbRes.json();
          const ids = new Set(data.map((r) => r.place_id));
          data = [...data, ...fbData.filter((r) => !ids.has(r.place_id))].slice(0, 5);
        }

        const origin = myLocation
          ? { lat: myLocation.latitude, lon: myLocation.longitude }
          : mapBounds
            ? { lat: (mapBounds.ne[1] + mapBounds.sw[1]) / 2, lon: (mapBounds.ne[0] + mapBounds.sw[0]) / 2 }
            : { lat: DEFAULT_CENTER[1], lon: DEFAULT_CENTER[0] };

        const annotated: NominatimResult[] = data.map((r) => {
          const rLat = parseFloat(r.lat), rLon = parseFloat(r.lon);
          const km   = haversineKm(origin.lat, origin.lon, rLat, rLon);
          const enriched: NominatimResult = {
            ...r,
            _distanceKm:   km,
            _distanceTier: distanceTier(km),
            _isTourism:    isTourismResult(r),
            _hasWiki:      !!(r.extratags?.wikipedia || r.extratags?.wikidata),
            _isClosed:     isLikelyOpen(r.extratags?.opening_hours) === false ? true : undefined,
          };
          let s = scoreResult(enriched);
          if (r.namedetails?.[`name:${lang}`]) s += 8;
          enriched._score = s;
          return enriched;
        });

        const tierOrder = { walking: 0, cycling: 1, driving: 2 };
        annotated.sort((a, b) => {
          const td = tierOrder[a._distanceTier ?? 'driving'] - tierOrder[b._distanceTier ?? 'driving'];
          if (td !== 0) return td;
          if (a._isClosed && !b._isClosed) return 1;
          if (!a._isClosed && b._isClosed) return -1;
          return (b._score ?? 0) - (a._score ?? 0);
        });

        setSearchResults(annotated);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 450);
  }, [myLocation, mapBounds]);

  const handleSelectResult = (result: NominatimResult) => {
    setSelectedResult(result);
    setSearchResults([]);
    setSearchQuery(result.display_name.split(',')[0]);
    Keyboard.dismiss();
    setShowBottomSheet(true);
    setShowLayersPanel(false);
    cameraRef.current?.setCamera({
      centerCoordinate: [parseFloat(result.lon), parseFloat(result.lat)],
      zoomLevel: 15,
      animationDuration: 800,
    });
  };

  const handleClearSearch = () => {
    setSearchQuery(''); setSearchResults([]);
    setSelectedResult(null); setShowBottomSheet(false);
  };

  const handleDirections = () => {
    if (!selectedResult) return;
    const { lat, lon } = selectedResult;
    const label = encodeURIComponent(selectedResult.display_name.split(',')[0]);
    const osmUrl = `https://www.openstreetmap.org/directions?to=${lat},${lon}`;
    const nativeUrl = Platform.select({
      ios:     `maps:0,0?q=${label}@${lat},${lon}`,
      android: `geo:${lat},${lon}?q=${lat},${lon}(${label})`,
    });
    if (nativeUrl) {
      Linking.canOpenURL(nativeUrl)
        .then((can) => Linking.openURL(can ? nativeUrl : osmUrl))
        .catch(() => Linking.openURL(osmUrl));
    } else {
      Linking.openURL(osmUrl).catch(() => {});
    }
  };

  // ── Zone layers as GeoJSON ────────────────────────────
  const renderZoneLayers = () => {
    if (!zones) return null;
    return (['LOW', 'MEDIUM', 'HIGH'] as RiskLevel[]).map((risk) => {
      const geojson = zonesToGeoJSON(zones, risk);
      if (geojson.features.length === 0) return null;
      const { fill, stroke } = ZONE_COLORS[risk];
      return (
        <MapLibreGL.ShapeSource key={`zones-${risk}`} id={`zones-${risk}`} shape={geojson as any}>
          <MapLibreGL.FillLayer
            id={`fill-${risk}`}
            style={{ fillColor: fill, fillOutlineColor: stroke }}
          />
          <MapLibreGL.LineLayer
            id={`line-${risk}`}
            style={{ lineColor: stroke, lineWidth: 2 }}
          />
        </MapLibreGL.ShapeSource>
      );
    });
  };

  // ── Zone label markers ────────────────────────────────
  const renderZoneLabels = () => {
    if (!zones) return null;
    return zones.map((zone) => {
      const coords = resolveCoordinates(zone);
      const center = resolveCenter(zone, coords);
      if (!center) return null;
      const risk = zone.status?.risk_level ?? 'LOW';
      return (
        <MapLibreGL.MarkerView
          key={`label-${zone.id}`}
          coordinate={[center.lon, center.lat]}
          anchor={{ x: 0.5, y: 0.5 }}
        >
          <View style={[styles.zoneLabel, { borderColor: ZONE_COLORS[risk].stroke }]}>
            <Text style={[styles.zoneLabelText, { color: ZONE_COLORS[risk].stroke }]}>
              {zone.name}
            </Text>
          </View>
        </MapLibreGL.MarkerView>
      );
    });
  };

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
            <TouchableOpacity onPress={handleClearSearch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Icon.X size={16} color={t.C.textMuted} />
            </TouchableOpacity>
          )}
          {searching && <ActivityIndicator size="small" color={t.C.primary} style={{ marginLeft: 4 }} />}
        </View>
        <TouchableOpacity
          style={[styles.layersBtn, t.surface, t.border, showLayersPanel && { borderColor: t.C.primary, backgroundColor: 'rgba(59,130,246,0.1)' }]}
          onPress={() => { setShowLayersPanel((p) => !p); Keyboard.dismiss(); setSearchResults([]); }}
        >
          <Icon.Layers size={18} color={showLayersPanel ? t.C.primary : t.C.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* ── Search results ─────────────────────────── */}
      {searchResults.length > 0 && (
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} style={[styles.dropdown, t.surface, t.border]}>
          <FlatList
            data={searchResults}
            keyExtractor={(item) => String(item.place_id)}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const addr  = item.address;
              const parts = [addr?.road ?? addr?.suburb, addr?.city, addr?.state, addr?.country]
                .filter(Boolean).slice(0, 3).join(', ');
              const closed = item._isClosed === true;
              return (
                <TouchableOpacity
                  style={[styles.dropdownItem, closed && { opacity: 0.5 }]}
                  onPress={() => { if (!closed) handleSelectResult(item); }}
                  activeOpacity={closed ? 0.5 : 0.7}
                >
                  <View style={styles.dropdownIcon}>
                    <Icon.MapPin size={14} color={closed ? t.C.textMuted : t.C.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Text style={[styles.dropdownTitle, closed ? t.textMuted : t.textPrimary]} numberOfLines={1}>
                        {item.display_name.split(',')[0]}
                      </Text>
                      {item._isTourism && <Text style={{ fontSize: 12 }}>{item._hasWiki ? '🏛' : '📍'}</Text>}
                    </View>
                    <Text style={[styles.dropdownSub, t.textMuted]} numberOfLines={1}>
                      {parts || item.display_name.split(',').slice(1, 3).join(',')}
                    </Text>
                    {closed && <Text style={{ fontSize: 10, color: '#ef4444', marginTop: 2 }}>Closed</Text>}
                  </View>
                  {item._distanceKm != null && (
                    <View style={[styles.distanceBadge, { backgroundColor: `${t.C.primary}18` }]}>
                      <Text style={{ fontSize: 10 }}>{tierLabel(item._distanceTier)}</Text>
                      <Text style={[styles.distanceText, { color: t.C.primary }]}>{formatDistance(item._distanceKm)}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            }}
            ItemSeparatorComponent={() => <View style={[{ height: 1, marginLeft: 56 }, { backgroundColor: t.C.border }]} />}
          />
        </Animated.View>
      )}

      {/* ── Layers panel ───────────────────────────── */}
      {showLayersPanel && (
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} style={[styles.layersPanel, t.surface, t.border]}>
          <Text style={[styles.layersSectionTitle, t.textMuted]}>ZONE RISK</Text>
          {(['LOW', 'MEDIUM', 'HIGH'] as RiskLevel[]).map((level) => (
            <View key={level} style={styles.legendRow}>
              <View style={[styles.legendSwatch, { backgroundColor: ZONE_COLORS[level].stroke }]} />
              <Text style={[styles.legendLabel, t.textSecondary]}>{level}</Text>
              <View style={[styles.legendFill, { backgroundColor: ZONE_COLORS[level].fill, borderColor: ZONE_COLORS[level].stroke }]} />
            </View>
          ))}
          <View style={[{ height: 1, marginVertical: Spacing.xs }, { backgroundColor: t.C.border }]} />
          <Text style={[styles.layersSectionTitle, t.textMuted]}>POWERED BY</Text>
          <Text style={[{ fontSize: 9, fontFamily: 'Inter_400Regular' }, t.textMuted]}>© OpenStreetMap contributors</Text>
        </Animated.View>
      )}

      {/* ── Map ──────────────────────────────────────── */}
      <MapLibreGL.MapView
        style={styles.map}
        mapStyle={OSM_STYLE}
        logoEnabled={false}
        attributionEnabled={false}
        onRegionDidChange={async (feature) => {
          try {
            const [w, s, e, n] = feature.properties.visibleBounds.flat();
            setMapBounds({ ne: [e, n], sw: [w, s] });
          } catch {}
        }}
      >
        <MapLibreGL.Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: DEFAULT_CENTER,
            zoomLevel: DEFAULT_ZOOM,
          }}
        />

        {/* User location */}
        <MapLibreGL.UserLocation visible renderMode="normal" />

        {/* Zone fills + outlines */}
        {renderZoneLayers()}

        {/* Zone labels */}
        {renderZoneLabels()}

        {/* Selected search pin */}
        {selectedResult && (
          <MapLibreGL.MarkerView
            coordinate={[parseFloat(selectedResult.lon), parseFloat(selectedResult.lat)]}
            anchor={{ x: 0.5, y: 1 }}
          >
            <View style={styles.searchPin}>
              <Icon.MapPin size={28} color={t.C.primary} />
              <View style={[styles.searchPinDot, { backgroundColor: t.C.primary }]} />
            </View>
          </MapLibreGL.MarkerView>
        )}
      </MapLibreGL.MapView>

      {/* ── My location button ────────────────────── */}
      <TouchableOpacity
        style={[styles.myLocationBtn, t.surface, t.border]}
        onPress={() => {
          if (myLocation) {
            cameraRef.current?.setCamera({
              centerCoordinate: [myLocation.longitude, myLocation.latitude],
              zoomLevel: 14, animationDuration: 600,
            });
          }
          setShowLayersPanel(false);
        }}
      >
        <Icon.MapPin size={20} color={t.C.primary} />
      </TouchableOpacity>

      {/* ── Bottom sheet ─────────────────────────── */}
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
                <Text style={[styles.coordValue, t.textPrimary]}>{parseFloat(selectedResult.lat).toFixed(5)}</Text>
              </View>
              <View style={[styles.coordDivider, { backgroundColor: t.C.border }]} />
              <View style={styles.coordItem}>
                <Text style={[styles.coordLabel, t.textMuted]}>Longitude</Text>
                <Text style={[styles.coordValue, t.textPrimary]}>{parseFloat(selectedResult.lon).toFixed(5)}</Text>
              </View>
              <View style={[styles.coordDivider, { backgroundColor: t.C.border }]} />
              <View style={styles.coordItem}>
                <Text style={[styles.coordLabel, t.textMuted]}>Distance</Text>
                <Text style={[styles.coordValue, t.textPrimary]}>
                  {selectedResult._distanceKm != null ? formatDistance(selectedResult._distanceKm) : selectedResult.type}
                </Text>
              </View>
            </View>

            {(selectedResult._isTourism || selectedResult._hasWiki || selectedResult.extratags?.opening_hours) && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs }}>
                {selectedResult._isTourism && (
                  <View style={[styles.tagChip, { backgroundColor: 'rgba(59,130,246,0.12)' }]}>
                    <Text style={[styles.tagText, { color: t.C.primary }]}>
                      {selectedResult.extratags?.tourism || selectedResult.extratags?.historic || 'tourist spot'}
                    </Text>
                  </View>
                )}
                {selectedResult._hasWiki && (
                  <View style={[styles.tagChip, { backgroundColor: 'rgba(16,185,129,0.12)' }]}>
                    <Text style={[styles.tagText, { color: '#10b981' }]}>Wikipedia</Text>
                  </View>
                )}
                {selectedResult.extratags?.opening_hours && (
                  <View style={[styles.tagChip, { backgroundColor: 'rgba(245,158,11,0.12)' }]}>
                    <Text style={[styles.tagText, { color: '#f59e0b' }]}>{selectedResult.extratags.opening_hours}</Text>
                  </View>
                )}
              </View>
            )}

            {zones && zones.length > 0 && (
              <View style={{ gap: Spacing.sm }}>
                <Text style={[{ fontSize: Typography.xs, fontFamily: 'Inter_500Medium', textTransform: 'uppercase', letterSpacing: 0.5 }, t.textSecondary]}>
                  Zones in area
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs }}>
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
            <Text style={[styles.directionsHint, t.textMuted]}>Opens maps app or OpenStreetMap</Text>
          </View>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1 },
  map:          { flex: 1 },
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
  searchInput:  { flex: 1, fontFamily: 'Inter_400Regular', fontSize: Typography.sm },
  layersBtn: {
    width: 48, height: 48, borderRadius: Radius.xl, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
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
    backgroundColor: 'rgba(59,130,246,0.1)', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  dropdownTitle: { fontSize: Typography.sm, fontFamily: 'Inter_500Medium', flexShrink: 1 },
  dropdownSub:   { fontSize: Typography.xs, fontFamily: 'Inter_400Regular', marginTop: 1 },
  distanceBadge: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: Radius.full, flexShrink: 0, alignItems: 'center', gap: 2 },
  distanceText:  { fontSize: 10, fontFamily: 'SpaceGrotesk_600SemiBold' },
  layersPanel: {
    position: 'absolute', top: 116, right: Spacing.base,
    zIndex: 15, borderRadius: Radius.xl, borderWidth: 1,
    padding: Spacing.md, gap: Spacing.sm,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 8, minWidth: 180,
  },
  layersSectionTitle: { fontSize: 9, fontFamily: 'SpaceGrotesk_700Bold', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
  legendRow:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  legendSwatch: { width: 10, height: 10, borderRadius: 5 },
  legendLabel:  { flex: 1, fontSize: Typography.xs, fontFamily: 'Inter_500Medium' },
  legendFill:   { width: 20, height: 12, borderRadius: 3, borderWidth: 1 },
  zoneLabel: {
    backgroundColor: 'rgba(17,24,39,0.88)', borderRadius: Radius.sm,
    borderWidth: 1, paddingHorizontal: 6, paddingVertical: 3,
  },
  zoneLabelText: { fontSize: 10, fontFamily: 'SpaceGrotesk_700Bold' },
  searchPin:    { alignItems: 'center' },
  searchPinDot: { width: 8, height: 8, borderRadius: 4, marginTop: -4 },
  myLocationBtn: {
    position: 'absolute', bottom: 180, right: Spacing.base,
    width: 48, height: 48, borderRadius: 24, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 8,
  },
  bottomSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.5, shadowRadius: 20, elevation: 20,
  },
  sheetHandle:  { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 12 },
  sheetContent: { padding: Spacing.base, paddingBottom: 32, gap: Spacing.md },
  sheetHeader:  { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  sheetIconWrap: {
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
  tagChip:      { paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.full },
  tagText:      { fontSize: 11, fontFamily: 'Inter_500Medium', textTransform: 'capitalize' },
  directionsBtn: {
    height: 50, backgroundColor: '#3B82F6', borderRadius: Radius.lg,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
  },
  directionsBtnText: { color: '#fff', fontSize: Typography.base, fontFamily: 'SpaceGrotesk_600SemiBold' },
  directionsHint:    { fontSize: Typography.xs, fontFamily: 'Inter_400Regular', textAlign: 'center' },
});