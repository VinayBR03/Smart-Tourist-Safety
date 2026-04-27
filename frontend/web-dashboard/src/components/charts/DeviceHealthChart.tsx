// src/components/charts/DeviceHealthChart.tsx

import { Loader } from '../common/Loader';
import { EmptyState } from '../common/EmptyState';
import type {
  DeviceHealthResponse,
  DeviceBatteryDistributionResponse,
} from '../../api/analyticsApi';

// ─────────────────────────────────────────────
// Normalise backend enum keys
// Backend may return "DeviceStatus.ACTIVE" or just "ACTIVE"
// ─────────────────────────────────────────────

function normalizeKey(key: string): string {
  const dot = key.lastIndexOf('.');
  return dot !== -1 ? key.slice(dot + 1) : key;
}

// ─────────────────────────────────────────────
// Colours — each status gets a distinct colour
// ─────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:              '#22c55e',  // green
  INACTIVE:            '#64748b',  // slate
  MAINTENANCE:         '#f97316',  // orange
  SUSPENDED:           '#ef4444',  // red
  DECOMMISSIONED:      '#475569',  // dark slate
  LOST:                '#dc2626',  // dark red
  SYSTEM_MAINTENANCE:  '#a855f7',  // purple
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE:              'Active',
  INACTIVE:            'Inactive',
  MAINTENANCE:         'Maintenance',
  SUSPENDED:           'Suspended',
  DECOMMISSIONED:      'Decommissioned',
  LOST:                'Lost',
  SYSTEM_MAINTENANCE:  'System Maintenance',
};

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface DeviceHealthChartProps {
  healthData?:  DeviceHealthResponse | null;
  batteryData?: DeviceBatteryDistributionResponse | null;
  isLoading?:   boolean;
  error?:       string | null;
  height?:      number;
  className?:   string;
}

// ─────────────────────────────────────────────
// Custom SVG donut
// ─────────────────────────────────────────────

interface DonutProps {
  data:  Array<{ label: string; value: number; color: string }>;
  total: number;
  size?: number;
}

function DonutChart({ data, total, size = 140 }: DonutProps) {
  const cx     = size / 2;
  const cy     = size / 2;
  const radius = size * 0.38;
  const stroke = size * 0.14;

  // Use reduce so cumulative angle accumulates without mutating a variable
  // inside .map(), which triggers the react-hooks/immutability lint rule.
  const { segments } = data
    .filter((d) => d.value > 0)
    .reduce<{ segments: Array<typeof data[0] & { path: string }>; cumAngle: number }>(
      ({ segments, cumAngle }, d) => {
        const angle    = (d.value / total) * 360;
        const startRad = (cumAngle * Math.PI) / 180;
        const endRad   = ((cumAngle + angle) * Math.PI) / 180;

        const x1 = cx + radius * Math.cos(startRad);
        const y1 = cy + radius * Math.sin(startRad);
        const x2 = cx + radius * Math.cos(endRad);
        const y2 = cy + radius * Math.sin(endRad);

        const largeArc = angle > 180 ? 1 : 0;
        const path = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;

        return {
          segments: [...segments, { ...d, path }],
          cumAngle:  cumAngle + angle,
        };
      },
      { segments: [], cumAngle: -90 }
    );

  return (
    <svg width={size} height={size} className="flex-shrink-0">
      <circle
        cx={cx} cy={cy} r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        className="text-slate-100 dark:text-slate-800"
      />
      {segments.map((seg, i) => (
        <path
          key={i}
          d={seg.path}
          fill="none"
          stroke={seg.color}
          strokeWidth={stroke}
          strokeLinecap="butt"
        />
      ))}
      <text
        x={cx} y={cy - 6}
        textAnchor="middle"
        style={{ fontSize: size * 0.18, fontWeight: 700, fill: 'currentColor' }}
        className="fill-slate-900 dark:fill-slate-100"
      >
        {total}
      </text>
      <text
        x={cx} y={cy + 10}
        textAnchor="middle"
        style={{ fontSize: size * 0.09, fill: '#94a3b8' }}
      >
        devices
      </text>
    </svg>
  );
}

// ─────────────────────────────────────────────
// Battery stacked bar
// ─────────────────────────────────────────────

function rangeToColor(range: string): string {
  const r = range.toUpperCase();
  if (r.includes('CRITICAL') || r === '0-20')   return '#ef4444';
  if (r.includes('LOW')      || r === '21-40')  return '#f97316';
  if (r.includes('MEDIUM')   || r === '41-60')  return '#eab308';
  return '#22c55e';
}

interface BatteryBarProps {
  data: DeviceBatteryDistributionResponse;
}

function BatteryBar({ data }: BatteryBarProps) {
  const points = data.data.filter((p) => p.count > 0);
  const total  = points.reduce((s, p) => s + p.count, 0);

  if (total === 0) return null;

  return (
    <div className="mt-4">
      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">
        Battery Distribution
      </p>
      <div className="flex h-3 rounded-full overflow-hidden gap-px">
        {points.map((p) => {
          const pct   = (p.count / total) * 100;
          const color = rangeToColor(p.range);
          return (
            <div
              key={p.range}
              style={{ width: `${pct}%`, backgroundColor: color }}
              title={`${p.range}: ${p.count} (${pct.toFixed(0)}%)`}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
        {points.map((p) => (
          <span key={p.range} className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: rangeToColor(p.range) }} />
            {p.range}: {p.count}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main chart
// ─────────────────────────────────────────────

export function DeviceHealthChart({
  healthData,
  batteryData,
  isLoading = false,
  error     = null,
  height    = 200,
  className = '',
}: DeviceHealthChartProps) {
  if (isLoading) return <Loader center size="md" label="Loading device data…" />;
  if (error)     return <div className="text-sm text-red-500 dark:text-red-400 py-8 text-center">{error}</div>;
  if (!healthData) return <EmptyState title="No device data" compact />;

  // Normalise keys — strip enum class prefix if backend returns it
  const segments = Object.entries(healthData.status_counts)
    .filter(([, v]) => v > 0)
    .map(([rawStatus, value]) => {
      const status = normalizeKey(rawStatus);
      return {
        label: STATUS_LABELS[status] ?? status,
        value,
        color: STATUS_COLORS[status] ?? '#94a3b8',
      };
    });

  const total = segments.reduce((s, d) => s + d.value, 0);

  if (total === 0) {
    return <EmptyState title="No devices registered" compact />;
  }

  return (
    <div className={className}>
      <div className="flex items-center gap-6">
        <DonutChart data={segments} total={total} size={height} />

        <div className="flex-1 space-y-2 min-w-0">
          {segments.map((seg, i) => (
            <div key={i} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: seg.color }}
                />
                <span className="text-xs text-slate-600 dark:text-slate-400 truncate">
                  {seg.label}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  {seg.value}
                </span>
                <span className="text-[10px] text-slate-400 w-8 text-right">
                  {total > 0 ? ((seg.value / total) * 100).toFixed(0) : 0}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {batteryData && <BatteryBar data={batteryData} />}
    </div>
  );
}