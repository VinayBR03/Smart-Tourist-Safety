import { useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, RefreshControl, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge, riskVariant } from '@/components/ui/Badge';
import { HealthMetricCard } from '@/components/ui/HealthMetricCard';
import { Icon } from '@/components/ui/Icons';
import { useAuthStore } from '@/store/authStore';
import { useDeviceStore } from '@/store/deviceStore';
import { healthApi } from '@/api/health';
import { zonesApi } from '@/api/zones';
import { incidentsApi } from '@/api/incidents';
import { locationService } from '@/services/locationService';
import { Typography, Spacing, Radius } from '@/constants/theme';
import { format, formatDistanceToNow } from 'date-fns';
import type { IncidentSummary, ZoneWithStatus } from '@/types/api';
import { useThemedStyles } from '@/utils/themedStyles';
import { useColors } from '@/context/ThemeContext';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

// ─── Sub-components with useColors() ─────────────────────

function SectionHeader({ title, actionLabel, onAction }: { title: string; actionLabel?: string; onAction?: () => void }) {
  const C = useColors();
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: C.textPrimary }]}>{title}</Text>
      {actionLabel && onAction && (
        <TouchableOpacity onPress={onAction} style={styles.sectionActionBtn}>
          <Text style={[styles.sectionAction, { color: C.primary }]}>{actionLabel}</Text>
          <Icon.ChevronRight size={14} color={C.primary} />
        </TouchableOpacity>
      )}
    </View>
  );
}

function ZoneCard({ zone, index }: { zone: ZoneWithStatus; index: number }) {
  const C = useColors();
  const risk = zone.status?.risk_level ?? 'LOW';
  const riskColor = risk === 'HIGH' ? C.riskHigh : risk === 'MEDIUM' ? C.riskMedium : C.riskLow;
  return (
    <Animated.View entering={FadeInRight.duration(350).delay(index * 60)}>
      <TouchableOpacity
        style={[styles.zoneCard, { backgroundColor: C.surface, borderColor: C.border }]}
        onPress={() => router.push('/(tabs)/map')} activeOpacity={0.8}
      >
        <View style={[styles.zoneAccent, { backgroundColor: riskColor }]} />
        <View style={styles.zoneCardContent}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.zoneName, { color: C.textPrimary }]} numberOfLines={1}>{zone.name}</Text>
            <Text style={[styles.zoneType, { color: C.textMuted }]}>{zone.zone_type}</Text>
          </View>
          <View style={styles.zoneRight}>
            <Badge label={risk} variant={riskVariant(risk)} size="sm" dot />
            {zone.status && (
              <View style={styles.zoneCountRow}>
                <Icon.User size={11} color={C.textMuted} />
                <Text style={[styles.zoneCount, { color: C.textMuted }]}>{zone.status.tourist_count}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

function IncidentRow({ incident, index }: { incident: IncidentSummary; index: number }) {
  const C = useColors();
  const statusColor =
    incident.status === 'OPEN' || incident.status === 'ESCALATED' ? C.error :
    incident.status === 'IN_PROGRESS' ? C.warning :
    incident.status === 'RESOLVED' ? C.success : C.textMuted;
  return (
    <Animated.View entering={FadeInDown.duration(350).delay(index * 60)}>
      <TouchableOpacity
        style={[styles.incidentRow, { backgroundColor: C.surface, borderColor: C.border }]}
        onPress={() => router.push(`/incidents/${incident.id}`)} activeOpacity={0.8}
      >
        <View style={[styles.incidentDot, { backgroundColor: statusColor }]} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.incidentDesc, { color: C.textPrimary }]} numberOfLines={1}>
            {incident.description ?? `Incident #${incident.id}`}
          </Text>
          <Text style={[styles.incidentMeta, { color: C.textMuted }]}>
            {incident.source} · {formatDistanceToNow(new Date(incident.created_at), { addSuffix: true })}
          </Text>
        </View>
        <Badge
          label={incident.status.replace('_', ' ')}
          variant={incident.status === 'OPEN' ? 'error' : incident.status === 'IN_PROGRESS' ? 'warning' : incident.status === 'RESOLVED' ? 'success' : 'muted'}
          size="sm"
        />
      </TouchableOpacity>
    </Animated.View>
  );
}

