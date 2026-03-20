// src/components/zones/ZoneTable.tsx

import { Table } from '../common/Table';
import { RiskBadge } from '../common/Badge';
import { formatTimeAgo } from '../../utils/formatDate';
import type { ZoneWithStatus } from '../../types/zone';
import type { Column } from '../common/Table';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface ZoneTableProps {
  zones:       ZoneWithStatus[];
  isLoading?:  boolean;
  error?:      string | null;
  onRowClick?: (zone: ZoneWithStatus) => void;
  className?:  string;
}

// ─────────────────────────────────────────────
// Columns
// ─────────────────────────────────────────────

function buildColumns(): Column<ZoneWithStatus>[] {
  return [
    {
      key:    'name',
      header: 'Zone Name',
      render: (z) => (
        <div>
          <p className="font-semibold text-slate-800 dark:text-slate-100">{z.name}</p>
          {z.zone_type && (
            <p className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">
              {z.zone_type}
            </p>
          )}
        </div>
      ),
    },
    {
      key:    'risk_level',
      header: 'Risk',
      render: (z) =>
        z.risk_level ? <RiskBadge level={z.risk_level} /> : <span className="text-slate-400 text-xs">—</span>,
    },
    {
      key:    'risk_score',
      header: 'Score',
      render: (z) =>
        z.risk_score != null ? (
          <span className="text-sm font-mono text-slate-700 dark:text-slate-300">
            {(z.risk_score * 100).toFixed(1)}%
          </span>
        ) : (
          <span className="text-slate-400 text-xs">—</span>
        ),
    },
    {
      key:    'is_active',
      header: 'Status',
      render: (z) => (
        <span
          className={[
            'inline-flex items-center gap-1.5 text-xs font-medium',
            z.is_active
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-slate-400',
          ].join(' ')}
        >
          <span
            className={[
              'w-1.5 h-1.5 rounded-full',
              z.is_active ? 'bg-emerald-500' : 'bg-slate-300',
            ].join(' ')}
          />
          {z.is_active ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key:    'status_updated_at',
      header: 'Last Updated',
      render: (z) => (
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {z.status_updated_at ? formatTimeAgo(z.status_updated_at) : '—'}
        </span>
      ),
    },
  ];
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export function ZoneTable({ zones, isLoading, error, onRowClick, className }: ZoneTableProps) {
  return (
    <Table<ZoneWithStatus>
      columns={buildColumns()}
      data={zones}
      isLoading={isLoading}
      error={error}
      onRowClick={onRowClick}
      keyExtractor={(z) => z.id}
      emptyTitle="No zones found"
      emptyMessage="Create your first zone to get started."
      stickyHeader
      className={className}
    />
  );
}