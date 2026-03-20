// src/components/charts/IncidentTrendChart.tsx

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
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
  payload?: Array<{ value: number; color: string }>;
  label?:   string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-3 text-xs min-w-[130px]">
      <p className="font-semibold text-slate-500 dark:text-slate-400 mb-2">{label}</p>
      <div className="flex items-center justify-between gap-4">
        <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: payload[0].color }} />
          Incidents
        </span>
        <span className="font-bold text-slate-900 dark:text-slate-100">{payload[0].value}</span>
      </div>
    </div>
  );
}

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

  const axisColor = isDark ? '#475569' : '#cbd5e1';
  const tickColor = isDark ? '#94a3b8' : '#64748b';
  const gridColor = isDark ? '#1e293b' : '#f1f5f9';

  if (isLoading) return <Loader center size="md" label="Loading trend data…" />;
  if (error)     return <div className="text-sm text-red-500 dark:text-red-400 py-8 text-center">{error}</div>;
  if (!data || data.data.length === 0) {
    return <EmptyState title="No trend data" message="Incident trend data is unavailable." compact />;
  }

  // data.data is IncidentTrendPoint[] — each is { date: string; count: number }
  const chartData = data.data.map((point) => ({
    label: point.date,
    count: point.count,
  }));

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="gradIncident" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <CartesianGrid stroke={gridColor} strokeDasharray="4 4" vertical={false} />

          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: tickColor }}
            axisLine={{ stroke: axisColor }}
            tickLine={false}
            dy={6}
          />
          <YAxis
            tick={{ fontSize: 11, fill: tickColor }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
            dx={-4}
          />

          <Tooltip content={<CustomTooltip />} />

          <Area
            type="monotone"
            dataKey="count"
            stroke="#3b82f6"
            strokeWidth={2}
            fill="url(#gradIncident)"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}