import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '@/components/layout/Header';
import { Badge, incidentVariant } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icons';
import { incidentsApi } from '@/api/incidents';
import { Colors, Typography, Spacing, Radius } from '@/constants/theme';
import { formatDistanceToNow, format } from 'date-fns';
import type { IncidentStatus, IncidentSummary } from '@/types/api';
import { useThemedStyles } from '@/utils/themedStyles';
import { useColors } from '@/context/ThemeContext';

const FILTERS: { label: string; value: IncidentStatus | 'ALL' }[] = [
  { label: 'All',         value: 'ALL'         },
  { label: 'Open',        value: 'OPEN'        },
  { label: 'In Progress', value: 'IN_PROGRESS' },
  { label: 'Escalated',   value: 'ESCALATED'   },
  { label: 'Resolved',    value: 'RESOLVED'    },
  { label: 'Closed',      value: 'CLOSED'      },
];

const SOURCE_ICONS: Record<string, React.ReactNode> = {
  MOBILE: <Icon.Phone    size={13} color={Colors.primary}  />,
  IOT:    <Icon.Wifi     size={13} color={Colors.accent}   />,
  SYSTEM: <Icon.Settings size={13} color={Colors.textMuted}/>,
  HEALTH: <Icon.Heart    size={13} color={Colors.heartRate}/>,
  ML:     <Icon.Activity size={13} color={Colors.warning}  />,
};

function IncidentCard({ item, index }: { item: IncidentSummary; index: number }) {
  const C = useColors();
  return (
    <Animated.View entering={FadeInDown.duration(350).delay(index * 50)}>
      <TouchableOpacity
        style={[styles.card, { backgroundColor: C.surface, borderColor: C.border }]}
        onPress={() => router.push(`/incidents/${item.id}`)}
        activeOpacity={0.82}
      >
        {/* Status accent bar */}
        <View style={[styles.cardAccent, { backgroundColor: statusColor(item.status) }]} />

        <View style={styles.cardBody}>
          {/* Top row */}
          <View style={styles.cardTop}>
            <View style={styles.sourceChip}>
              {SOURCE_ICONS[item.source] ?? <Icon.Info size={13} color={Colors.textMuted} />}
              <Text style={[styles.sourceLabel, { color: C.textMuted }]}>{item.source}</Text>
            </View>
            <Badge
              label={item.status.replace('_', ' ')}
              variant={incidentVariant(item.status)}
              size="sm"
              dot
            />
          </View>

          {/* Description */}
          <Text style={styles.cardDesc} numberOfLines={2}>
            {item.description ?? `Incident ${item.id}`}
          </Text>

          {/* Bottom row */}
          <View style={styles.cardBottom}>
            <View style={styles.cardMeta}>
              <Icon.Clock size={12} color={Colors.textMuted} />
              <Text style={[styles.cardMetaText, { color: C.textMuted }]}>
                {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
              </Text>
            </View>
            {item.latitude && item.longitude && (
              <View style={styles.cardMeta}>
                <Icon.MapPin size={12} color={Colors.textMuted} />
                <Text style={[styles.cardMetaText, { color: C.textMuted }]}>
                  {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}
                </Text>
              </View>
            )}
            <View style={{ flex: 1 }} />
            <Icon.ChevronRight size={16} color={Colors.textMuted} />
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

function statusColor(status: IncidentStatus) {
  const map: Record<IncidentStatus, string> = {
    OPEN:        Colors.error,
    IN_PROGRESS: Colors.warning,
    ESCALATED:   Colors.error,
    RESOLVED:    Colors.success,
    CLOSED:      Colors.textMuted,
    CANCELLED:   Colors.textMuted,
    REJECTED:    Colors.textMuted,
  };
  return map[status] ?? Colors.textMuted;
}

export default function IncidentsScreen() {
  const t = useThemedStyles();
  const [filter, setFilter] = useState<IncidentStatus | 'ALL'>('ALL');

  const { data = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['incidents', 'me'],
    queryFn: () => incidentsApi.listMine({ limit: 100 }),
    staleTime: 30_000,
  });

  const filtered = filter === 'ALL'
    ? data
    : data.filter((d) => d.status === filter);

  return (
    <View style={[styles.root, t.bg]}>
      <Header title="My Incidents" showBack />

      {/* ── Filter scroll ────────────────────────────── */}
      <View style={styles.filtersWrap}>
        <FlatList
          data={FILTERS}
          horizontal
          keyExtractor={(f) => f.value}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersList}
          renderItem={({ item: f }) => (
            <TouchableOpacity
              style={[styles.filterChip, filter === f.value && styles.filterChipActive]}
              onPress={() => setFilter(f.value)}
            >
              <Text style={[
                styles.filterChipText,
                filter === f.value && styles.filterChipTextActive,
              ]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* ── Count row ───────────────────────────────── */}
      <View style={styles.countRow}>
        <Text style={[styles.countText, t.textMuted]}>
          {filtered.length} {filtered.length === 1 ? 'incident' : 'incidents'}
        </Text>
        {filter !== 'ALL' && (
          <TouchableOpacity onPress={() => setFilter('ALL')}>
            <Text style={styles.clearFilter}>Clear filter</Text>
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
          data={filtered}
          keyExtractor={(item) => String(item.id)}
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
          ListEmptyComponent={
            <Animated.View entering={FadeInDown.duration(400)} style={styles.emptyBox}>
              <View style={styles.emptyIconWrap}>
                <Icon.CheckCircle size={36} color={Colors.success} />
              </View>
              <Text style={[styles.emptyTitle, t.textPrimary]}>No incidents found</Text>
              <Text style={[styles.emptySub, t.textMuted]}>
                {filter === 'ALL'
                  ? 'You have not reported any incidents yet.'
                  : `No incidents with status "${filter.replace('_', ' ')}".`}
              </Text>
            </Animated.View>
          }
          renderItem={({ item, index }) => (
            <IncidentCard item={item} index={index} />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  filtersWrap: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  filtersList: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: 'rgba(59,130,246,0.12)',
    borderColor: Colors.primary,
  },
  filterChipText:       { fontSize: Typography.sm, fontFamily: 'Inter_500Medium', color: Colors.textMuted },
  filterChipTextActive: { color: Colors.primary },

  countRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
  },
  countText:   { fontSize: Typography.sm, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  clearFilter: { fontSize: Typography.sm, fontFamily: 'Inter_500Medium', color: Colors.primary },

  listContent: { paddingHorizontal: Spacing.base, paddingBottom: Spacing['4xl'], gap: Spacing.sm },

  card: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  cardAccent: { width: 4 },
  cardBody:   { flex: 1, padding: Spacing.md, gap: Spacing.sm },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sourceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.surfaceAlt,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  sourceLabel: { fontSize: 10, fontFamily: 'Inter_500Medium', color: Colors.textMuted },
  cardDesc: {
    fontSize: Typography.sm,
    fontFamily: 'Inter_500Medium',
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardMetaText: { fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted },

  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  emptyBox: { paddingTop: Spacing['4xl'], alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing['2xl'] },
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
  emptySub:   { fontSize: Typography.sm, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textAlign: 'center', lineHeight: 22 },
});