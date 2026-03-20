// src/components/maps/ZoneOverlay.tsx

import { Circle, Polygon, Tooltip } from 'react-leaflet';
import { riskLevelToColor, riskLevelToFillOpacity } from '../../utils/mapHelpers';
import type { ZoneWithStatus } from '../../types/zone';

// ─────────────────────────────────────────────
// Types
//
// Backend zone geometry is embedded in zone data.
// We expect zones to have either circular (center + radius) or
// polygon (coordinates) geometry via extended props.
// For this component we accept an optional geometry payload.
// ─────────────────────────────────────────────

interface CircularGeometry {
  type:             'circular';
  center_latitude:  number;
  center_longitude: number;
  radius_meters:    number;
}

interface PolygonGeometry {
  type:        'polygon';
  coordinates: [number, number][]; // [lng, lat] pairs
}

export type ZoneGeometry = CircularGeometry | PolygonGeometry;

interface ZoneOverlayProps {
  zone:      ZoneWithStatus;
  geometry:  ZoneGeometry;
  onClick?:  (zone: ZoneWithStatus) => void;
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export function ZoneOverlay({ zone, geometry, onClick }: ZoneOverlayProps) {
  const color   = riskLevelToColor(zone.risk_level ?? null);
  const opacity = riskLevelToFillOpacity(zone.risk_level ?? null);

  const tooltipContent = (
    <div className="text-xs">
      <p className="font-semibold">{zone.name}</p>
      {zone.risk_level && (
        <p className="text-slate-500">{zone.risk_level} risk</p>
      )}
    </div>
  );

  const pathOptions = {
    color,
    fillColor:   color,
    fillOpacity: opacity,
    weight:      2,
    opacity:     0.8,
  };

  const eventHandlers = {
    click: () => onClick?.(zone),
  };

  if (geometry.type === 'circular') {
    return (
      <Circle
        center={[geometry.center_latitude, geometry.center_longitude]}
        radius={geometry.radius_meters}
        pathOptions={pathOptions}
        eventHandlers={eventHandlers}
      >
        <Tooltip>{tooltipContent}</Tooltip>
      </Circle>
    );
  }

  // Polygon: convert [lng, lat] → [lat, lng] for Leaflet
  const latLngs = geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]);

  return (
    <Polygon
      positions={latLngs}
      pathOptions={pathOptions}
      eventHandlers={eventHandlers}
    >
      <Tooltip>{tooltipContent}</Tooltip>
    </Polygon>
  );
}