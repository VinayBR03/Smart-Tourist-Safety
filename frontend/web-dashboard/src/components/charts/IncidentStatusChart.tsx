// src/components/charts/IncidentStatusChart.tsx

import { useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Sector,
} from 'recharts';
import type { PieSectorDataItem } from 'recharts/types/polar/Pie';
import { Loader } from '../common/Loader';
import { EmptyState } from '../common/EmptyState';
import type { IncidentStatusResponse } from '../../api/analyticsApi';

// ─────────────────────────────────────────────
// Colour + label maps
// ─────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  OPEN:        '#ef4444',
  IN_PROGRESS: '#f97316',
  ESCALATED:   '#dc2626',
  RESOLVED:    '#22c55e',
  CLOSED:      '#94a3b8',
  CANCELLED:   '#cbd5e1',
  REJECTED:    '#e2e8f0',
};

const STATUS_LABELS: Record<string, string> = {
  OPEN:        'Open',
  IN_PROGRESS: 'In Progress',
  ESCALATED:   'Escalated',
  RESOLVED:    'Resolved',
  CLOSED:      'Closed',
  CANCELLED:   'Cancelled',
  REJECTED:    'Rejected',
};

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface ChartEntry {
  name:  string;
  value: number;
  fill:  string;
}

interface IncidentStatusChartProps {
  data:        IncidentStatusResponse | null | undefined;
  isLoading?:  boolean;
  error?:      string | null;
  height?:     number;
  className?:  string;
}

// ─────────────────────────────────────────────
// Custom sector shape using modern `shape` + `isActive`
// ─────────────────────────────────────────────

type SectorProps = PieSectorDataItem & {
  isActive?: boolean;
  payload?:  ChartEntry;
  percent?:  number;
  index?:    number;
};

function CustomSector(props: SectorProps) {
  const {
    cx = 0,
    cy = 0,
    innerRadius = 0,
    outerRadius = 0,
    startAngle  = 0,
    endAngle    = 0,
    fill        = '#000',
    isActive    = false,
    payload,
    percent     = 0,
    value       = 0,
  } = props;

  if (isActive) {
    return (
      <g>
        {/* Centre label */}
        <text
          x={cx} y={(cy as number) - 10}
          textAnchor="middle"
          style={{ fontSize: 15, fontWeight: 700, fill: 'currentColor' }}
          className="fill-slate-900 dark:fill-slate-100"
        >
          {value}
        </text>
        <text
          x={cx} y={(cy as number) + 10}
          textAnchor="middle"
          style={{ fontSize: 11, fill: '#94a3b8' }}
        >
          {payload ? (STATUS_LABELS[payload.name] ?? payload.name) : ''}
        </text>
        <text
          x={cx} y={(cy as number) + 26}
          textAnchor="middle"
          style={{ fontSize: 10, fill: '#94a3b8' }}
        >
          {(percent * 100).toFixed(1)}%
        </text>

        {/* Expanded outer ring */}
        <Sector
          cx={cx as number}
          cy={cy as number}
          innerRadius={innerRadius as number}
          outerRadius={(outerRadius as number) + 6}
          startAngle={startAngle as number}
          endAngle={endAngle as number}
          fill={fill as string}
        />
        {/* Inner accent ring */}
        <Sector
          cx={cx as number}
          cy={cy as number}
          innerRadius={(innerRadius as number) - 4}
          outerRadius={innerRadius as number}
          startAngle={startAngle as number}
          endAngle={endAngle as number}
          fill={fill as string}
        />
      </g>
    );
  }

  return (
    <Sector
      cx={cx as number}
      cy={cy as number}
      innerRadius={innerRadius as number}
      outerRadius={outerRadius as number}
      startAngle={startAngle as number}
      endAngle={endAngle as number}
      fill={fill as string}
    />
  );
}

// ─────────────────────────────────────────────
// Custom tooltip
// ─────────────────────────────────────────────

interface PieTooltipProps {
  active?:  boolean;
  payload?: Array<{ name: string; value: number; payload: ChartEntry }>;
}

function PieTooltip({ active, payload }: PieTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0];
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl px-3 py-2 text-xs">
      <div className="flex items-center gap-2">
        <span
          className="w-2.5 h-2.5 rounded-full"
          style={{ backgroundColor: item.payload.fill }}
        />
        <span className="text-slate-600 dark:text-slate-400">
          {STATUS_LABELS[item.name] ?? item.name}
        </span>
        <span className="font-bold text-slate-900 dark:text-slate-100 ml-1">
          {item.value}
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Chart
// ─────────────────────────────────────────────

export function IncidentStatusChart({
  data,
  isLoading = false,
  error     = null,
  height    = 280,
  className = '',
}: IncidentStatusChartProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (isLoading) return <Loader center size="md" label="Loading status data…" />;
  if (error)     return <div className="text-sm text-red-500 dark:text-red-400 py-8 text-center">{error}</div>;
  if (!data)     return <EmptyState title="No status data" compact />;

  const chartData: ChartEntry[] = Object.entries(data.status_counts)
    .filter(([, v]) => v > 0)
    .map(([status, count]) => ({
      name:  status,
      value: count,
      fill:  STATUS_COLORS[status] ?? '#94a3b8',
    }));

  if (chartData.length === 0) {
    return <EmptyState title="No incidents" message="No incident status data to display." compact />;
  }

  const total = chartData.reduce((s, d) => s + d.value, 0);

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            dataKey="value"
            strokeWidth={0}
            onMouseEnter={(_, index) => setActiveIndex(index)}
            // Modern API: shape receives isActive per-sector
            shape={(props: object) => {
              const p = props as SectorProps;
              return (
                <CustomSector
                  {...p}
                  isActive={p.index === activeIndex}
                />
              );
            }}
          >
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip content={<PieTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-1">
        {chartData.map((entry, i) => (
          <button
            key={i}
            onClick={() => setActiveIndex(i)}
            className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
          >
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: entry.fill }}
            />
            {STATUS_LABELS[entry.name] ?? entry.name}
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {((entry.value / total) * 100).toFixed(0)}%
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}