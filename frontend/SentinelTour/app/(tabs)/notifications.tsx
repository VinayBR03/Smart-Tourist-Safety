import { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Animated, {
  FadeInDown,
  FadeOutLeft,
  Layout,
} from 'react-native-reanimated';
import { Header } from '@/components/layout/Header';
import { Badge, severityVariant } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icons';
import { notificationsApi } from '@/api/notifications';
import { useNotificationStore } from '@/store/notificationStore';
import { Colors, Typography, Spacing, Radius } from '@/constants/theme';
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns';
import type { NotificationSummary, NotificationSeverity } from '@/types/api';
import { useThemedStyles } from '@/utils/themedStyles';

const t = useThemedStyles();

// ─── Severity icon map ────────────────────────────────────
function SeverityIcon({ severity, size = 18 }: { severity: NotificationSeverity; size?: number }) {
  switch (severity) {
    case 'CRITICAL':
    case 'HIGH':
      return <Icon.ShieldAlert size={size} color={Colors.error} />;
    case 'WARNING':
      return <Icon.AlertTriangle size={size} color={Colors.warning} />;
    default:
      return <Icon.Info size={size} color={Colors.primary} />;
  }
}

// ─── Group notifications by date ─────────────────────────
function groupByDate(items: NotificationSummary[]) {
  const groups: { title: string; data: NotificationSummary[] }[] = [];
  const map = new Map<string, NotificationSummary[]>();

  items.forEach((n) => {
    const d = new Date(n.created_at);
    const key = isToday(d)
      ? 'Today'
      : isYesterday(d)
      ? 'Yesterday'
      : format(d, 'MMM d, yyyy');

    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(n);
  });

  map.forEach((data, title) => groups.push({ title, data }));
  return groups;
}

// ─── Single notification row ──────────────────────────────
function NotificationRow({
  item,
  onMarkRead,
}: {
  item: NotificationSummary;
  onMarkRead: (id: number) => void;
}) {
  const isUnread = item.status !== 'READ';

  return (
    <Animated.View
      entering={FadeInDown.duration(350)}
      exiting={FadeOutLeft.duration(200)}
      layout={Layout.springify()}
    >
      <TouchableOpacity
        style={[styles.notifRow, t.surface, t.border, isUnread && styles.notifRowUnread]}
        onPress={() => isUnread && onMarkRead(item.id)}
        activeOpacity={0.8}
      >
        {/* Left: severity icon */}
        <View style={[
          styles.notifIconWrap,
          { backgroundColor: `${isUnread ? Colors.primary : Colors.textMuted}14` },
        ]}>
          <SeverityIcon severity={item.severity} size={20} />
        </View>

        {/* Center: content */}
        <View style={styles.notifContent}>
          <View style={styles.notifTitleRow}>
            <Text
              style={[styles.notifTitle, t.textSecondary, isUnread && styles.notifTitleUnread]}
              numberOfLines={1}
            >
              {item.title}
            </Text>
            {isUnread && <View style={styles.unreadDot} />}
          </View>
          <Text style={[styles.notifBody, t.textMuted]} numberOfLines={2}>
            {item.body}
          </Text>
          <View style={styles.notifMeta}>
            <Icon.Clock size={11} color={Colors.textMuted} />
            <Text style={[styles.notifTime, t.textMuted]}>
              {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
            </Text>
            <Badge
              label={item.severity}
              variant={severityVariant(item.severity)}
              size="sm"
            />
          </View>
        </View>

        {/* Right: chevron */}
        <Icon.ChevronRight size={16} color={Colors.textMuted} />
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Empty state ──────────────────────────────────────────
function EmptyState() {
  return (
    <Animated.View entering={FadeInDown.duration(500)} style={styles.emptyState}>
      <View style={styles.emptyIconWrap}>
        <Icon.Bell size={36} color={Colors.textMuted} />
      </View>
      <Text style={[styles.emptyTitle, t.textPrimary]}>All caught up</Text>
      <Text style={[styles.emptySub, t.textMuted]}>
        No notifications yet. We will alert you of any safety updates or health events.
      </Text>
    </Animated.View>
  );
}

// ─── Main screen ──────────────────────────────────────────
export default function NotificationsScreen() {
  const t = useThemedStyles();
  const queryClient = useQueryClient();
  const { setUnreadCount } = useNotificationStore();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const {
    data: notifications = [],
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationsApi.list,
    refetchInterval: 30_000,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: number) => notificationsApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
      notificationsApi.unreadCount().then((r) => setUnreadCount(r.unread_count));
    },
  });

  const markAllRead = useCallback(async () => {
    const unread = notifications.filter((n) => n.status !== 'READ');
    await Promise.allSettled(unread.map((n) => notificationsApi.markRead(n.id)));
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    setUnreadCount(0);
  }, [notifications]);

  const filtered = filter === 'unread'
    ? notifications.filter((n) => n.status !== 'READ')
    : notifications;

  const groups = groupByDate(filtered);
  const unreadCount = notifications.filter((n) => n.status !== 'READ').length;

  // Flatten for FlatList with section headers
  const flatData: ({ type: 'header'; title: string } | { type: 'item'; data: NotificationSummary })[] = [];
  groups.forEach((g) => {
    flatData.push({ type: 'header', title: g.title });
    g.data.forEach((d) => flatData.push({ type: 'item', data: d }));
  });

  return (
    <View style={[styles.root, t.bg, t.border]}>
      <Header title="Notifications" />

      {/* ── Filter + mark all row ────────────────────── */}
      <View style={[styles.toolbar, t.bg, { borderBottomColor: t.C.border, borderBottomWidth: 1 }]}>
        <View style={styles.filterPills}>
          {(['all', 'unread'] as const).map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterPill, t.surface, t.border,filter === f && styles.filterPillActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterPillText, t.textMuted, filter === f && styles.filterPillTextActive]}>
                {f === 'all' ? 'All' : `Unread${unreadCount > 0 ? ` (${unreadCount})` : ''}`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {unreadCount > 0 && (
          <TouchableOpacity style={styles.markAllBtn} onPress={markAllRead}>
            <Icon.CheckCircle size={14} color={Colors.primary} />
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── List ─────────────────────────────────────── */}
      {isLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={flatData}
          keyExtractor={(item, i) =>
            item.type === 'header' ? `h-${item.title}` : `n-${item.data.id}`
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
          ListEmptyComponent={<EmptyState />}
          renderItem={({ item }) => {
            if (item.type === 'header') {
              return (
                <View style={styles.dateHeader}>
                  <Text style={[styles.dateHeaderText, t.textMuted]}>{item.title}</Text>
                </View>
              );
            }
            return (
              <NotificationRow
                item={item.data}
                onMarkRead={(id) => markReadMutation.mutate(id)}
              />
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  filterPills:    { flexDirection: 'row', gap: Spacing.xs },
  filterPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterPillActive: {
    backgroundColor: 'rgba(59,130,246,0.12)',
    borderColor: Colors.primary,
  },
  filterPillText:       { fontSize: Typography.sm, fontFamily: 'Inter_500Medium', color: Colors.textMuted },
  filterPillTextActive: { color: Colors.primary },

  markAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  markAllText: { fontSize: Typography.sm, fontFamily: 'Inter_500Medium', color: Colors.primary },

  listContent: { paddingHorizontal: Spacing.base, paddingBottom: Spacing['4xl'] },

  dateHeader: { paddingVertical: Spacing.sm, paddingTop: Spacing.base },
  dateHeaderText: {
    fontSize: Typography.xs,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: Colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },

  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.xs,
  },
  notifRowUnread: {
    backgroundColor: 'rgba(59,130,246,0.04)',
    borderColor: 'rgba(59,130,246,0.2)',
  },
  notifIconWrap: {
    width: 44,
    height: 44,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  notifContent: { flex: 1, gap: 3 },
  notifTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  notifTitle: {
    flex: 1,
    fontSize: Typography.sm,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
  },
  notifTitleUnread: {
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: Colors.textPrimary,
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    flexShrink: 0,
  },
  notifBody: {
    fontSize: Typography.xs,
    fontFamily: 'Inter_400Regular',
    color: Colors.textMuted,
    lineHeight: 18,
  },
  notifMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: 2,
  },
  notifTime: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    color: Colors.textMuted,
    flex: 1,
  },

  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  emptyState: { paddingTop: Spacing['4xl'], alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing['2xl'] },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 28,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: Typography.xl, fontFamily: 'SpaceGrotesk_700Bold', color: Colors.textPrimary },
  emptySub: {
    fontSize: Typography.sm,
    fontFamily: 'Inter_400Regular',
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
});