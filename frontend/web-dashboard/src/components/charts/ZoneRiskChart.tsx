// src/components/charts/ZoneRiskChart.tsx

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts';
import { useIsDark } from '../../theme/useTheme';
import { Loader } from '../common/Loader';
import { EmptyState } from '../common/EmptyState';
import type { ZoneRiskResponse } from '../../api/analyticsApi';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface ZoneRiskChartProps {
  data:        ZoneRiskResponse | null | undefined;
  isLoading?:  boolean;
  error?:      string | null;
  height?:     number;
  className?:  string;
  variant?:    'bar' | 'horizontal';
}

// ─────────────────────────────────────────────
// Colours
// ─────────────────────────────────────────────

const RISK_COLORS: Record<string, string> = {
  LOW:    '#22c55e',
  MEDIUM: '#f97316',
  HIGH:   '#ef4444',
};

const RISK_LABELS: Record<string, string> = {
  LOW:    'Low Risk',
  MEDIUM: 'Medium Risk',
  HIGH:   'High Risk',
};

// ─────────────────────────────────────────────
// Custom tooltip
// ─────────────────────────────────────────────

interface RiskTooltipProps {
  active?:  boolean;
  payload?: Array<{ value: number; payload: { risk: string; fill: string } }>;
}

function RiskTooltip({ active, payload }: RiskTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0];
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl px-3 py-2 text-xs">
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: item.payload.fill }} />
        <span className="text-slate-600 dark:text-slate-400">
          {RISK_LABELS[item.payload.risk] ?? item.payload.risk}
        </span>
        <span className="font-bold text-slate-900 dark:text-slate-100 ml-1">
          {item.value} zone{item.value !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Chart
// ─────────────────────────────────────────────

export function ZoneRiskChart({
  data,
  isLoading = false,
  error     = null,
  height    = 240,
  className = '',
  variant   = 'bar',
}: ZoneRiskChartProps) {
  const isDark = useIsDark();

  const axisColor = isDark ? '#475569' : '#cbd5e1';
  const tickColor = isDark ? '#94a3b8' : '#64748b';
  const gridColor = isDark ? '#1e293b' : '#f1f5f9';

  if (isLoading) return <Loader center size="md" label="Loading zone data…" />;
  if (error)     return <div className="text-sm text-red-500 dark:text-red-400 py-8 text-center">{error}</div>;
  if (!data)     return <EmptyState title="No zone data" compact />;

  // data.risk_counts is the correct field per analyticsApi.ts → ZoneRiskResponse
  const chartData = (['LOW', 'MEDIUM', 'HIGH'] as const).map((risk) => ({
    risk,
    label: RISK_LABELS[risk],
    value: data.risk_counts[risk] ?? 0,
    fill:  RISK_COLORS[risk],
  }));

  const total = chartData.reduce((s, d) => s + d.value, 0);

  if (total === 0) {
    return <EmptyState title="No zone risk data" compact />;
  }

  if (variant === 'horizontal') {
    return (
      <div className={className}>
        <ResponsiveContainer width="100%" height={height}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 4, right: 40, left: 8, bottom: 4 }}
          >
            <CartesianGrid stroke={gridColor} strokeDasharray="4 4" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: tickColor }}
              axisLine={{ stroke: axisColor }}
              tickLine={false}
              allowDecimals={false}
            />
            <YAxis
              type="category"
              dataKey="label"
              tick={{ fontSize: 11, fill: tickColor }}
              axisLine={false}
              tickLine={false}
              width={80}
            />
            <Tooltip content={<RiskTooltip />} cursor={{ fill: isDark ? '#1e293b' : '#f8fafc' }} />
            <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={32}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
              <LabelList
                dataKey="value"
                position="right"
                style={{ fontSize: 11, fontWeight: 600, fill: tickColor }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        <div className="flex justify-center gap-6 mt-2">
          {chartData.map((d) => (
            <div key={d.risk} className="text-center">
              <p className="text-lg font-bold" style={{ color: d.fill }}>{d.value}</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                {RISK_LABELS[d.risk].replace(' Risk', '')}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid stroke={gridColor} strokeDasharray="4 4" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: tickColor }}
            axisLine={{ stroke: axisColor }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: tickColor }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip content={<RiskTooltip />} cursor={{ fill: isDark ? '#1e293b' : '#f8fafc' }} />
          <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={56}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.fill} />
            ))}
            <LabelList
              dataKey="value"
              position="top"
              style={{ fontSize: 11, fontWeight: 600, fill: tickColor }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}