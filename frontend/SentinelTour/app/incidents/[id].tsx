import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge, incidentVariant } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icons';
import { incidentsApi } from '@/api/incidents';
import { Colors, Typography, Spacing, Radius } from '@/constants/theme';
import { format, formatDistanceToNow } from 'date-fns';
import type { IncidentStatus, IncidentTimelineEntry } from '@/types/api';
import { useThemedStyles } from '@/utils/themedStyles';

const STATUS_ORDER: IncidentStatus[] = [
  'OPEN', 'IN_PROGRESS', 'ESCALATED', 'RESOLVED', 'CLOSED',
];

const t = useThemedStyles();

// ─── Timeline step ────────────────────────────────────

function TimelineStep({
  entry,
  isLast,
  index,
}: {
  entry: IncidentTimelineEntry;
  isLast: boolean;
  index: number;
}) {
  const isTerminal = ['RESOLVED', 'CLOSED', 'CANCELLED', 'REJECTED'].includes(entry.status);

  return (
    <Animated.View
      entering={FadeInDown.duration(350).delay(index * 80)}
      style={styles.timelineStep}
    >
      {/* Connector line */}
      {!isLast && <View style={styles.timelineLine} />}

      {/* Dot */}
      <View style={[
        styles.timelineDot,
        isTerminal && styles.timelineDotTerminal,
      ]}>
        {isTerminal
          ? <Icon.CheckCircle size={10} color="#fff" strokeWidth={2.5} />
          : <View style={styles.timelineDotInner} />
        }
      </View>

      {/* Content */}
      <View style={styles.timelineContent}>
        <View style={styles.timelineTop}>
          <Badge
            label={entry.status.replace('_', ' ')}
            variant={incidentVariant(entry.status as IncidentStatus)}
            size="sm"
          />
          <Text style={styles.timelineTime}>
            {format(new Date(entry.changed_at), 'MMM d, HH:mm')}
          </Text>
        </View>
        {entry.note && (
          <Text style={styles.timelineNote}>{entry.note}</Text>
        )}
      </View>
    </Animated.View>
  );
}

