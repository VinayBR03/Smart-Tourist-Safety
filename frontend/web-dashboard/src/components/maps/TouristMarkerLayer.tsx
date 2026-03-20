// src/components/maps/TouristMarkerLayer.tsx

import { CircleMarker, Tooltip } from 'react-leaflet';
import { formatTimeAgo } from '../../utils/formatDate';
import { LIVE_LOCATION_STALE_MINUTES } from '../../constants/config';
import type { LocationResponse } from '../../types/location';
import { batteryToColor } from '../../utils/mapHelpers';

interface TouristMarkerLayerProps {
  locations:  LocationResponse[];
  onMarkerClick?: (loc: LocationResponse) => void;
}

function isStale(updatedAt: string): boolean {
  const diffMs = Date.now() - new Date(updatedAt).getTime();
  return diffMs > LIVE_LOCATION_STALE_MINUTES * 60 * 1000;
}

export function TouristMarkerLayer({ locations, onMarkerClick }: TouristMarkerLayerProps) {
  return (
    <>
      {locations.map((loc) => {
        const stale   = isStale(loc.updated_at);
        const batColor = batteryToColor(loc.battery_percentage);
        const dotColor = stale ? '#94a3b8' : '#3b82f6';

        return (
          <CircleMarker
            key={loc.tourist_id}
            center={[loc.latitude, loc.longitude]}
            radius={7}
            pathOptions={{
              color:       dotColor,
              fillColor:   dotColor,
              fillOpacity: stale ? 0.4 : 0.85,
              weight:      2,
            }}
            eventHandlers={{
              click: () => onMarkerClick?.(loc),
            }}
          >
            <Tooltip direction="top" offset={[0, -8]}>
              <div className="text-xs min-w-[120px]">
                <p className="font-semibold text-slate-700">Tourist #{loc.tourist_id}</p>
                <p className="text-slate-500 mt-0.5">
                  {formatTimeAgo(loc.updated_at)}
                  {stale && <span className="text-amber-500 ml-1">(stale)</span>}
                </p>
                {loc.battery_percentage != null && (
                  <p style={{ color: batColor }}>
                    Battery: {loc.battery_percentage.toFixed(0)}%
                  </p>
                )}
              </div>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </>
  );
}