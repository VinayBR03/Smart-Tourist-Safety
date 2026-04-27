import { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import Animated, { FadeInDown, FadeOutLeft, Layout } from 'react-native-reanimated';
import { Header } from '@/components/layout/Header';
import { Badge, severityVariant } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icons';
import { notificationsApi } from '@/api/notifications';
import { useNotificationStore } from '@/store/notificationStore';
import { useAuthStore } from '@/store/authStore';
import { Typography, Spacing, Radius } from '@/constants/theme';
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns';
import type { NotificationSummary, NotificationSeverity } from '@/types/api';
import { useThemedStyles } from '@/utils/themedStyles';
import { useColors } from '@/context/ThemeContext';

function SeverityIcon({ severity, size = 18 }: { severity: NotificationSeverity; size?: number }) {
  switch (severity) {
    case 'CRITICAL': case 'HIGH': return <Icon.ShieldAlert size={size} color="#EF4444" />;
    case 'WARNING':               return <Icon.AlertTriangle size={size} color="#F59E0B" />;
    default:                      return <Icon.Info size={size} color="#3B82F6" />;
  }
}

function groupByDate(items: NotificationSummary[]) {
  const groups: { title: string; data: NotificationSummary[] }[] = [];
  const map = new Map<string, NotificationSummary[]>();
  items.forEach((n) => {
    const d = new Date(n.created_at);
    const key = isToday(d) ? 'Today' : isYesterday(d) ? 'Yesterday' : format(d, 'MMM d, yyyy');
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(n);
  });
  map.forEach((data, title) => groups.push({ title, data }));
  return groups;
}

function NotificationRow({ item, onPress }: { item: NotificationSummary; onPress: (item: NotificationSummary) => void }) {
  const C = useColors();
  const isUnread = item.status !== 'READ';
  return (
    <Animated.View entering={FadeInDown.duration(350)} exiting={FadeOutLeft.duration(200)} layout={Layout.springify()}>
      <TouchableOpacity
        style={[
          styles.notifRow,
          { backgroundColor: C.surface, borderColor: C.border },
          isUnread && { backgroundColor: 'rgba(59,130,246,0.04)', borderColor: 'rgba(59,130,246,0.2)' },
        ]}
        onPress={() => onPress(item)}
        activeOpacity={0.8}
      >
        <View style={[styles.notifIconWrap, { backgroundColor: `${isUnread ? C.primary : C.textMuted}14` }]}>
          <SeverityIcon severity={item.severity} size={20} />
        </View>
        <View style={styles.notifContent}>
          <View style={styles.notifTitleRow}>
            <Text
              style={[
                styles.notifTitle,
                { color: isUnread ? C.textPrimary : C.textSecondary },
                isUnread && { fontFamily: 'SpaceGrotesk_600SemiBold' },
              ]}
              numberOfLines={1}
            >
              {item.title}
            </Text>
            {isUnread && <View style={styles.unreadDot} />}
          </View>
          <Text style={[styles.notifBody, { color: C.textMuted }]} numberOfLines={2}>{item.body}</Text>
          <View style={styles.notifMeta}>
            <Icon.Clock size={11} color={C.textMuted} />
            <Text style={[styles.notifTime, { color: C.textMuted }]}>
              {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
            </Text>
            <Badge label={item.severity} variant={severityVariant(item.severity)} size="sm" />
          </View>
        </View>
        <Icon.ChevronRight size={16} color={C.textMuted} />
      </TouchableOpacity>
    </Animated.View>
  );
}

function EmptyState() {
  const C = useColors();
  return (
    <Animated.View entering={FadeInDown.duration(500)} style={styles.emptyState}>
      <View style={[styles.emptyIconWrap, { backgroundColor: C.surface, borderColor: C.border }]}>
        <Icon.Bell size={38} color={C.textMuted} />
      </View>
      <Text style={[styles.emptyTitle, { color: C.textPrimary }]}>All caught up</Text>
      <Text style={[styles.emptySub, { color: C.textMuted }]}>
        No notifications yet. We will alert you of any safety updates or health events.
      </Text>
    </Animated.View>
  );
}

export default function NotificationsScreen() {
  const t = useThemedStyles();
  const queryClient = useQueryClient();
  const { setUnreadCount } = useNotificationStore();
  const { isAuthenticated } = useAuthStore();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const { data: notifications = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['notifications'], queryFn: notificationsApi.list, refetchInterval: 30_000, enabled: isAuthenticated,
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

  const filtered    = filter === 'unread' ? notifications.filter((n) => n.status !== 'READ') : notifications;
  const groups      = groupByDate(filtered);
  const unreadCount = notifications.filter((n) => n.status !== 'READ').length;

  const handleNotificationPress = (item: NotificationSummary) => {
    // Always mark as read on tap
    if (item.status !== 'READ') markReadMutation.mutate(item.id);
    // Navigate to incident detail if linked
    if (item.related_entity_type === 'INCIDENT' && item.related_entity_id) {
      router.push({ pathname: '/incidents/[id]', params: { id: item.related_entity_id } });
    }
  };

  const flatData: ({ type: 'header'; title: string } | { type: 'item'; data: NotificationSummary })[] = [];
  groups.forEach((g) => {
    flatData.push({ type: 'header', title: g.title });
    g.data.forEach((d) => flatData.push({ type: 'item', data: d }));
  });

  return (
    <View style={[styles.root, t.bg]}>
      <Header title="Notifications" />

      <View style={[styles.toolbar, t.bg, { borderBottomColor: t.C.border, borderBottomWidth: 1 }]}>
        <View style={styles.filterPills}>
          {(['all', 'unread'] as const).map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterPill, t.surface, t.border, filter === f && { backgroundColor: 'rgba(59,130,246,0.12)', borderColor: t.C.primary }]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterPillText, { color: filter === f ? t.C.primary : t.C.textMuted }]}>
                {f === 'all' ? 'All' : `Unread${unreadCount > 0 ? ` (${unreadCount})` : ''}`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity style={styles.markAllBtn} onPress={markAllRead}>
            <Icon.CheckCircle size={14} color={t.C.primary} />
            <Text style={[styles.markAllText, { color: t.C.primary }]}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <View style={styles.loadingBox}><ActivityIndicator color="#3B82F6" size="large" /></View>
      ) : (
        <FlatList
          data={flatData}
          keyExtractor={(item, i) => item.type === 'header' ? `h-${item.title}` : `n-${item.data.id}`}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#3B82F6" colors={['#3B82F6']} />}
          ListEmptyComponent={<EmptyState />}
          renderItem={({ item }) => {
            if (item.type === 'header') {
              return (
                <View style={styles.dateHeader}>
                  <Text style={[styles.dateHeaderText, { color: t.C.textMuted }]}>{item.title}</Text>
                </View>
              );
            }
            return <NotificationRow item={item.data} onPress={handleNotificationPress} />;
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root:     { flex: 1 },
  toolbar:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm },
  filterPills: { flexDirection: 'row', gap: Spacing.xs },
  filterPill:  { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.full, borderWidth: 1 },
  filterPillText: { fontSize: Typography.sm, fontFamily: 'Inter_500Medium' },
  markAllBtn:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  markAllText: { fontSize: Typography.sm, fontFamily: 'Inter_500Medium' },
  listContent: { paddingHorizontal: Spacing.base, paddingBottom: Spacing['4xl'] },
  dateHeader:  { paddingVertical: Spacing.sm, paddingTop: Spacing.base },
  dateHeaderText: { fontSize: Typography.xs, fontFamily: 'SpaceGrotesk_700Bold', letterSpacing: 0.8, textTransform: 'uppercase' },
  notifRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    borderRadius: Radius.xl, borderWidth: 1, padding: Spacing.md, marginBottom: Spacing.xs,
  },
  notifIconWrap: { width: 44, height: 44, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  notifContent:  { flex: 1, gap: 3 },
  notifTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  notifTitle:    { flex: 1, fontSize: Typography.sm, fontFamily: 'Inter_500Medium' },
  unreadDot:     { width: 7, height: 7, borderRadius: 4, backgroundColor: '#3B82F6', flexShrink: 0 },
  notifBody:     { fontSize: Typography.xs, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  notifMeta:     { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: 2 },
  notifTime:     { fontSize: 10, fontFamily: 'Inter_400Regular', flex: 1 },
  loadingBox:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyState:    { paddingTop: Spacing['4xl'], alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing['2xl'] },
  emptyIconWrap: { width: 80, height: 80, borderRadius: 28, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTitle:    { fontSize: Typography.xl, fontFamily: 'SpaceGrotesk_700Bold' },
  emptySub:      { fontSize: Typography.sm, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 22 },
});