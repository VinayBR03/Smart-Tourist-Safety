// src/components/incidents/IncidentTable.tsx

import { Table } from '../common/Table';
import { IncidentStatusBadge } from '../common/Badge';
import { formatTimeAgo } from '../../utils/formatDate';
import type { IncidentSummary } from '../../types/incident';
import type { Column } from '../common/Table';
import { IncidentSource } from '../../types/enums';

interface IncidentTableProps {
  incidents:   IncidentSummary[];
  isLoading?:  boolean;
  error?:      string | null;
  onRowClick?: (incident: IncidentSummary) => void;
  zoneNames?:  Record<number, string>;
  className?:  string;
}

const SOURCE_LABELS: Record<string, string> = {
  [IncidentSource.MOBILE]: 'Mobile',
  [IncidentSource.IOT]:    'IoT',
  [IncidentSource.SYSTEM]: 'System',
  [IncidentSource.ML]:     'ML',
  [IncidentSource.HEALTH]: 'Health',
};

function buildColumns(zoneNames: Record<number, string> = {}): Column<IncidentSummary>[] {
  return [
    {
      key:    'id',
      header: 'ID',
      render: (i) => (
        <span className="font-mono text-sm text-slate-500 dark:text-slate-400">#{i.id}</span>
      ),
    },
    {
      key:    'status',
      header: 'Status',
      render: (i) => <IncidentStatusBadge status={i.status} />,
    },
    {
      key:    'zone_id',
      header: 'Zone',
      render: (i) => (
        <span className="text-sm text-slate-700 dark:text-slate-300">
          {i.zone_id ? (zoneNames[i.zone_id] ?? `Zone ${i.zone_id}`) : '—'}
        </span>
      ),
    },
    {
      key:    'source',
      header: 'Source',
      render: (i) => (
        <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full">
          {SOURCE_LABELS[i.source] ?? i.source}
        </span>
      ),
    },
    {
      key:    'is_auto_generated',
      header: 'Type',
      render: (i) => (
        <span className={`text-xs font-medium ${i.is_auto_generated ? 'text-amber-600 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400'}`}>
          {i.is_auto_generated ? 'Auto' : 'Manual'}
        </span>
      ),
    },
    {
      key:    'created_at',
      header: 'Reported',
      render: (i) => (
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {formatTimeAgo(i.created_at)}
        </span>
      ),
    },
  ];
}

export function IncidentTable({
  incidents, isLoading, error, onRowClick, zoneNames, className,
}: IncidentTableProps) {
  return (
    <Table<IncidentSummary>
      columns={buildColumns(zoneNames)}
      data={incidents}
      isLoading={isLoading}
      error={error}
      onRowClick={onRowClick}
      keyExtractor={(i) => i.id}
      emptyTitle="No incidents"
      emptyMessage="No incidents have been reported yet."
      stickyHeader
      className={className}
    />
  );
}