// src/components/devices/DeviceTable.tsx

import { Table } from '../common/Table';
import { DeviceStatusBadge } from '../common/Badge';
import { formatTimeAgo } from '../../utils/formatDate';
import { batteryToColor } from '../../utils/mapHelpers';
import type { DeviceSummary } from '../../types/device';
import type { Column } from '../common/Table';
import { DeviceType } from '../../types/enums';

interface DeviceTableProps {
  devices:     DeviceSummary[];
  isLoading?:  boolean;
  error?:      string | null;
  onRowClick?: (device: DeviceSummary) => void;
  className?:  string;
}

const TYPE_LABELS: Record<string, string> = {
  [DeviceType.WRISTBAND]: 'Wristband',
  [DeviceType.NODE]:      'Node',
  [DeviceType.GATEWAY]:   'Gateway',
};

const COLUMNS: Column<DeviceSummary>[] = [
  {
    key:    'device_id',
    header: 'Device ID',
    render: (d) => (
      <span className="font-mono text-sm font-semibold text-slate-700 dark:text-slate-300">
        {d.device_id}
      </span>
    ),
  },
  {
    key:    'device_type',
    header: 'Type',
    render: (d) => (
      <span className="text-xs text-slate-600 dark:text-slate-400">
        {TYPE_LABELS[d.device_type] ?? d.device_type}
      </span>
    ),
  },
  {
    key:    'status',
    header: 'Status',
    render: (d) => <DeviceStatusBadge status={d.status} />,
  },
  {
    key:    'battery_percentage',
    header: 'Battery',
    render: (d) => {
      if (d.battery_percentage == null) return <span className="text-slate-400 text-xs">—</span>;
      const color = batteryToColor(d.battery_percentage);
      return (
        <div className="flex items-center gap-2">
          <div className="w-16 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${d.battery_percentage}%`, backgroundColor: color }}
            />
          </div>
          <span className="text-xs font-mono" style={{ color }}>
            {d.battery_percentage.toFixed(0)}%
          </span>
        </div>
      );
    },
  },
  {
    key:    'last_seen',
    header: 'Last Seen',
    render: (d) => (
      <span className="text-xs text-slate-500 dark:text-slate-400">
        {d.last_seen ? formatTimeAgo(d.last_seen) : '—'}
      </span>
    ),
  },
];

export function DeviceTable({ devices, isLoading, error, onRowClick, className }: DeviceTableProps) {
  return (
    <Table<DeviceSummary>
      columns={COLUMNS}
      data={devices}
      isLoading={isLoading}
      error={error}
      onRowClick={onRowClick}
      keyExtractor={(d) => d.device_id}
      emptyTitle="No devices registered"
      emptyMessage="Register your first IoT device to get started."
      stickyHeader
      className={className}
    />
  );
}