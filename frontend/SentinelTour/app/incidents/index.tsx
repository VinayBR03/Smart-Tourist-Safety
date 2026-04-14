import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, RefreshControl, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Header } from '@/components/layout/Header';
import { Badge, incidentVariant } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icons';
import { incidentsApi } from '@/api/incidents';
import { Typography, Spacing, Radius } from '@/constants/theme';
import { formatDistanceToNow } from 'date-fns';
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
  MOBILE: <Icon.Phone    size={13} color="#3B82F6"  />,
  IOT:    <Icon.Wifi     size={13} color="#06B6D4"  />,
  SYSTEM: <Icon.Settings size={13} color="#6B7280"  />,
  HEALTH: <Icon.Heart    size={13} color="#EF4444"  />,
  ML:     <Icon.Activity size={13} color="#F59E0B"  />,
};

function statusColor(status: IncidentStatus) {
  const map: Record<IncidentStatus, string> = {
    OPEN: '#EF4444', IN_PROGRESS: '#F59E0B', ESCALATED: '#EF4444',
    RESOLVED: '#10B981', CLOSED: '#6B7280', CANCELLED: '#6B7280', REJECTED: '#6B7280',
  };
  return map[status] ?? '#6B7280';
}

function IncidentCard({ item, index }: { item: IncidentSummary; index: number }) {
  const C = useColors();
  return (
    <Animated.View entering={FadeInDown.duration(350).delay(index * 50)}>
      <TouchableOpacity
        style={[styles.card, { backgroundColor: C.surface, borderColor: C.border }]}
        onPress={() => router.push(`/incidents/${item.id}`)}
        activeOpacity={0.82}
      >
        <View style={[styles.cardAccent, { backgroundColor: statusColor(item.status) }]} />
        <View style={styles.cardBody}>
          <View style={styles.cardTop}>
            <View style={[styles.sourceChip, { backgroundColor: C.surfaceAlt }]}>
              {SOURCE_ICONS[item.source] ?? <Icon.Info size={13} color={C.textMuted} />}
              <Text style={[styles.sourceLabel, { color: C.textMuted }]}>{item.source}</Text>
            </View>
            <Badge label={item.status.replace('_', ' ')} variant={incidentVariant(item.status)} size="sm" dot />
          </View>
          <Text style={[styles.cardDesc, { color: C.textPrimary }]} numberOfLines={2}>
            {item.description ?? `Incident #${item.id}`}
          </Text>
          <View style={styles.cardBottom}>
            <View style={styles.cardMeta}>
              <Icon.Clock size={12} color={C.textMuted} />
              <Text style={[styles.cardMetaText, { color: C.textMuted }]}>
                {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
              </Text>
            </View>
            {item.latitude && item.longitude && (
              <View style={styles.cardMeta}>
                <Icon.MapPin size={12} color={C.textMuted} />
                <Text style={[styles.cardMetaText, { color: C.textMuted }]}>
                  {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}
                </Text>
              </View>
            )}
            <View style={{ flex: 1 }} />
            <Icon.ChevronRight size={16} color={C.textMuted} />
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function IncidentsScreen() {
  const t = useThemedStyles();
  const [filter, setFilter] = useState<IncidentStatus | 'ALL'>('ALL');

  const { data = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['incidents', 'me'],
    queryFn: () => incidentsApi.listMine({ limit: 100 }),
    staleTime: 30_000,
  });

  const filtered = filter === 'ALL' ? data : data.filter((d) => d.status === filter);

  return (
    <View style={[styles.root, t.bg]}>
      <Header title="My Incidents" showBack />

      {/* Filter chips */}
      <View style={[styles.filtersWrap, { borderBottomColor: t.C.border }]}>
        <FlatList
          data={FILTERS} horizontal
          keyExtractor={(f) => f.value}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersList}
          renderItem={({ item: f }) => (
            <TouchableOpacity
              style={[
                styles.filterChip, t.surface, t.border,
                filter === f.value && { backgroundColor: 'rgba(59,130,246,0.12)', borderColor: t.C.primary },
              ]}
              onPress={() => setFilter(f.value)}
            >
              <Text style={[styles.filterChipText, { color: filter === f.value ? t.C.primary : t.C.textMuted }]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Count row */}
      <View style={styles.countRow}>
        <Text style={[styles.countText, t.textMuted]}>
          {filtered.length} {filtered.length === 1 ? 'incident' : 'incidents'}
        </Text>
        {filter !== 'ALL' && (
          <TouchableOpacity onPress={() => setFilter('ALL')}>
            <Text style={[styles.clearFilter, { color: t.C.primary }]}>Clear filter</Text>
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <View style={styles.loadingBox}><ActivityIndicator color="#3B82F6" size="large" /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#3B82F6" colors={['#3B82F6']} />}
          ListEmptyComponent={
            <Animated.View entering={FadeInDown.duration(400)} style={styles.emptyBox}>
              <View style={[styles.emptyIconWrap, t.surface, t.border]}>
                <Icon.CheckCircle size={36} color="#10B981" />
              </View>
              <Text style={[styles.emptyTitle, t.textPrimary]}>No incidents found</Text>
              <Text style={[styles.emptySub, t.textMuted]}>
                {filter === 'ALL' ? 'You have not reported any incidents yet.' : `No incidents with status "${filter.replace('_', ' ')}".`}
              </Text>
            </Animated.View>
          }
          renderItem={({ item, index }) => <IncidentCard item={item} index={index} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  filtersWrap:   { borderBottomWidth: 1 },
  filtersList:   { paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm, gap: Spacing.xs },
  filterChip:    { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.full, borderWidth: 1 },
  filterChipText:{ fontSize: Typography.sm, fontFamily: 'Inter_500Medium' },
  countRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm },
  countText:     { fontSize: Typography.sm, fontFamily: 'Inter_400Regular' },
  clearFilter:   { fontSize: Typography.sm, fontFamily: 'Inter_500Medium' },
  listContent:   { paddingHorizontal: Spacing.base, paddingBottom: Spacing['4xl'], gap: Spacing.sm },
  card:          { flexDirection: 'row', borderRadius: Radius.xl, borderWidth: 1, overflow: 'hidden' },
  cardAccent:    { width: 4 },
  cardBody:      { flex: 1, padding: Spacing.md, gap: Spacing.sm },
  cardTop:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sourceChip:    { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full },
  sourceLabel:   { fontSize: 10, fontFamily: 'Inter_500Medium' },
  cardDesc:      { fontSize: Typography.sm, fontFamily: 'Inter_500Medium', lineHeight: 20 },
  cardBottom:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  cardMeta:      { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardMetaText:  { fontSize: 10, fontFamily: 'Inter_400Regular' },
  loadingBox:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyBox:      { paddingTop: Spacing['4xl'], alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing['2xl'] },
  emptyIconWrap: { width: 80, height: 80, borderRadius: 28, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTitle:    { fontSize: Typography.xl, fontFamily: 'SpaceGrotesk_700Bold' },
  emptySub:      { fontSize: Typography.sm, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 22 },
});
