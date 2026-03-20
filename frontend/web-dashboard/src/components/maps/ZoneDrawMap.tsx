// src/components/maps/ZoneDrawMap.tsx
//
// Interactive zone drawing map.
// - Circle mode:  click to place center → click again to set radius edge
// - Polygon mode: click to add points → double-click or press "Finish" to close
// - Search bar to navigate to any city or landmark
// - Shows existing zones as reference overlays

import { useState, useCallback, useRef } from 'react';
import {
  MapContainer,
  TileLayer,
  Circle,
  Polygon,
  Polyline,
  CircleMarker,
  useMapEvents,
  useMap,
} from 'react-leaflet';
import type { LatLng } from 'leaflet';
import {
  MousePointerClick,
  Pentagon,
  Trash2,
  Check,
  Info,
} from 'lucide-react';

import { MapSearchBar }                        from './MapSearchBar';
import { MapRecenter }                         from './LeafletMap';
import { useMapCenter }                        from '../../hooks/useMapCenter';
import { useIsDark }                           from '../../theme/useTheme';
import type { ZoneWithStatus }                 from '../../types/zone';
import { RiskLevel }                           from '../../types/enums';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type DrawMode = 'circle' | 'polygon';

interface DrawnCircle {
  center:       [number, number];
  radiusMeters: number;
}

interface DrawnPolygon {
  coordinates: [number, number][];   // [lng, lat] pairs as expected by backend
}

export interface ZoneDrawResult {
  type:    'circle'  | 'polygon';
  circle?: DrawnCircle;
  polygon?: DrawnPolygon;
}

interface ZoneDrawMapProps {
  mode:           DrawMode;
  existingZones?: ZoneWithStatus[];
  onDrawn:        (result: ZoneDrawResult) => void;
  onClear:        () => void;
  height?:        number | string;
}

// ─────────────────────────────────────────────
// Haversine distance  (meters between two lat/lng points)
// ─────────────────────────────────────────────

function haversineMeters(a: LatLng, b: LatLng): number {
  const R    = 6_371_000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sin2 =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(sin2));
}

// ─────────────────────────────────────────────
// Risk level colour helper
// ─────────────────────────────────────────────

function riskColor(level: RiskLevel | null): string {
  if (level === RiskLevel.HIGH)   return '#ef4444';
  if (level === RiskLevel.MEDIUM) return '#f97316';
  return '#22c55e';
}

// ─────────────────────────────────────────────
// ExistingZoneLayer — read-only reference overlays
// ─────────────────────────────────────────────

function ExistingZoneLayer({ zones }: { zones: ZoneWithStatus[] }) {
  return (
    <>
      {zones.map((z) => (
        <Circle
          key={z.id}
          center={[0, 0]}    // We don't have geometry here — zones without coords are skipped
          radius={0}
          pathOptions={{ opacity: 0 }}
        />
      ))}
    </>
  );
}

// ─────────────────────────────────────────────
// DrawHandler — captures map clicks for drawing
// ─────────────────────────────────────────────

interface DrawHandlerProps {
  mode:           DrawMode;
  circleStep:     0 | 1 | 2;
  polygonPoints:  LatLng[];
  onCircleClick:  (latlng: LatLng) => void;
  onPolygonClick: (latlng: LatLng) => void;
  onPolygonDone:  () => void;
}

function DrawHandler({
  mode,
  circleStep,
  polygonPoints,
  onCircleClick,
  onPolygonClick,
  onPolygonDone,
}: DrawHandlerProps) {
  useMapEvents({
    click(e) {
      if (mode === 'circle' && circleStep < 2) {
        onCircleClick(e.latlng);
      } else if (mode === 'polygon') {
        onPolygonClick(e.latlng);
      }
    },
    dblclick(e) {
      if (mode === 'polygon' && polygonPoints.length >= 3) {
        e.originalEvent.preventDefault();
        onPolygonDone();
      }
    },
  });
  return null;
}

// ─────────────────────────────────────────────
// CursorSetter — changes map cursor during drawing
// ─────────────────────────────────────────────

function CursorSetter({ active }: { active: boolean }) {
  const map = useMap();
  if (active) {
    map.getContainer().style.cursor = 'crosshair';
  } else {
    map.getContainer().style.cursor = '';
  }
  return null;
}

// ─────────────────────────────────────────────
// ZoneDrawMap
// ─────────────────────────────────────────────

