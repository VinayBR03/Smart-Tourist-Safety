import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Image, Linking,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge, incidentVariant } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icons';
import { incidentsApi } from '@/api/incidents';
import { mediaApi } from '@/api/media';
import { Typography, Spacing, Radius } from '@/constants/theme';
import { format, formatDistanceToNow } from 'date-fns';
import type { IncidentStatus, IncidentTimelineEntry, MediaResponse } from '@/types/api';
import { useThemedStyles } from '@/utils/themedStyles';
import { useColors } from '@/context/ThemeContext';

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

function MediaThumb({ mediaId, mediaType }: { mediaId: number; mediaType: string }) {
  const C = useColors();
  const isVideo = mediaType.includes('VIDEO');

  const { data, isLoading } = useQuery({
    queryKey: ['media', mediaId, 'url'],
    queryFn: () => mediaApi.getUrl(mediaId),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <View style={[styles.mediaThumbnail, { backgroundColor: C.surface, borderColor: C.border }]}>
        <ActivityIndicator size="small" color={C.primary} />
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.mediaThumbnail, { backgroundColor: C.surface, borderColor: C.border }]}
      onPress={() => data?.url && Linking.openURL(data.url)}
      activeOpacity={0.75}
    >
      {isVideo ? (
        <View style={[styles.mediaVideoOverlay, { backgroundColor: 'rgba(0,0,0,0.7)' }]}>
          <Icon.Play size={28} color="#fff" />
        </View>
      ) : (
        data?.url
          ? <Image source={{ uri: data.url }} style={styles.mediaImage} resizeMode="cover" />
          : <Icon.Image size={28} color={C.textMuted} />
      )}
      <View style={[styles.mediaTypeBadge, { backgroundColor: isVideo ? '#7C3AED' : '#3B82F6' }]}>
        {isVideo ? <Icon.Video size={10} color="#fff" /> : <Icon.Camera size={10} color="#fff" />}
      </View>
    </TouchableOpacity>
  );
}