function InfoRow({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

export default function IncidentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const incidentId = parseInt(id, 10);

  const { data: incident, isLoading: incLoading } = useQuery({
    queryKey: ['incident', incidentId],
    queryFn: () => incidentsApi.getById(incidentId),
    enabled: !!incidentId,
  });

  const { data: timeline = [], isLoading: tlLoading } = useQuery({
    queryKey: ['incident', incidentId, 'timeline'],
    queryFn: () => incidentsApi.getTimeline(incidentId),
    enabled: !!incidentId,
  });

  const isLoading = incLoading || tlLoading;

  if (isLoading) {
    return (
      <View style={[styles.root, t.bg]}>
        <Header title="Incident Detail" showBack />
        <View style={styles.loadingBox}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      </View>
    );
  }

  if (!incident) {
    return (
      <View style={[styles.root, t.bg]}>
        <Header title="Incident Detail" showBack />
        <View style={styles.loadingBox}>
          <Text style={styles.errorText}>Incident not found.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, t.bg]}>
      <Header title={`Incident #${incident.id}`} showBack />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Status card ──────────────────────────────── */}
        <Animated.View entering={FadeInDown.duration(400)}>
          <Card style={styles.statusCard} accent accentColor={
            incident.status === 'OPEN' ? Colors.error
            : incident.status === 'IN_PROGRESS' ? Colors.warning
            : incident.status === 'RESOLVED' ? Colors.success
            : Colors.textMuted
          }>
            <View style={styles.statusTop}>
              <Badge
                label={incident.status.replace('_', ' ')}
                variant={incidentVariant(incident.status)}
              />
              <Text style={styles.incidentId}>#{incident.id}</Text>
            </View>
            <Text style={styles.incidentDesc}>
              {incident.description ?? 'No description provided'}
            </Text>
            <View style={styles.incidentMeta}>
              <Icon.Clock size={13} color={Colors.textMuted} />
              <Text style={styles.incidentMetaText}>
                Reported {formatDistanceToNow(new Date(incident.created_at), { addSuffix: true })}
              </Text>
            </View>
          </Card>
        </Animated.View>

        {/* ── Info grid ────────────────────────────────── */}
        <Animated.View entering={FadeInDown.duration(400).delay(80)}>
          <Text style={styles.sectionTitle}>Details</Text>
          <Card>
            <InfoRow
              label="Source"
              value={incident.source}
              icon={<Icon.Info size={16} color={Colors.primary} />}
            />
            <View style={styles.rowDivider} />
            <InfoRow
              label="Reported"
              value={format(new Date(incident.created_at), 'MMM d, yyyy HH:mm')}
              icon={<Icon.Clock size={16} color={Colors.textMuted} />}
            />
            <View style={styles.rowDivider} />
            <InfoRow
              label="Last Updated"
              value={format(new Date(incident.updated_at), 'MMM d, yyyy HH:mm')}
              icon={<Icon.RefreshCw size={16} color={Colors.textMuted} />}
            />
            {incident.latitude && incident.longitude && (
              <>
                <View style={styles.rowDivider} />
                <InfoRow
                  label="Location"
                  value={`${incident.latitude.toFixed(5)}, ${incident.longitude.toFixed(5)}`}
                  icon={<Icon.MapPin size={16} color={Colors.primary} />}
                />
              </>
            )}
            {incident.resolution_note && (
              <>
                <View style={styles.rowDivider} />
                <InfoRow
                  label="Resolution Note"
                  value={incident.resolution_note}
                  icon={<Icon.CheckCircle size={16} color={Colors.success} />}
                />
              </>
            )}
          </Card>
        </Animated.View>

        {/* ── Timeline ─────────────────────────────────── */}
        <Animated.View entering={FadeInDown.duration(400).delay(160)}>
          <Text style={styles.sectionTitle}>Status Timeline</Text>
          <Card>
            {timeline.length === 0 ? (
              <Text style={styles.noTimeline}>No status updates yet.</Text>
            ) : (
              <View style={styles.timeline}>
                {timeline.map((entry, i) => (
                  <TimelineStep
                    key={entry.changed_at || i}
                    entry={entry}
                    isLast={i === timeline.length - 1}
                    index={i}
                  />
                ))}
              </View>
            )}
          </Card>
        </Animated.View>

        <View style={{ height: Spacing['2xl'] }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:        { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingHorizontal: Spacing.base, paddingBottom: Spacing['4xl'], gap: Spacing.base, paddingTop: Spacing.base },
  loadingBox:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText:   { fontSize: Typography.base, fontFamily: 'Inter_400Regular', color: Colors.textMuted },

  statusCard: { gap: Spacing.sm },
  statusTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  incidentId: { fontSize: Typography.sm, fontFamily: 'SpaceGrotesk_700Bold', color: Colors.textMuted },
  incidentDesc: { fontSize: Typography.base, fontFamily: 'Inter_500Medium', color: Colors.textPrimary, lineHeight: 24 },
  incidentMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  incidentMetaText: { fontSize: Typography.xs, fontFamily: 'Inter_400Regular', color: Colors.textMuted },

  sectionTitle: {
    fontSize: Typography.sm,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: Colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
  },

  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, paddingVertical: Spacing.sm },
  infoIcon: { width: 32, alignItems: 'center', paddingTop: 2 },
  infoLabel: { fontSize: Typography.xs, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginBottom: 2 },
  infoValue: { fontSize: Typography.sm, fontFamily: 'Inter_500Medium', color: Colors.textPrimary },
  rowDivider: { height: 1, backgroundColor: Colors.border, marginLeft: 48 },

  timeline: { gap: 0 },
  timelineStep: { flexDirection: 'row', gap: Spacing.md, position: 'relative', paddingBottom: Spacing.base },
  timelineLine: {
    position: 'absolute',
    left: 11,
    top: 24,
    bottom: 0,
    width: 1.5,
    backgroundColor: Colors.border,
  },
  timelineDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  timelineDotTerminal: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  timelineDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  timelineContent: { flex: 1, gap: 4, paddingTop: 2 },
  timelineTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timelineTime: { fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  timelineNote: { fontSize: Typography.xs, fontFamily: 'Inter_400Regular', color: Colors.textSecondary, lineHeight: 18 },
  noTimeline: { fontSize: Typography.sm, fontFamily: 'Inter_400Regular', color: Colors.textMuted, textAlign: 'center', paddingVertical: Spacing.md },
});