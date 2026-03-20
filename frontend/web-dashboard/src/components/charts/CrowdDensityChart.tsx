// src/components/charts/CrowdDensityChart.tsx

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { useIsDark } from '../../theme/useTheme';
import { Loader } from '../common/Loader';
import { EmptyState } from '../common/EmptyState';
import type { ZoneLivePresence } from '../../types/location';

// ─────────────────────────────────────────────
// Types
// ZoneLivePresence = { zone_id: number; tourist_count: number }
// No zone_name or capacity on the backend type.
// ─────────────────────────────────────────────

interface CrowdDensityChartProps {
  data:        ZoneLivePresence[] | null | undefined;
  isLoading?:  boolean;
  error?:      string | null;
  height?:     number;
  className?:  string;
  maxBars?:    number;
  /** Optional map from zone_id → zone name for display */
  zoneNames?:  Record<number, string>;
}

// ─────────────────────────────────────────────
// Colour by count relative to max
// ─────────────────────────────────────────────

function densityColor(count: number, max: number): string {
  if (max === 0) return '#3b82f6';
  const pct = count / max;
  if (pct >= 0.9) return '#ef4444';
  if (pct >= 0.7) return '#f97316';
  if (pct >= 0.4) return '#eab308';
  return '#22c55e';
}

// ─────────────────────────────────────────────
// Custom tooltip
// ─────────────────────────────────────────────

interface DensityTooltipProps {
  active?:  boolean;
  payload?: Array<{
    value: number;
    payload: { zoneId: number; label: string; fill: string };
  }>;
}

function DensityTooltip({ active, payload }: DensityTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0].payload;
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl px-3 py-2.5 text-xs min-w-[140px]">
      <p className="font-semibold text-slate-700 dark:text-slate-300 mb-1.5 truncate max-w-[160px]">
        {item.label}
      </p>
      <div className="flex justify-between gap-4">
        <span className="text-slate-500 dark:text-slate-400">Tourists</span>
        <span className="font-bold text-slate-900 dark:text-slate-100">{payload[0].value}</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Mini heat tile (for grid/card layouts)
// ─────────────────────────────────────────────

interface HeatTileProps {
  zone:      ZoneLivePresence;
  maxCount:  number;
  zoneName?: string;
  onClick?:  (zone: ZoneLivePresence) => void;
}

export function CrowdHeatTile({ zone, maxCount, zoneName, onClick }: HeatTileProps) {
  const pct   = maxCount > 0 ? zone.tourist_count / maxCount : 0;
  const color = densityColor(zone.tourist_count, maxCount);
  const label = zoneName ?? `Zone ${zone.zone_id}`;

  return (
    <div
      onClick={() => onClick?.(zone)}
      className={[
        'relative rounded-lg p-3 border transition-all duration-150',
        'bg-white dark:bg-slate-900',
        'border-slate-200 dark:border-slate-700',
        onClick ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5' : '',
      ].join(' ')}
    >
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate pr-2">
          {label}
        </p>
        <span className="text-xs font-bold flex-shrink-0" style={{ color }}>
          {zone.tourist_count}
        </span>
      </div>

      <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(pct * 100, 100)}%`, backgroundColor: color }}
        />
      </div>

      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
        Zone {zone.zone_id}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main chart
// ─────────────────────────────────────────────

export function CrowdDensityChart({
  data,
  isLoading  = false,
  error      = null,
  height     = 260,
  className  = '',
  maxBars    = 10,
  zoneNames  = {},
}: CrowdDensityChartProps) {
  const isDark = useIsDark();

  const axisColor = isDark ? '#475569' : '#cbd5e1';
  const tickColor = isDark ? '#94a3b8' : '#64748b';
  const gridColor = isDark ? '#1e293b' : '#f1f5f9';

  const chartData = useMemo(() => {
    if (!data) return [];
    const sorted = [...data]
      .sort((a, b) => b.tourist_count - a.tourist_count)
      .slice(0, maxBars);

    const maxCount = sorted[0]?.tourist_count ?? 0;

    return sorted.map((z) => ({
      zoneId:        z.zone_id,
      label:         zoneNames[z.zone_id] ?? `Zone ${z.zone_id}`,
      tourist_count: z.tourist_count,
      fill:          densityColor(z.tourist_count, maxCount),
    }));
  }, [data, maxBars, zoneNames]);

  if (isLoading) return <Loader center size="md" label="Loading crowd data…" />;
  if (error)     return <div className="text-sm text-red-500 dark:text-red-400 py-8 text-center">{error}</div>;
  if (!data || chartData.length === 0) {
    return <EmptyState title="No crowd data" message="No live zone presence data available." compact />;
  }

  const tickFormatter = (v: string) =>
    v.length > 10 ? v.slice(0, 9) + '…' : v;

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={chartData}
          margin={{ top: 8, right: 4, left: -20, bottom: 0 }}
          barCategoryGap="25%"
        >
          <CartesianGrid stroke={gridColor} strokeDasharray="4 4" vertical={false} />

          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: tickColor }}
            axisLine={{ stroke: axisColor }}
            tickLine={false}
            tickFormatter={tickFormatter}
            dy={6}
          />
          <YAxis
            tick={{ fontSize: 11, fill: tickColor }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />

          <Tooltip
            content={<DensityTooltip />}
            cursor={{ fill: isDark ? '#1e293b' : '#f8fafc' }}
          />

          <Bar
            dataKey="tourist_count"
            radius={[4, 4, 0, 0]}
            maxBarSize={48}
          >
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.fill} fillOpacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="flex items-center justify-center gap-4 mt-2">
        {[
          { color: '#22c55e', label: '< 40%' },
          { color: '#eab308', label: '40–70%' },
          { color: '#f97316', label: '70–90%' },
          { color: '#ef4444', label: '≥ 90%' },
        ].map((k) => (
          <span key={k.label} className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: k.color }} />
            {k.label}
          </span>
        ))}
      </div>
    </div>
  );
}