function MediaSection({ incidentId }: { incidentId: number }) {
  const C = useColors();

  const { data: media = [], isLoading } = useQuery({
    queryKey: ['incident', incidentId, 'media'],
    queryFn: () => incidentsApi.getMedia(incidentId),
    enabled: !!incidentId,
  });

  if (isLoading || media.length === 0) return null;

  const evidence   = media.filter((m) => m.media_type.startsWith('INCIDENT_EVIDENCE'));
  const resolution = media.filter((m) => m.media_type.startsWith('INCIDENT_RESOLUTION'));

  return (
    <>
      {evidence.length > 0 && (
        <Animated.View entering={FadeInDown.duration(400).delay(200)}>
          <Text style={[styles.sectionTitle, { color: C.textMuted }]}>EVIDENCE</Text>
          <Card>
            <View style={styles.mediaGrid}>
              {evidence.map((m) => <MediaThumb key={m.id} mediaId={m.id} mediaType={m.media_type} />)}
            </View>
          </Card>
        </Animated.View>
      )}
      {resolution.length > 0 && (
        <Animated.View entering={FadeInDown.duration(400).delay(240)}>
          <Text style={[styles.sectionTitle, { color: C.textMuted }]}>RESOLUTION PHOTOS</Text>
          <Card>
            <View style={styles.mediaGrid}>
              {resolution.map((m) => <MediaThumb key={m.id} mediaId={m.id} mediaType={m.media_type} />)}
            </View>
          </Card>
        </Animated.View>
      )}
    </>
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

  if (incLoading || tlLoading) {
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
      <Header title={`Incident ${incident.id}`} showBack />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        <Animated.View entering={FadeInDown.duration(400)}>
          <Card style={styles.statusCard} elevated>
            <View style={styles.statusHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.incidentTitle, t.textPrimary]}>
                  {incident.description ?? `Incident ${incident.id}`}
                </Text>
                <Text style={[styles.incidentTime, t.textMuted]}>
                  {formatDistanceToNow(new Date(incident.created_at), { addSuffix: true })}
                </Text>
              </View>
              <Badge label={incident.status?.replace('_', ' ') ?? 'UNKNOWN'} variant={incidentVariant(incident.status)} size="sm" dot />
            </View>
            {incident.resolution_note && (
              <View style={[styles.resolutionNote, { backgroundColor: 'rgba(16,185,129,0.08)', borderColor: 'rgba(16,185,129,0.2)' }]}>
                <Icon.CheckCircle size={14} color="#10B981" />
                <Text style={[styles.resolutionNoteText, { color: '#10B981' }]}>{incident.resolution_note}</Text>
              </View>
            )}
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(80)}>
          <Text style={[styles.sectionTitle, t.textMuted]}>DETAILS</Text>
          <Card>
            <InfoRow label="Source"  value={incident.source ?? ''} icon={<Icon.Phone size={16} color="#3B82F6" />} />
            <View style={[styles.divider, { backgroundColor: t.C.border }]} />
            <InfoRow label="Created" value={incident.created_at ? format(new Date(incident.created_at), 'MMM d, yyyy HH:mm') : ''} icon={<Icon.Clock size={16} color={t.C.textMuted} />} />
            <View style={[styles.divider, { backgroundColor: t.C.border }]} />
            <InfoRow label="Updated" value={incident.updated_at ? format(new Date(incident.updated_at), 'MMM d, yyyy HH:mm') : ''} icon={<Icon.RefreshCw size={16} color={t.C.textMuted} />} />
            {incident.resolved_at && (
              <>
                <View style={[styles.divider, { backgroundColor: t.C.border }]} />
                <InfoRow label="Resolved" value={format(new Date(incident.resolved_at), 'MMM d, yyyy HH:mm')} icon={<Icon.CheckCircle size={16} color="#10B981" />} />
              </>
            )}
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

        <MediaSection incidentId={incidentId} />

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
  incidentTitle: { fontSize: Typography.base, fontFamily: 'SpaceGrotesk_600SemiBold' },
  incidentTime:  { fontSize: Typography.xs, fontFamily: 'Inter_400Regular', marginTop: 4 },
  resolutionNote:     { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.xs, padding: Spacing.sm, borderRadius: Radius.lg, borderWidth: 1, marginTop: Spacing.xs },
  resolutionNoteText: { flex: 1, fontSize: Typography.xs, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  sectionTitle:  { fontSize: Typography.xs, fontFamily: 'SpaceGrotesk_700Bold', letterSpacing: 0.8, textTransform: 'uppercase', marginTop: Spacing.base, marginBottom: Spacing.xs },
  infoRow:       { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, paddingVertical: Spacing.sm },
  infoIcon:      { width: 28, alignItems: 'center', paddingTop: 2 },
  infoLabel:     { fontSize: Typography.xs, fontFamily: 'Inter_400Regular', marginBottom: 2 },
  infoValue:     { fontSize: Typography.sm, fontFamily: 'Inter_500Medium' },
  divider:       { height: 1 },
  mediaGrid:        { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, padding: Spacing.xs },
  mediaThumbnail:   { width: 96, height: 96, borderRadius: Radius.lg, borderWidth: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  mediaImage:       { width: '100%', height: '100%' },
  mediaVideoOverlay:{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  mediaTypeBadge:   { position: 'absolute', bottom: 4, right: 4, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  timelineCard:     { paddingVertical: Spacing.sm },
  timelineStep:     { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, paddingVertical: Spacing.sm, position: 'relative' },
  timelineLine:     { position: 'absolute', left: 10, top: 32, bottom: -8, width: 1.5 },
  timelineDot:      { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#374151', backgroundColor: '#1F2937', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  timelineDotInner: { width: 8, height: 8, borderRadius: 4 },
  timelineContent:  { flex: 1, gap: 4 },
  timelineTop:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  timelineTime:     { fontSize: Typography.xs, fontFamily: 'Inter_400Regular' },
  timelineNote:     { fontSize: Typography.xs, fontFamily: 'Inter_400Regular', lineHeight: 18 },
});