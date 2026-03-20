// src/components/notifications/NotificationList.tsx

import { useState } from 'react';
import { NotificationItem } from './NotificationItem';
import { EmptyState } from '../common/EmptyState';
import { SkeletonListItem } from '../common/Skeleton';
import type { NotificationSummary } from '../../types/notification';
import { NotificationSeverity, NotificationStatus } from '../../types/enums';

interface NotificationListProps {
  notifications:  NotificationSummary[];
  isLoading?:     boolean;
  onMarkRead?:    (id: number) => void;
  markingReadId?: number | null;
  className?:     string;
}

export function NotificationList({
  notifications,
  isLoading     = false,
  onMarkRead,
  markingReadId = null,
  className     = '',
}: NotificationListProps) {
  const [activeTab, setActiveTab] = useState('all');

  const tabs = [
    { id: 'all',      label: 'All',      badge: notifications.length },
    { id: 'unread',   label: 'Unread',   badge: notifications.filter((n) => n.status !== NotificationStatus.READ).length },
    { id: 'critical', label: 'Critical', badge: notifications.filter((n) => n.severity === NotificationSeverity.CRITICAL).length },
  ];

  const filtered = notifications.filter((n) => {
    if (activeTab === 'unread')   return n.status !== NotificationStatus.READ;
    if (activeTab === 'critical') return n.severity === NotificationSeverity.CRITICAL;
    return true;
  });

  if (isLoading) {
    return (
      <div className={`space-y-2 ${className}`}>
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonListItem key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Manual tab bar */}
      <div className="flex gap-1 mb-4 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={[
              'flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
              activeTab === tab.id
                ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300',
            ].join(' ')}
          >
            {tab.label}
            {tab.badge > 0 && (
              <span className={[
                'text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center',
                activeTab === tab.id
                  ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-500',
              ].join(' ')}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<span className="text-2xl">🔔</span>}
          title="No notifications"
          message={activeTab === 'unread' ? 'You are all caught up.' : 'Nothing to show.'}
          compact
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((n) => (
            <NotificationItem
              key={n.id}
              notification={n}
              onMarkRead={onMarkRead}
              isMarkingRead={markingReadId === n.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}