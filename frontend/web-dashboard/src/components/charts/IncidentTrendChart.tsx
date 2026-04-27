// src/components/charts/IncidentTrendChart.tsx

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { useIsDark } from '../../theme/useTheme';
import { Loader } from '../common/Loader';
import { EmptyState } from '../common/EmptyState';
import type { IncidentTrendResponse } from '../../api/analyticsApi';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface IncidentTrendChartProps {
  data:        IncidentTrendResponse | null | undefined;
  isLoading?:  boolean;
  error?:      string | null;
  height?:     number;
  className?:  string;
}

// ─────────────────────────────────────────────
// Custom tooltip
// ─────────────────────────────────────────────

interface CustomTooltipProps {
  active?:  boolean;
  payload?: Array<{ value: number; payload?: { label?: string; count?: number } }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0];

  return (
    <div
      style={{
        background:   'rgba(15, 23, 42, 0.92)',
        border:       '1px solid rgba(59, 130, 246, 0.25)',
        borderRadius: 12,
        padding:      '10px 14px',
        boxShadow:    '0 8px 32px rgba(0,0,0,0.3)',
        backdropFilter: 'blur(8px)',
        minWidth:     120,
      }}
    >
      <p style={{ fontSize: 10, color: '#94a3b8', marginBottom: 6, fontWeight: 500 }}>
        {item.payload?.label}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#cbd5e1' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6', display: 'inline-block' }} />
          Incidents
        </span>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>
          {item.value}
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Month abbreviations
// ─────────────────────────────────────────────

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ─────────────────────────────────────────────
// Chart
// ─────────────────────────────────────────────

export function IncidentTrendChart({
  data,
  isLoading = false,
  error     = null,
  height    = 280,
  className = '',
}: IncidentTrendChartProps) {
  const isDark = useIsDark();

  const lineColor    = '#3b82f6';
  const tickColor    = isDark ? '#64748b' : '#94a3b8';
  const gridColor    = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)';
  const axisColor    = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)';
  const gradientTop  = isDark ? 'rgba(59,130,246,0.30)' : 'rgba(59,130,246,0.18)';
  const gradientMid  = isDark ? 'rgba(59,130,246,0.10)' : 'rgba(59,130,246,0.06)';
  const gradientBot  = isDark ? 'rgba(59,130,246,0.00)' : 'rgba(59,130,246,0.00)';

  if (isLoading) return <Loader center size="md" label="Loading trend data…" />;
  if (error)     return <div className="text-sm text-red-500 dark:text-red-400 py-8 text-center">{error}</div>;

  const rawPoints = (
    Array.isArray(data)
      ? data
      : (data as IncidentTrendResponse | null)?.data ?? []
  ) as unknown as Array<Record<string, unknown>>;

  if (rawPoints.length === 0) {
    return <EmptyState title="No trend data" message="Incident trend data is unavailable." compact />;
  }

  // ── Build date → count map (reads both `date` and legacy `day`) ──
  const dataMap = new Map<string, number>();

  for (const point of rawPoints) {
    const rawDate = (point.date ?? point.day) as string | null | undefined;
    if (!rawDate) continue;
    const key = String(rawDate).split('T')[0].split(' ')[0];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) continue;
    const count = Number(point.count ?? 0);
    dataMap.set(key, (dataMap.get(key) ?? 0) + count);
  }

  if (dataMap.size === 0) {
    return <EmptyState title="No trend data" message="Incident trend data is unavailable." compact />;
  }

  // ── 30-day window anchored to the current system date ──
  const latestDate = new Date();
  const chartData: { id: string; label: string; count: number }[] = [];

  for (let i = 29; i >= 0; i--) {
    const d = new Date(latestDate);
    d.setDate(latestDate.getDate() - i);
    const y   = d.getFullYear();
    const m   = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const id  = `${y}-${m}-${day}`;
    chartData.push({ id, label: `${MONTHS[d.getMonth()]} ${d.getDate()}`, count: dataMap.get(id) ?? 0 });
  }

  const maxCount = Math.max(...chartData.map((d) => d.count), 0);
  const yMax     = Math.max(Math.ceil(maxCount * 1.35), 5);

  // Average line value (only over days that have data)
  const activeDays = chartData.filter((d) => d.count > 0);
  const avgCount   = activeDays.length > 0
    ? Math.round(activeDays.reduce((s, d) => s + d.count, 0) / activeDays.length * 10) / 10
    : 0;

  return (
    <div className={className}>
      {/* Chart */}
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart
          data={chartData}
          margin={{ top: 16, right: 16, left: 10, bottom: 0 }}
        >
          <defs>
            <linearGradient id="incidentGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={gradientTop} stopOpacity={1} />
              <stop offset="55%"  stopColor={gradientMid} stopOpacity={1} />
              <stop offset="100%" stopColor={gradientBot} stopOpacity={1} />
            </linearGradient>
          </defs>

          <CartesianGrid
            stroke={gridColor}
            strokeDasharray="4 4"
            vertical={true}
          />

          <XAxis
            dataKey="id"
            tickFormatter={(id: string) => chartData.find((d) => d.id === id)?.label ?? ''}
            tick={{ fontSize: 10, fill: tickColor, fontWeight: 500 }}
            axisLine={{ stroke: axisColor }}
            tickLine={false}
            dy={8}
            minTickGap={24}
          />

          <YAxis
            tick={{ fontSize: 10, fill: tickColor, fontWeight: 500 }}
            axisLine={{ stroke: axisColor }}
            tickLine={{ stroke: axisColor }}
            allowDecimals={false}
            domain={[0, yMax]}
            width={45}
            label={{
              value: 'Incidents',
              angle: -90,
              position: 'insideLeft',
              style: { fill: tickColor, fontSize: 11, fontWeight: 500 }
            }}
          />

          <Tooltip
            content={<CustomTooltip />}
            cursor={{
              stroke:      lineColor,
              strokeWidth: 1,
              strokeDasharray: '4 4',
              opacity:     0.4,
            }}
          />

          {/* Average reference line */}
          {avgCount > 0 && (
            <ReferenceLine
              y={avgCount}
              stroke={isDark ? 'rgba(148,163,184,0.25)' : 'rgba(100,116,139,0.2)'}
              strokeDasharray="6 4"
              label={{
                value:    `avg ${avgCount}`,
                position: 'insideTopRight',
                fontSize:  9,
                fill:      isDark ? '#475569' : '#94a3b8',
                dy:        -4,
              }}
            />
          )}

          {/* Fill area */}
          <Area
            type="monotoneX"
            dataKey="count"
            stroke="none"
            fill="url(#incidentGrad)"
            fillOpacity={1}
            isAnimationActive
            animationDuration={800}
            dot={false}
            activeDot={false}
          />

          {/* The actual visible line rendered on top of the fill */}
          <Area
            type="monotoneX"
            dataKey="count"
            stroke={lineColor}
            strokeWidth={2}
            fill="transparent"
            dot={false}
            activeDot={{
              r:           5,
              fill:        lineColor,
              stroke:      isDark ? '#0f172a' : '#fff',
              strokeWidth: 2,
            }}
            isAnimationActive
            animationDuration={800}
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Legend row */}
      <div className="flex items-center justify-between px-1 mt-3">
        <span className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500">
          <span
            className="inline-block rounded-full"
            style={{ width: 24, height: 2, background: `linear-gradient(90deg, ${lineColor}, rgba(59,130,246,0.3))` }}
          />
          Daily incidents
        </span>
        {avgCount > 0 && (
          <span className="text-[11px] text-slate-400 dark:text-slate-500">
            {avgCount} avg / active day
          </span>
        )}
      </div>
    </div>
  );
}