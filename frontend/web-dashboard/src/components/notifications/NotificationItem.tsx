// src/components/notifications/NotificationItem.tsx

import { AlertTriangle, Info } from 'lucide-react';
import { formatTimeAgo } from '../../utils/formatDate';
import type { NotificationSummary } from '../../types/notification';
import { NotificationSeverity, NotificationStatus } from '../../types/enums';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface NotificationItemProps {
  notification:  NotificationSummary;
  onMarkRead?:   (id: number) => void;
  isMarkingRead?: boolean;
}

// ─────────────────────────────────────────────
// Severity config
// ─────────────────────────────────────────────

const SEVERITY_CONFIG = {
  [NotificationSeverity.CRITICAL]: {
    icon:    AlertTriangle,
    color:   'text-red-500',
    bg:      'bg-red-50 dark:bg-red-950/30',
    border:  'border-red-200 dark:border-red-800',
    dot:     'bg-red-500',
  },
  [NotificationSeverity.WARNING]: {
    icon:    AlertTriangle,
    color:   'text-amber-500',
    bg:      'bg-amber-50 dark:bg-amber-950/30',
    border:  'border-amber-200 dark:border-amber-800',
    dot:     'bg-amber-500',
  },
  [NotificationSeverity.INFO]: {
    icon:    Info,
    color:   'text-blue-500',
    bg:      'bg-blue-50 dark:bg-blue-950/20',
    border:  'border-blue-200 dark:border-blue-800',
    dot:     'bg-blue-400',
  },
};

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export function NotificationItem({
  notification,
  onMarkRead,
  isMarkingRead = false,
}: NotificationItemProps) {
  const isUnread = notification.status !== NotificationStatus.READ;
  const config   = SEVERITY_CONFIG[notification.severity] ?? SEVERITY_CONFIG[NotificationSeverity.INFO];
  const Icon     = config.icon;

  const eventLabel = notification.event_type
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());

  return (
    <div
      className={[
        'flex items-start gap-3 p-3.5 rounded-xl border transition-all duration-150',
        isUnread
          ? `${config.bg} ${config.border}`
          : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800',
      ].join(' ')}
    >
      {/* Icon */}
      <div className={`mt-0.5 flex-shrink-0 ${config.color}`}>
        <Icon size={16} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
              {eventLabel}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {formatTimeAgo(notification.created_at)}
            </p>
          </div>

          {/* Unread dot + mark read */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {isUnread && (
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${config.dot}`} />
            )}
            {isUnread && onMarkRead && (
              <button
                onClick={() => onMarkRead(notification.id)}
                disabled={isMarkingRead}
                className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors disabled:opacity-50"
              >
                Mark read
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}