// src/components/zones/ZoneForm.tsx

import { useState } from 'react';
import { MousePointerClick, Pentagon, AlertCircle } from 'lucide-react';

import { Input }         from '../common/Input';
import { Button }        from '../common/Button';
import { ZoneDrawMap }   from '../maps/ZoneDrawMap';
import type { ZoneDrawResult } from '../maps/ZoneDrawMap';
import type { ZoneWithStatus } from '../../types/zone';
import type {
  ZoneCreateCircularRequest,
  ZoneCreatePolygonRequest,
} from '../../types/zone';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type DrawMode = 'circular' | 'polygon';

interface ZoneFormProps {
  onSubmitCircular: (payload: ZoneCreateCircularRequest) => Promise<void>;
  onSubmitPolygon:  (payload: ZoneCreatePolygonRequest)  => Promise<void>;
  existingZones?:   ZoneWithStatus[];
  isSubmitting?:    boolean;
  onCancel?:        () => void;
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export function ZoneForm({
  onSubmitCircular,
  onSubmitPolygon,
  existingZones = [],
  isSubmitting  = false,
  onCancel,
}: ZoneFormProps) {
  const [mode,     setMode]     = useState<DrawMode>('circular');
  const [name,     setName]     = useState('');
  const [zoneType, setZoneType] = useState('');
  const [error,    setError]    = useState<string | null>(null);
  const [drawn,    setDrawn]    = useState<ZoneDrawResult | null>(null);

  const isReadyToSubmit = !!name.trim() && !!drawn;

  const handleDrawn = (result: ZoneDrawResult) => {
    setDrawn(result);
    setError(null);
  };

  const handleClear = () => {
    setDrawn(null);
  };

  const handleSubmit = async () => {
    setError(null);

    if (!name.trim()) {
      setError('Zone name is required.');
      return;
    }

    if (!drawn) {
      setError('Please draw the zone on the map first.');
      return;
    }

    try {
      if (mode === 'circular') {
        if (!drawn.circle) {
          setError('Draw a circle on the map.');
          return;
        }
        await onSubmitCircular({
          name:             name.trim(),
          zone_type:        zoneType.trim() || undefined,
          center_latitude:  drawn.circle.center[0],
          center_longitude: drawn.circle.center[1],
          radius_meters:    drawn.circle.radiusMeters,
        });
      } else {
        if (!drawn.polygon || drawn.polygon.coordinates.length < 4) {
          setError('Draw a polygon with at least 3 vertices.');
          return;
        }
        await onSubmitPolygon({
          name:        name.trim(),
          zone_type:   zoneType.trim() || undefined,
          coordinates: drawn.polygon.coordinates,
        });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create zone.');
    }
  };

  return (
    <div className="space-y-4">

      {/* Mode toggle */}
      <div className="flex rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 text-sm">
        {([
          { id: 'circular', label: 'Circle',  Icon: MousePointerClick },
          { id: 'polygon',  label: 'Polygon', Icon: Pentagon },
        ] as { id: DrawMode; label: string; Icon: React.ElementType }[]).map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => { setMode(id); setDrawn(null); setError(null); }}
            className={[
              'flex-1 flex items-center justify-center gap-2 py-2.5 font-semibold transition-colors',
              mode === id
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-slate-900 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300',
            ].join(' ')}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Name + Type */}
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Zone Name *"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Heritage Quarter"
        />
        <Input
          label="Zone Type (optional)"
          value={zoneType}
          onChange={(e) => setZoneType(e.target.value)}
          placeholder="e.g. TOURIST, RESTRICTED"
        />
      </div>

      {/* Map draw area */}
      <div>
        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
          Draw Zone on Map *
        </label>
        <ZoneDrawMap
          mode={mode === 'circular' ? 'circle' : 'polygon'}
          existingZones={existingZones}
          onDrawn={handleDrawn}
          onClear={handleClear}
          height={380}
        />
      </div>

      {/* Status: what has been drawn */}
      {drawn && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
          <span className="text-emerald-500 text-sm">✓</span>
          <span className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">
            {drawn.type === 'circle'
              ? `Circle drawn — center (${drawn.circle!.center[0].toFixed(4)}, ${drawn.circle!.center[1].toFixed(4)}), radius ${drawn.circle!.radiusMeters.toLocaleString()} m`
              : `Polygon drawn — ${(drawn.polygon!.coordinates.length - 1)} vertices`
            }
          </span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800">
          <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        {onCancel && (
          <Button variant="ghost" onClick={onCancel} disabled={isSubmitting} fullWidth>
            Cancel
          </Button>
        )}
        <Button
          variant="primary"
          onClick={handleSubmit}
          loading={isSubmitting}
          disabled={!isReadyToSubmit}
          fullWidth
        >
          Create Zone
        </Button>
      </div>
    </div>
  );
}