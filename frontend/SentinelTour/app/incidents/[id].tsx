import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge, incidentVariant } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icons';
import { incidentsApi } from '@/api/incidents';
import { Typography, Spacing, Radius } from '@/constants/theme';
import { format, formatDistanceToNow } from 'date-fns';
import type { IncidentStatus, IncidentTimelineEntry } from '@/types/api';
import { useThemedStyles } from '@/utils/themedStyles';
import { useColors } from '@/context/ThemeContext';

const STATUS_ORDER: IncidentStatus[] = ['OPEN', 'IN_PROGRESS', 'ESCALATED', 'RESOLVED', 'CLOSED'];

function TimelineStep({ entry, isLast, index }: { entry: IncidentTimelineEntry; isLast: boolean; index: number }) {
  const C = useColors();
  const isTerminal = ['RESOLVED', 'CLOSED', 'CANCELLED', 'REJECTED'].includes(entry.status);
  return (
    <Animated.View entering={FadeInDown.duration(350).delay(index * 80)} style={styles.timelineStep}>
      {!isLast && <View style={[styles.timelineLine, { backgroundColor: C.border }]} />}
      <View style={[styles.timelineDot, isTerminal && { backgroundColor: '#10B981', borderColor: '#10B981' }]}>
        {isTerminal
          ? <Icon.CheckCircle size={10} color="#fff" strokeWidth={2.5} />
          : <View style={[styles.timelineDotInner, { backgroundColor: C.primary }]} />
        }
      </View>
      <View style={styles.timelineContent}>
        <View style={styles.timelineTop}>
          <Badge label={entry.status.replace('_', ' ')} variant={incidentVariant(entry.status as IncidentStatus)} size="sm" />
          <Text style={[styles.timelineTime, { color: C.textMuted }]}>
            {format(new Date(entry.changed_at ?? entry.created_at), 'MMM d, HH:mm')}
          </Text>
        </View>
        {entry.note && <Text style={[styles.timelineNote, { color: C.textSecondary }]}>{entry.note}</Text>}
      </View>
    </Animated.View>
  );
}

function InfoRow({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  const C = useColors();
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.infoLabel, { color: C.textMuted }]}>{label}</Text>
        <Text style={[styles.infoValue, { color: C.textPrimary }]}>{value || '—'}</Text>
      </View>
    </View>
  );
}

export default function IncidentDetailScreen() {
  const t = useThemedStyles();
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
        <Header title="Incident Details" showBack />
        <View style={styles.loadingBox}><ActivityIndicator color="#3B82F6" size="large" /></View>
      </View>
    );
  }

  if (!incident) {
    return (
      <View style={[styles.root, t.bg]}>
        <Header title="Incident Details" showBack />
        <View style={styles.loadingBox}>
          <Text style={[styles.errorText, t.textMuted]}>Incident not found.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, t.bg]}>
      <Header title={`Incident #${incident.id}`} showBack />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Status card */}
        <Animated.View entering={FadeInDown.duration(400)}>
          <Card style={styles.statusCard} elevated>
            <View style={styles.statusHeader}>
              <View>
                <Text style={[styles.incidentTitle, t.textPrimary]}>
                  {incident.description ?? `Incident #${incident.id}`}
                </Text>
                <Text style={[styles.incidentTime, t.textMuted]}>
                  {formatDistanceToNow(new Date(incident.created_at), { addSuffix: true })}
                </Text>
              </View>
              <Badge label={incident.status?.replace('_', ' ') ?? 'UNKNOWN'} variant={incidentVariant(incident.status)} size="sm" dot />
            </View>
          </Card>
        </Animated.View>

        {/* Details */}
        <Animated.View entering={FadeInDown.duration(400).delay(80)}>
          <Text style={[styles.sectionTitle, t.textMuted]}>DETAILS</Text>
          <Card>
            <InfoRow label="Source"   value={incident.source ?? ''}   icon={<Icon.Phone size={16} color="#3B82F6" />} />
            <View style={[styles.divider, { backgroundColor: t.C.border }]} />
            <InfoRow label="Created"  value={incident.created_at ? format(new Date(incident.created_at), 'MMM d, yyyy HH:mm') : ''} icon={<Icon.Clock size={16} color={t.C.textMuted} />} />
            <View style={[styles.divider, { backgroundColor: t.C.border }]} />
            <InfoRow label="Updated"  value={incident.updated_at ? format(new Date(incident.updated_at), 'MMM d, yyyy HH:mm') : ''} icon={<Icon.RefreshCw size={16} color={t.C.textMuted} />} />
            {incident.latitude && incident.longitude && (
              <>
                <View style={[styles.divider, { backgroundColor: t.C.border }]} />
                <InfoRow
                  label="Location"
                  value={`${incident.latitude.toFixed(5)}, ${incident.longitude.toFixed(5)}`}
                  icon={<Icon.MapPin size={16} color="#EF4444" />}
                />
              </>
            )}
          </Card>
        </Animated.View>

        {/* Timeline */}
        {timeline.length > 0 && (
          <Animated.View entering={FadeInDown.duration(400).delay(160)}>
            <Text style={[styles.sectionTitle, t.textMuted]}>TIMELINE</Text>
            <Card style={styles.timelineCard}>
              {timeline.map((entry, i) => (
                <TimelineStep key={`${entry.status}-${i}`} entry={entry} isLast={i === timeline.length - 1} index={i} />
              ))}
            </Card>
          </Animated.View>
        )}

        <View style={{ height: Spacing['2xl'] }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:          { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.base, paddingBottom: Spacing['4xl'], gap: Spacing.sm },
  loadingBox:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText:     { fontSize: Typography.base, fontFamily: 'Inter_400Regular' },
  statusCard:    { gap: Spacing.sm },
  statusHeader:  { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: Spacing.sm },
  incidentTitle: { fontSize: Typography.base, fontFamily: 'SpaceGrotesk_600SemiBold', flex: 1 },
  incidentTime:  { fontSize: Typography.xs, fontFamily: 'Inter_400Regular', marginTop: 4 },
  sectionTitle:  { fontSize: Typography.xs, fontFamily: 'SpaceGrotesk_700Bold', letterSpacing: 0.8, textTransform: 'uppercase', marginTop: Spacing.base, marginBottom: Spacing.xs },
  infoRow:       { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, paddingVertical: Spacing.sm },
  infoIcon:      { width: 28, alignItems: 'center', paddingTop: 2 },
  infoLabel:     { fontSize: Typography.xs, fontFamily: 'Inter_400Regular', marginBottom: 2 },
  infoValue:     { fontSize: Typography.sm, fontFamily: 'Inter_500Medium' },
  divider:       { height: 1 },
  timelineCard:  { paddingVertical: Spacing.sm },
  timelineStep:  { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, paddingVertical: Spacing.sm, position: 'relative' },
  timelineLine:  { position: 'absolute', left: 10, top: 32, bottom: -8, width: 1.5 },
  timelineDot:   { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#374151', backgroundColor: '#1F2937', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  timelineDotInner: { width: 8, height: 8, borderRadius: 4 },
  timelineContent:  { flex: 1, gap: 4 },
  timelineTop:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  timelineTime:     { fontSize: Typography.xs, fontFamily: 'Inter_400Regular' },
  timelineNote:     { fontSize: Typography.xs, fontFamily: 'Inter_400Regular', lineHeight: 18 },
});
