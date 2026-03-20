// src/pages/notifications/NotificationsPage.tsx

import { useState, useMemo }          from 'react';
import { Bell, RefreshCw, CheckCheck } from 'lucide-react';

import { useNotifications }             from '../../hooks/useNotifications';

import { PageHeader }                   from '../../components/ui/SectionHeader';
import { StatCard, StatGrid }           from '../../components/ui/StatCard';
import { Card, CardBody }               from '../../components/ui/Card';
import { Button }                       from '../../components/common/Button';
import { NotificationList }             from '../../components/notifications/NotificationList';
import { SectionHeader }                from '../../components/ui/SectionHeader';

import { NotificationStatus, NotificationSeverity } from '../../types/enums';

// ─────────────────────────────────────────────
// NotificationsPage
// ─────────────────────────────────────────────

export function NotificationsPage() {
  const {
    notifications,
    isLoading,
    error,
    refetch,
    markRead,
  } = useNotifications();

  const [markingReadId, setMarkingReadId] = useState<number | null>(null);

  // ── Stats ──
  const stats = useMemo(() => ({
    total:    notifications.length,
    unread:   notifications.filter((n) => n.status !== NotificationStatus.READ).length,
    critical: notifications.filter((n) => n.severity === NotificationSeverity.CRITICAL).length,
    warning:  notifications.filter((n) => n.severity === NotificationSeverity.WARNING).length,
    info:     notifications.filter((n) => n.severity === NotificationSeverity.INFO).length,
  }), [notifications]);

  // ── Mark all read ──
  const handleMarkAllRead = async () => {
    const unread = notifications.filter((n) => n.status !== NotificationStatus.READ);
    for (const n of unread) {
      await markRead(n.id);
    }
  };

  // ── Mark single read ──
  const handleMarkRead = async (id: number) => {
    setMarkingReadId(id);
    await markRead(id);
    setMarkingReadId(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Notifications"
        subtitle="View and manage all system alerts and operational notifications"
        icon={<Bell className="w-5 h-5" />}
        breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Notifications' }]}
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<RefreshCw className="w-4 h-4" />}
              onClick={refetch}
              loading={isLoading}
            >
              Refresh
            </Button>
            {stats.unread > 0 && (
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<CheckCheck className="w-4 h-4" />}
                onClick={handleMarkAllRead}
              >
                Mark All Read
              </Button>
            )}
          </div>
        }
      />

      {/* Stats */}
      <StatGrid cols={4}>
        <StatCard
          title="Total"
          value={stats.total}
          icon={<Bell className="w-full h-full" />}
          accent="blue"
          isLoading={isLoading}
        />
        <StatCard
          title="Unread"
          value={stats.unread}
          icon={<Bell className="w-full h-full" />}
          accent={stats.unread > 0 ? 'orange' : 'slate'}
          isLoading={isLoading}
        />
        <StatCard
          title="Critical"
          value={stats.critical}
          icon={<Bell className="w-full h-full" />}
          accent={stats.critical > 0 ? 'red' : 'slate'}
          isLoading={isLoading}
        />
        <StatCard
          title="Info"
          value={stats.info}
          icon={<Bell className="w-full h-full" />}
          accent="cyan"
          isLoading={isLoading}
        />
      </StatGrid>

      {/* Main card */}
      <div className="max-w-3xl">
        <Card>
          <CardBody>
            <SectionHeader
              title="All Notifications"
              subtitle={`${stats.unread} unread of ${stats.total} total`}
              size="sm"
              divider
            />

            {error && (
              <p className="text-sm text-red-500 dark:text-red-400 mb-4">{error}</p>
            )}

            <NotificationList
              notifications={notifications}
              isLoading={isLoading}
              onMarkRead={handleMarkRead}
              markingReadId={markingReadId}
            />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
