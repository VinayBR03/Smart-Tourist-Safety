// src/components/devices/DeviceCard.tsx

import { Wifi, Battery, Clock } from 'lucide-react';
import { Card, CardBody } from '../ui/Card';
import { DeviceStatusBadge } from '../common/Badge';
import { formatTimeAgo } from '../../utils/formatDate';
import { batteryToColor } from '../../utils/mapHelpers';
import type { DeviceSummary } from '../../types/device';
import { DeviceType } from '../../types/enums';

interface DeviceCardProps {
  device:     DeviceSummary;
  onClick?:   (device: DeviceSummary) => void;
  className?: string;
}

const TYPE_LABELS: Record<string, string> = {
  [DeviceType.WRISTBAND]: 'Wristband',
  [DeviceType.NODE]:      'Node',
  [DeviceType.GATEWAY]:   'Gateway',
};

export function DeviceCard({ device, onClick, className = '' }: DeviceCardProps) {
  const battColor = batteryToColor(device.battery_percentage);
  const battPct   = device.battery_percentage;

  return (
    <Card
      className={className}
      hoverable
      clickable={!!onClick}
      onClick={() => onClick?.(device)}
      variant="default"
      padding="md"
    >
      <CardBody className="p-0">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
              <Wifi size={15} className="text-slate-500" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate font-mono">
                {device.device_id}
              </p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">
                {TYPE_LABELS[device.device_type] ?? device.device_type}
              </p>
            </div>
          </div>
          <DeviceStatusBadge status={device.status} />
        </div>

        {/* Battery + last seen */}
        <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
          {battPct != null && (
            <div className="flex items-center gap-2">
              <Battery size={12} style={{ color: battColor }} />
              <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${battPct}%`, backgroundColor: battColor }}
                />
              </div>
              <span className="text-[11px] font-mono" style={{ color: battColor }}>
                {battPct.toFixed(0)}%
              </span>
            </div>
          )}
          {device.last_seen && (
            <div className="flex items-center gap-1 text-[10px] text-slate-400">
              <Clock size={10} />
              Last seen {formatTimeAgo(device.last_seen)}
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}