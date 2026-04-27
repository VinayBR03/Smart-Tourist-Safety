// src/components/health/HealthAlertCard.tsx

import { AlertTriangle, User } from 'lucide-react';
import { formatTimeAgo } from '../../utils/formatDate';
import type { HealthAlertSummary } from '../../types/health';

interface HealthAlertCardProps {
  alert:      HealthAlertSummary;
  onView?:    (alert: HealthAlertSummary) => void;
  className?: string;
}

export function HealthAlertCard({ alert, onView, className = '' }: HealthAlertCardProps) {
  const alertLabel = alert.alert_type.replace(/_/g, ' ').toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());

  return (
    <div
      className={[
        'flex items-start gap-3 p-3.5 rounded-xl border',
        'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800',
        onView ? 'cursor-pointer hover:shadow-sm transition-shadow' : '',
        className,
      ].join(' ')}
      onClick={() => onView?.(alert)}
    >
      <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/40 flex items-center justify-center flex-shrink-0">
        <AlertTriangle size={15} className="text-red-600 dark:text-red-400" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-bold text-red-700 dark:text-red-300">{alertLabel}</p>
            <div className="flex items-center gap-1 mt-0.5">
              <User size={10} className="text-red-400" />
              <span className="text-xs text-red-500 dark:text-red-400">
                Tourist {alert.tourist_id}
              </span>
            </div>
          </div>
          <span className="text-[10px] text-red-400 flex-shrink-0">
            {formatTimeAgo(alert.recorded_at)}
          </span>
        </div>
      </div>
    </div>
  );
}