function QuickAction({ icon, label, color, onPress }: { icon: React.ReactNode; label: string; color: string; onPress: () => void }) {
  const C = useColors();
  return (
    <TouchableOpacity style={styles.quickAction} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.quickActionIcon, { backgroundColor: `${color}18`, borderColor: `${color}30` }]}>
        {icon}
      </View>
      <Text style={[styles.quickActionLabel, { color: C.textSecondary }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function NoDataCard({ icon, message, action }: { icon: React.ReactNode; message: string; action?: { label: string; onPress: () => void } }) {
  const C = useColors();
  return (
    <Card style={styles.noData}>
      <View style={styles.noDataIcon}>{icon}</View>
      <Text style={[styles.noDataText, { color: C.textMuted }]}>{message}</Text>
      {action && (
        <TouchableOpacity style={styles.noDataBtn} onPress={action.onPress}>
          <Text style={styles.noDataBtnText}>{action.label}</Text>
        </TouchableOpacity>
      )}
    </Card>
  );
}

// ─── Main Screen ──────────────────────────────────────────
export default function HomeScreen() {
  const t = useThemedStyles();
  const { user }   = useAuthStore();
  const { device } = useDeviceStore();

  const { data: health, isLoading: healthLoading, refetch: refetchHealth } = useQuery({
    queryKey: ['health', 'latest'], queryFn: healthApi.getLatest,
    refetchInterval: 15_000, retry: false,
  });
  const { data: zones, refetch: refetchZones } = useQuery({
    queryKey: ['zones'], queryFn: zonesApi.list, staleTime: 60_000,
  });
  const { data: incidents, refetch: refetchIncidents } = useQuery({
    queryKey: ['incidents', 'me'], queryFn: () => incidentsApi.listMine({ limit: 3 }), refetchInterval: 60_000,
  });

  useEffect(() => {
    (async () => {
      const granted = await locationService.requestPermissions();
      if (granted) locationService.startTracking(() => device?.batteryPercentage ?? undefined);
    })();
    return () => locationService.stopTracking();
  }, []);

  const onRefresh = useCallback(() => { refetchHealth(); refetchZones(); refetchIncidents(); }, []);

  const firstName     = user?.full_name?.split(' ')[0] ?? 'Tourist';
  const highRiskZones = zones?.filter((z) => z.status?.risk_level === 'HIGH') ?? [];

  return (
    <View style={[styles.root, t.bg]}>
      <Header />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} tintColor="#3B82F6" colors={['#3B82F6']} />}
      >
        {/* Greeting */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.hero}>
          <View>
            <Text style={[styles.greeting, t.textSecondary]}>{getGreeting()},</Text>
            <Text style={[styles.name, t.textPrimary]}>{firstName}</Text>
          </View>
          <View style={styles.heroMeta}>
            <Text style={[styles.date, t.textMuted]}>{format(new Date(), 'EEE, MMM d')}</Text>
            {device?.isConnected ? (
              <View style={styles.devicePill}>
                <View style={styles.deviceDot} />
                <Text style={styles.devicePillText}>Wristband Active</Text>
              </View>
            ) : (
              <TouchableOpacity style={styles.connectPill} onPress={() => router.push('/devices')}>
                <Text style={styles.connectPillText}>Connect Wristband</Text>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>

        {/* High Risk Alert */}
        {highRiskZones.length > 0 && (
          <Animated.View entering={FadeInDown.duration(400).delay(80)}>
            <TouchableOpacity style={styles.alertBanner} activeOpacity={0.85}>
              <View style={styles.alertBannerLeft}>
                <Icon.AlertTriangle size={22} color="#EF4444" />
                <View>
                  <Text style={styles.alertBannerTitle}>{highRiskZones.length} High-Risk Zone{highRiskZones.length > 1 ? 's' : ''} Nearby</Text>
                  <Text style={styles.alertBannerSub}>{highRiskZones[0].name} · Stay alert</Text>
                </View>
              </View>
              <Icon.ChevronRight size={20} color="#EF4444" />
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Health Metrics */}
        <Animated.View entering={FadeInDown.duration(400).delay(120)}>
          <SectionHeader title="Health Metrics" actionLabel="View All" onAction={() => router.push('/(tabs)/health')} />
          {healthLoading ? (
            <View style={styles.loadingBox}><ActivityIndicator color="#3B82F6" /></View>
          ) : health ? (
            <View style={styles.metricsGrid}>
              <HealthMetricCard label="Heart Rate" value={health.heart_rate} unit="bpm" icon={<Icon.HeartPulse size={20} color="#EF4444" />} color="#EF4444" isAlert={!!health.is_alert && health.alert_type === 'HEART_RATE'} index={0} />
              <HealthMetricCard label="SpO₂" value={health.spo2} unit="%" icon={<Icon.Droplet size={20} color="#3B82F6" />} color="#3B82F6" isAlert={!!health.is_alert && health.alert_type === 'SPO2'} index={1} />
              <HealthMetricCard label="Body Temp" value={health.body_temperature} unit="°C" icon={<Icon.Thermometer size={20} color="#F59E0B" />} color="#F59E0B" isAlert={!!health.is_alert && health.alert_type === 'TEMPERATURE'} index={2} />
              <HealthMetricCard label="Battery" value={health.battery_percentage ?? device?.batteryPercentage ?? null} unit="%" icon={<Icon.Battery size={20} color={(health.battery_percentage ?? 100) < 20 ? '#EF4444' : '#10B981'} />} color={(health.battery_percentage ?? 100) < 20 ? '#EF4444' : '#10B981'} index={3} />
            </View>
          ) : (
            <NoDataCard icon={<Icon.HeartPulse size={32} color={t.C.textMuted} />}
              message={device?.isConnected ? 'Waiting for first reading...' : 'Connect your wristband to see health metrics'}
              action={device?.isConnected ? undefined : { label: 'Connect', onPress: () => router.push('/devices') }}
            />
          )}
        </Animated.View>

        {/* Zone Status */}
        <Animated.View entering={FadeInDown.duration(400).delay(200)}>
          <SectionHeader title="Zone Status" actionLabel="View Map" onAction={() => router.push('/(tabs)/map')} />
          {zones && zones.length > 0 ? (
            <View style={styles.zoneList}>{zones.slice(0, 4).map((zone, i) => <ZoneCard key={zone.id} zone={zone} index={i} />)}</View>
          ) : (
            <NoDataCard icon={<Icon.Map size={32} color={t.C.textMuted} />} message="No zones configured" />
          )}
        </Animated.View>

        {/* Recent Incidents */}
        <Animated.View entering={FadeInDown.duration(400).delay(280)}>
          <SectionHeader title="Recent Incidents" actionLabel="All Incidents" onAction={() => router.push('/incidents')} />
          {incidents && incidents.length > 0 ? (
            <View style={styles.incidentList}>{incidents.map((inc, i) => <IncidentRow key={inc.id} incident={inc} index={i} />)}</View>
          ) : (
            <NoDataCard icon={<Icon.List size={32} color={t.C.textMuted} />} message="No incidents reported — stay safe!" />
          )}
        </Animated.View>

        {/* Quick Actions */}
        <Animated.View entering={FadeInDown.duration(400).delay(360)}>
          <SectionHeader title="Quick Actions" />
          <View style={styles.quickActions}>
            <QuickAction icon={<Icon.ShieldAlert size={26} color="#DC2626" />} label="SOS" color="#DC2626" onPress={() => router.push('/(tabs)/sos')} />
            <QuickAction icon={<Icon.Navigation size={26} color="#3B82F6" />} label="Location" color="#3B82F6" onPress={() => router.push('/(tabs)/map')} />
            <QuickAction icon={<Icon.Plus size={26} color="#F59E0B" />} label="Report" color="#F59E0B" onPress={() => router.push('/incidents')} />
            <QuickAction icon={<Icon.Bluetooth size={26} color="#06B6D4" />} label="Wristband" color="#06B6D4" onPress={() => router.push('/devices')} />
          </View>
        </Animated.View>

        <View style={{ height: Spacing['2xl'] }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.base, paddingBottom: Spacing['4xl'] },
  hero:    { paddingTop: Spacing.lg, paddingBottom: Spacing.base, gap: Spacing.sm },
  greeting:{ fontSize: Typography.md,  fontFamily: 'Inter_400Regular' },
  name:    { fontSize: Typography['3xl'], fontFamily: 'SpaceGrotesk_700Bold' },
  heroMeta:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  date:    { fontSize: Typography.sm, fontFamily: 'Inter_400Regular' },
  devicePill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(16,185,129,0.1)', borderRadius: Radius.full,
    borderWidth: 1, borderColor: 'rgba(16,185,129,0.25)',
    paddingHorizontal: Spacing.sm, paddingVertical: 4, gap: 5,
  },
  deviceDot:     { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' },
  devicePillText:{ fontSize: Typography.xs, fontFamily: 'Inter_500Medium', color: '#10B981' },
  connectPill: {
    backgroundColor: 'rgba(59,130,246,0.1)', borderRadius: Radius.full,
    borderWidth: 1, borderColor: 'rgba(59,130,246,0.25)',
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
  },
  connectPillText: { fontSize: Typography.xs, fontFamily: 'Inter_500Medium', color: '#3B82F6' },
  alertBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)',
    borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.base,
  },
  alertBannerLeft:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  alertBannerTitle: { fontSize: Typography.sm, fontFamily: 'SpaceGrotesk_600SemiBold', color: '#EF4444' },
  alertBannerSub:   { fontSize: Typography.xs, fontFamily: 'Inter_400Regular', color: '#9CA3AF', marginTop: 2 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.xl, marginBottom: Spacing.sm },
  sectionTitle:     { fontSize: Typography.md, fontFamily: 'SpaceGrotesk_700Bold' },
  sectionActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  sectionAction:    { fontSize: Typography.sm, fontFamily: 'Inter_500Medium' },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  loadingBox:  { height: 100, alignItems: 'center', justifyContent: 'center' },
  zoneList:    { gap: Spacing.sm },
  zoneCard: {
    flexDirection: 'row', borderRadius: Radius.lg,
    borderWidth: 1, overflow: 'hidden',
  },
  zoneAccent:      { width: 4 },
  zoneCardContent: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: Spacing.sm },
  zoneName:  { fontSize: Typography.base, fontFamily: 'SpaceGrotesk_600SemiBold' },
  zoneType:  { fontSize: Typography.xs, fontFamily: 'Inter_400Regular', marginTop: 2 },
  zoneRight: { alignItems: 'flex-end', gap: 4 },
  zoneCountRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  zoneCount: { fontSize: Typography.xs, fontFamily: 'Inter_400Regular' },
  incidentList: { gap: Spacing.xs },
  incidentRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.md },
  incidentDot:  { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  incidentDesc: { fontSize: Typography.sm, fontFamily: 'Inter_500Medium' },
  incidentMeta: { fontSize: Typography.xs, fontFamily: 'Inter_400Regular', marginTop: 2 },
  quickActions: { flexDirection: 'row', justifyContent: 'space-between' },
  quickAction:  { alignItems: 'center', gap: Spacing.xs, flex: 1 },
  quickActionIcon: { width: 60, height: 60, borderRadius: Radius.xl, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  quickActionLabel: { fontSize: Typography.xs, fontFamily: 'Inter_500Medium' },
  noData:     { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xl },
  noDataIcon: { opacity: 0.5 },
  noDataText: { fontSize: Typography.sm, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  noDataBtn:  { backgroundColor: '#3B82F6', paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm, borderRadius: Radius.lg, marginTop: Spacing.xs },
  noDataBtnText: { color: '#fff', fontSize: Typography.sm, fontFamily: 'SpaceGrotesk_600SemiBold' },
});