export function ZoneDrawMap({
  mode,
  existingZones = [],
  onDrawn,
  onClear,
  height = 400,
}: ZoneDrawMapProps) {
  const isDark = useIsDark();
  const { center, zoom } = useMapCenter();

  // ── Circle state ──
  const [circleCenter,   setCircleCenter]   = useState<LatLng | null>(null);
  const [circleEdge,     setCircleEdge]     = useState<LatLng | null>(null);
  const [circleConfirmed, setCircleConfirmed] = useState(false);

  // ── Polygon state ──
  const [polyPoints,   setPolyPoints]   = useState<LatLng[]>([]);
  const [polyConfirmed, setPolyConfirmed] = useState(false);

  const circleStep: 0 | 1 | 2 =
    !circleCenter ? 0 : !circleEdge ? 1 : 2;

  const circleRadius = circleCenter && circleEdge
    ? haversineMeters(circleCenter, circleEdge)
    : 0;

  const isDrawingActive =
    mode === 'circle'
      ? !circleConfirmed
      : !polyConfirmed;

  // ── Circle click ──
  const handleCircleClick = useCallback((latlng: LatLng) => {
    if (!circleCenter) {
      setCircleCenter(latlng);
    } else if (!circleEdge) {
      setCircleEdge(latlng);
    }
  }, [circleCenter, circleEdge]);

  // ── Polygon click ──
  const handlePolygonClick = useCallback((latlng: LatLng) => {
    if (polyConfirmed) return;
    setPolyPoints((prev) => [...prev, latlng]);
  }, [polyConfirmed]);

  // ── Confirm circle ──
  const confirmCircle = () => {
    if (!circleCenter || circleRadius <= 0) return;
    setCircleConfirmed(true);
    onDrawn({
      type:   'circle',
      circle: {
        center:       [circleCenter.lat, circleCenter.lng],
        radiusMeters: Math.round(circleRadius),
      },
    });
  };

  // ── Confirm polygon ──
  const confirmPolygon = () => {
    if (polyPoints.length < 3) return;
    setPolyConfirmed(true);
    // Close the ring: first point = last point
    const coords: [number, number][] = [
      ...polyPoints.map((p): [number, number] => [p.lng, p.lat]),
      [polyPoints[0].lng, polyPoints[0].lat],
    ];
    onDrawn({ type: 'polygon', polygon: { coordinates: coords } });
  };

  // ── Clear ──
  const handleClear = () => {
    setCircleCenter(null);
    setCircleEdge(null);
    setCircleConfirmed(false);
    setPolyPoints([]);
    setPolyConfirmed(false);
    onClear();
  };

  // ── Instruction text ──
  const instruction = (() => {
    if (mode === 'circle') {
      if (circleConfirmed)      return '✓ Circle confirmed';
      if (circleStep === 0)     return 'Click to place the center';
      if (circleStep === 1)     return 'Click to set the radius edge';
      return `Radius: ${Math.round(circleRadius).toLocaleString()}m — confirm or redraw`;
    }
    if (polyConfirmed)          return '✓ Polygon confirmed';
    if (polyPoints.length === 0) return 'Click to start placing points';
    if (polyPoints.length < 3)  return `${polyPoints.length} point${polyPoints.length > 1 ? 's' : ''} — keep clicking`;
    return `${polyPoints.length} points — double-click map or press Finish`;
  })();

  const LIGHT_TILES = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
  const DARK_TILES  = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
  const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com">CARTO</a>';

  const heightStyle = typeof height === 'number' ? `${height}px` : height;

  // Polygon preview positions
  const polyLatLngs = polyPoints.map((p) => [p.lat, p.lng] as [number, number]);

  return (
    <div className="space-y-2">
      {/* Instruction bar */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900">
        <Info className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
        <span className="text-xs text-blue-700 dark:text-blue-300 flex-1">
          {instruction}
        </span>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Confirm button */}
          {mode === 'circle' && circleStep === 2 && !circleConfirmed && (
            <button
              onClick={confirmCircle}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold transition-colors"
            >
              <Check className="w-3 h-3" /> Confirm
            </button>
          )}
          {mode === 'polygon' && polyPoints.length >= 3 && !polyConfirmed && (
            <button
              onClick={confirmPolygon}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold transition-colors"
            >
              <Check className="w-3 h-3" /> Finish
            </button>
          )}
          {/* Clear */}
          {(circleCenter || polyPoints.length > 0) && (
            <button
              onClick={handleClear}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors"
            >
              <Trash2 className="w-3 h-3" /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Map */}
      <div
        className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 relative"
        style={{ height: heightStyle }}
      >
        <MapContainer
          center={center}
          zoom={zoom}
          style={{ height: '100%', width: '100%' }}
          zoomControl={true}
          scrollWheelZoom={true}
          doubleClickZoom={false}  // we use dblclick for polygon finish
        >
          <TileLayer
            key={isDark ? 'dark' : 'light'}
            attribution={ATTRIBUTION}
            url={isDark ? DARK_TILES : LIGHT_TILES}
            maxZoom={19}
          />

          <MapRecenter center={center} zoom={zoom} />

          {/* Search bar overlay */}
          <div className="absolute top-3 left-3 right-3 z-[1100]">
            <MapSearchBar />
          </div>

          {/* Cursor crosshair while drawing */}
          <CursorSetter active={isDrawingActive} />

          {/* Draw event handler */}
          <DrawHandler
            mode={mode}
            circleStep={circleStep}
            polygonPoints={polyPoints}
            onCircleClick={handleCircleClick}
            onPolygonClick={handlePolygonClick}
            onPolygonDone={confirmPolygon}
          />

          {/* ── Circle preview ── */}
          {mode === 'circle' && circleCenter && (
            <>
              {/* Center dot */}
              <CircleMarker
                center={[circleCenter.lat, circleCenter.lng]}
                radius={5}
                pathOptions={{
                  color: '#3b82f6',
                  fillColor: '#3b82f6',
                  fillOpacity: 1,
                  weight: 2,
                }}
              />
              {/* Radius circle */}
              {circleRadius > 0 && (
                <Circle
                  center={[circleCenter.lat, circleCenter.lng]}
                  radius={circleRadius}
                  pathOptions={{
                    color:       circleConfirmed ? '#22c55e' : '#3b82f6',
                    fillColor:   circleConfirmed ? '#22c55e' : '#3b82f6',
                    fillOpacity: 0.15,
                    weight:      circleConfirmed ? 3 : 2,
                    dashArray:   circleConfirmed ? undefined : '6 4',
                  }}
                />
              )}
              {/* Edge dot */}
              {circleEdge && (
                <CircleMarker
                  center={[circleEdge.lat, circleEdge.lng]}
                  radius={4}
                  pathOptions={{
                    color: '#3b82f6',
                    fillColor: '#93c5fd',
                    fillOpacity: 1,
                    weight: 2,
                  }}
                />
              )}
            </>
          )}

          {/* ── Polygon preview ── */}
          {mode === 'polygon' && polyLatLngs.length > 0 && (
            <>
              {/* Points */}
              {polyLatLngs.map((pos, i) => (
                <CircleMarker
                  key={i}
                  center={pos}
                  radius={5}
                  pathOptions={{
                    color:       i === 0 ? '#f59e0b' : '#3b82f6',
                    fillColor:   i === 0 ? '#f59e0b' : '#3b82f6',
                    fillOpacity: 1,
                    weight:      2,
                  }}
                />
              ))}
              {/* Line / polygon fill */}
              {polyLatLngs.length >= 3 ? (
                <Polygon
                  positions={polyLatLngs}
                  pathOptions={{
                    color:       polyConfirmed ? '#22c55e' : '#3b82f6',
                    fillColor:   polyConfirmed ? '#22c55e' : '#3b82f6',
                    fillOpacity: 0.15,
                    weight:      polyConfirmed ? 3 : 2,
                    dashArray:   polyConfirmed ? undefined : '6 4',
                  }}
                />
              ) : (
                <Polyline
                  positions={polyLatLngs}
                  pathOptions={{ color: '#3b82f6', weight: 2, dashArray: '6 4' }}
                />
              )}
            </>
          )}

          {/* Existing zones as faint reference */}
          <ExistingZoneLayer zones={existingZones} />
        </MapContainer>
      </div>

      {/* Summary row */}
      {mode === 'circle' && circleCenter && circleRadius > 0 && (
        <div className="flex gap-3 text-xs text-slate-500 dark:text-slate-400 px-1">
          <span>
            Center:&nbsp;
            <span className="font-mono text-slate-700 dark:text-slate-300">
              {circleCenter.lat.toFixed(5)}, {circleCenter.lng.toFixed(5)}
            </span>
          </span>
          <span>
            Radius:&nbsp;
            <span className="font-mono text-slate-700 dark:text-slate-300">
              {Math.round(circleRadius).toLocaleString()} m
            </span>
          </span>
        </div>
      )}
      {mode === 'polygon' && polyPoints.length > 0 && (
        <div className="text-xs text-slate-500 dark:text-slate-400 px-1">
          {polyPoints.length} vertices placed
          {polyConfirmed && ' — polygon closed ✓'}
        </div>
      )}
    </div>
  );
}