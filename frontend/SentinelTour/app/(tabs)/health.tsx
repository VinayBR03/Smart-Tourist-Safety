import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Dimensions, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import Animated, {
  FadeInDown, useSharedValue, withRepeat, withTiming,
  useAnimatedStyle, Easing,
} from 'react-native-reanimated';
import Svg, { Path, Line, Circle, Defs, LinearGradient, Stop, G, Text as SvgText } from 'react-native-svg';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icons';
import { healthApi } from '@/api/health';
import { useAuthStore } from '@/store/authStore';
import { useDeviceStore } from '@/store/deviceStore';
import { Typography, Spacing, Radius } from '@/constants/theme';
import { formatDistanceToNow } from 'date-fns';
import type { HealthTelemetry } from '@/types/api';
import { useThemedStyles } from '@/utils/themedStyles';
import { useColors } from '@/context/ThemeContext';

const { width: SCREEN_W } = Dimensions.get('window');
const CHART_W = SCREEN_W - Spacing.base * 2 - Spacing.md * 2;
const CHART_H = 140;

// ─── Sparkline chart ──────────────────────────────────────
function SparkLine({ data, color, width = CHART_W, height = CHART_H }: {
  data: number[]; color: string; width?: number; height?: number;
}) {
  const C = useColors();
  if (!data || data.length < 2) return null;
  const pad = { top: 12, right: 8, bottom: 28, left: 36 };
  const w   = width  - pad.left - pad.right;
  const h   = height - pad.top  - pad.bottom;
  const min = Math.min(...data); const max = Math.max(...data); const range = max - min || 1;
  const toX = (i: number) => pad.left + (i / (data.length - 1)) * w;
  const toY = (v: number) => pad.top + h - ((v - min) / range) * h;
  const linePath = data.map((v, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(v).toFixed(1)}`).join(' ');
  const areaPath = [
    ...data.map((v, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(v).toFixed(1)}`),
    `L ${toX(data.length - 1).toFixed(1)} ${(pad.top + h).toFixed(1)}`,
    `L ${pad.left.toFixed(1)} ${(pad.top + h).toFixed(1)}`, 'Z',
  ].join(' ');
  const yTicks = [min, (min + max) / 2, max].map((v) => Math.round(v));

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <Stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </LinearGradient>
      </Defs>
      {yTicks.map((tick, i) => (
        <G key={`ytick-${i}`}>
          <Line x1={pad.left} y1={toY(tick)} x2={pad.left + w} y2={toY(tick)}
            stroke={C.border} strokeWidth="1" strokeDasharray="3,4" />
          <SvgText x={pad.left - 6} y={toY(tick) + 4} textAnchor="end" fontSize="9"
            fill={C.textMuted} fontFamily="Inter_400Regular">{tick}</SvgText>
        </G>
      ))}
      <Path d={areaPath} fill={`url(#grad-${color.replace('#', '')})`} />
      <Path d={linePath} stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {data.map((v, i) => (
        <Circle key={`dot-${i}`} cx={toX(i)} cy={toY(v)} r="3"
          fill={color} stroke={C.surface} strokeWidth="1.5" />
      ))}
    </Svg>
  );
}

// ─── Live pulse indicator ─────────────────────────────────
function LivePulse({ color }: { color: string }) {
  const scale   = useSharedValue(1);
  const opacity = useSharedValue(0.8);
  useEffect(() => {
    scale.value   = withRepeat(withTiming(1.6, { duration: 1200, easing: Easing.out(Easing.ease) }), -1, false);
    opacity.value = withRepeat(withTiming(0,   { duration: 1200, easing: Easing.out(Easing.ease) }), -1, false);
  }, []);
  const ringStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: opacity.value, borderColor: color }));
  return (
    <View style={styles.pulseWrap}>
      <Animated.View style={[styles.pulseRing, ringStyle]} />
      <View style={[styles.pulseDot, { backgroundColor: color }]} />
    </View>
  );
}

// ─── Metric detail card ───────────────────────────────────
interface MetricCardProps {
  label: string; value: number | null; unit: string;
  icon: React.ReactNode; color: string; history: number[];
  normal: string; isAlert: boolean; index: number;
}

function MetricDetailCard({ label, value, unit, icon, color, history, normal, isAlert, index }: MetricCardProps) {
  const C = useColors();
  const [expanded, setExpanded] = useState(false);
  return (
    <Animated.View entering={FadeInDown.duration(400).delay(index * 100)}>
      <TouchableOpacity
        style={[styles.metricCard, { backgroundColor: C.surface, borderColor: isAlert ? 'rgba(239,68,68,0.4)' : C.border }]}
        onPress={() => setExpanded((p) => !p)} activeOpacity={0.85}
      >
        <View style={styles.metricCardHeader}>
          <View style={styles.metricLeft}>
            <View style={[styles.metricIconBg, { backgroundColor: `${color}18` }]}>{icon}</View>
            <View>
              <Text style={[styles.metricLabel, { color: C.textPrimary }]}>{label}</Text>
              <Text style={[styles.metricNormal, { color: C.textMuted }]}>Normal: {normal}</Text>
            </View>
          </View>
          <View style={styles.metricRight}>
            {isAlert && <LivePulse color="#EF4444" />}
            <View style={styles.metricValueRow}>
              <Text style={[styles.metricValue, { color }]}>{value !== null ? value : '—'}</Text>
              <Text style={[styles.metricUnit, { color }]}>{unit}</Text>
            </View>
            <Icon.ChevronDown size={16} color={C.textMuted} />
          </View>
        </View>
        {isAlert && (
          <View style={styles.alertRow}>
            <Icon.AlertTriangle size={14} color="#EF4444" />
            <Text style={styles.alertMsg}>Value outside normal range</Text>
          </View>
        )}
        {expanded && history.length > 1 && (
          <Animated.View entering={FadeInDown.duration(300)} style={styles.chartWrap}>
            <View style={styles.chartHeader}>
              <Text style={[styles.chartTitle, { color: C.textSecondary }]}>Last {history.length} readings</Text>
              <Badge label="Live" variant="success" size="sm" dot />
            </View>
            <SparkLine data={history} color={color} />
          </Animated.View>
        )}
        {expanded && history.length <= 1 && (
          <View style={styles.chartEmpty}>
            <Text style={[styles.chartEmptyText, { color: C.textMuted }]}>Not enough data to show chart</Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Stat box ─────────────────────────────────────────────
function StatBox({ label, value, color, unit }: { label: string; value: string; color: string; unit?: string }) {
  const C = useColors();
  return (
    <View style={[styles.statBox, { backgroundColor: C.surface, borderColor: C.border, borderTopColor: color, borderTopWidth: 2 }]}>
      <View style={styles.statValueRow}>
        <Text style={[styles.statValue, { color }]}>{value}</Text>
        {unit && <Text style={[styles.statUnit, { color }]}>{unit}</Text>}
      </View>
      <Text style={[styles.statLabel, { color: C.textMuted }]}>{label}</Text>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────
export default function HealthScreen() {
  const t = useThemedStyles();
  const { user }   = useAuthStore();
  const { device } = useDeviceStore();

  const { data: latest, isLoading, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['health', 'latest'], queryFn: healthApi.getLatest,
    refetchInterval: 10_000, retry: false,
  });

  const { data: history = [] } = useQuery({
    queryKey: ['health', 'history', user?.id],
    queryFn: () => healthApi.getHistory(user!.id, 50),
    enabled: !!user?.id, staleTime: 30_000,
  });

  const hrHistory   = history.map((h) => h.heart_rate).filter((v): v is number => v !== null).reverse();
  const spo2History = history.map((h) => h.spo2).filter((v): v is number => v !== null).reverse();
  const tempHistory = history.map((h) => h.body_temperature).filter((v): v is number => v !== null).reverse();

  const hasAlerts  = latest?.is_alert;
  const lastUpdated = dataUpdatedAt ? formatDistanceToNow(new Date(dataUpdatedAt), { addSuffix: true }) : null;

  return (
    <View style={[styles.root, t.bg]}>
      <Header title="Health" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Device banner */}
        <Animated.View entering={FadeInDown.duration(400)} style={[styles.deviceBanner, t.surface, t.border]}>
          {device?.isConnected ? (
            <>
              <View style={styles.deviceBannerLeft}>
                <LivePulse color="#10B981" />
                <View>
                  <Text style={[styles.deviceBannerTitle, t.textPrimary]}>Wristband Connected</Text>
                  <Text style={[styles.deviceBannerSub, t.textMuted]}>{device.name}</Text>
                </View>
              </View>
              <View style={styles.batteryWrap}>
                <Icon.Battery size={18} color={(device.batteryPercentage ?? 100) < 20 ? '#EF4444' : '#10B981'} />
                <Text style={[styles.batteryText, { color: (device.batteryPercentage ?? 100) < 20 ? '#EF4444' : t.C.textSecondary }]}>
                  {device.batteryPercentage ?? '—'}%
                </Text>
              </View>
            </>
          ) : (
            <>
              <View style={styles.deviceBannerLeft}>
                <View style={[styles.pulseDot, { backgroundColor: t.C.textMuted }]} />
                <View>
                  <Text style={[styles.deviceBannerTitle, t.textPrimary]}>No Device Connected</Text>
                  <Text style={[styles.deviceBannerSub, t.textMuted]}>Data from last backend sync</Text>
                </View>
              </View>
              <Icon.WifiOff size={18} color={t.C.textMuted} />
            </>
          )}
        </Animated.View>

        {/* Alert banner */}
        {hasAlerts && (
          <Animated.View entering={FadeInDown.duration(400).delay(60)} style={styles.alertBanner}>
            <Icon.ShieldAlert size={20} color="#EF4444" />
            <View style={{ flex: 1 }}>
              <Text style={styles.alertBannerTitle}>Health Alert Active</Text>
              <Text style={[styles.alertBannerSub, t.textSecondary]}>
                {latest?.alert_type?.replace('_', ' ')} — please rest and stay hydrated
              </Text>
            </View>
            <Badge label="ALERT" variant="error" size="sm" />
          </Animated.View>
        )}

        {/* Last sync */}
        {lastUpdated && (
          <Animated.View entering={FadeInDown.duration(300).delay(80)} style={styles.syncRow}>
            <Icon.RefreshCw size={12} color={t.C.textMuted} />
            <Text style={[styles.syncText, t.textMuted]}>Updated {lastUpdated}</Text>
            <TouchableOpacity onPress={() => refetch()} style={[styles.syncBtn, t.surface, t.border]}>
              <Text style={[styles.syncBtnText, { color: t.C.primary }]}>Refresh</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Loading */}
        {isLoading && (
          <View style={styles.loadingBox}>
            <ActivityIndicator color="#3B82F6" size="large" />
            <Text style={[styles.loadingText, t.textMuted]}>Loading health data...</Text>
          </View>
        )}

        {/* Metric cards */}
        {!isLoading && latest && (
          <View style={styles.metricsSection}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, t.textPrimary]}>Live Vitals</Text>
              <Badge label="LIVE" variant="success" size="sm" dot />
            </View>
            <MetricDetailCard label="Heart Rate" value={latest.heart_rate} unit="bpm"
              icon={<Icon.HeartPulse size={20} color="#EF4444" />} color="#EF4444"
              history={hrHistory} normal="60 – 100 bpm"
              isAlert={!!latest.is_alert && latest.alert_type === 'HEART_RATE'} index={0} />
            <MetricDetailCard label="Blood Oxygen (SpO₂)" value={latest.spo2} unit="%"
              icon={<Icon.Droplet size={20} color="#3B82F6" />} color="#3B82F6"
              history={spo2History} normal="95 – 100 %"
              isAlert={!!latest.is_alert && latest.alert_type === 'SPO2'} index={1} />
            <MetricDetailCard label="Body Temperature" value={latest.body_temperature} unit="°C"
              icon={<Icon.Thermometer size={20} color="#F59E0B" />} color="#F59E0B"
              history={tempHistory} normal="36.1 – 37.2 °C"
              isAlert={!!latest.is_alert && latest.alert_type === 'TEMPERATURE'} index={2} />
            <MetricDetailCard label="Ambient Temperature" value={latest.ambient_temperature} unit="°C"
              icon={<Icon.Wind size={20} color="#06B6D4" />} color="#06B6D4"
              history={[]} normal="Environment reading" isAlert={false} index={3} />
          </View>
        )}

        {/* No data */}
        {!isLoading && !latest && (
          <Animated.View entering={FadeInDown.duration(400)} style={styles.noDataBox}>
            <View style={[styles.noDataIconWrap, t.surface, t.border]}>
              <Icon.Activity size={36} color={t.C.textMuted} />
            </View>
            <Text style={[styles.noDataTitle, t.textPrimary]}>No Health Data Yet</Text>
            <Text style={[styles.noDataSub, t.textMuted]}>
              Connect your wristband via Bluetooth to start receiving live health metrics.
            </Text>
          </Animated.View>
        )}

        {/* Stats */}
        {history.length > 0 && (
          <Animated.View entering={FadeInDown.duration(400).delay(400)} style={styles.statsSection}>
            <Text style={[styles.sectionTitle, t.textPrimary]}>Session Stats</Text>
            <View style={styles.statsGrid}>
              <StatBox label="Readings" value={String(history.length)} color="#3B82F6" />
              <StatBox label="Avg HR" value={hrHistory.length > 0 ? `${Math.round(hrHistory.reduce((a, b) => a + b, 0) / hrHistory.length)}` : '—'} color="#EF4444" unit="bpm" />
              <StatBox label="Min SpO₂" value={spo2History.length > 0 ? `${Math.min(...spo2History)}` : '—'} color="#3B82F6" unit="%" />
              <StatBox label="Alerts" value={String(history.filter((h) => h.is_alert).length)} color="#EF4444" />
            </View>
          </Animated.View>
        )}

        <View style={{ height: Spacing['2xl'] }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:          { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.base, paddingBottom: Spacing['4xl'] },
  deviceBanner:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: Radius.xl, borderWidth: 1, padding: Spacing.md, marginTop: Spacing.base },
  deviceBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  deviceBannerTitle:{ fontSize: Typography.sm, fontFamily: 'SpaceGrotesk_600SemiBold' },
  deviceBannerSub:  { fontSize: Typography.xs, fontFamily: 'Inter_400Regular', marginTop: 1 },
  batteryWrap:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  batteryText:   { fontSize: Typography.sm, fontFamily: 'Inter_500Medium' },
  alertBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: Radius.lg,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)',
    padding: Spacing.md, marginTop: Spacing.sm,
  },
  alertBannerTitle: { fontSize: Typography.sm, fontFamily: 'SpaceGrotesk_600SemiBold', color: '#EF4444' },
  alertBannerSub:   { fontSize: Typography.xs, fontFamily: 'Inter_400Regular', marginTop: 2 },
  syncRow:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.sm },
  syncText:  { fontSize: Typography.xs, fontFamily: 'Inter_400Regular', flex: 1 },
  syncBtn:   { paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.sm, borderWidth: 1 },
  syncBtnText: { fontSize: Typography.xs, fontFamily: 'Inter_500Medium' },
  loadingBox:  { paddingVertical: Spacing['3xl'], alignItems: 'center', gap: Spacing.md },
  loadingText: { fontSize: Typography.sm, fontFamily: 'Inter_400Regular' },
  metricsSection: { marginTop: Spacing.xl, gap: Spacing.sm },
  sectionHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.xs },
  sectionTitle:   { fontSize: Typography.md, fontFamily: 'SpaceGrotesk_700Bold' },
  metricCard:     { borderRadius: Radius.xl, borderWidth: 1, padding: Spacing.md, gap: Spacing.sm },
  metricCardHeader:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metricLeft:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  metricRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  metricIconBg:{ width: 40, height: 40, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  metricLabel: { fontSize: Typography.sm, fontFamily: 'SpaceGrotesk_600SemiBold' },
  metricNormal:{ fontSize: Typography.xs, fontFamily: 'Inter_400Regular', marginTop: 1 },
  metricValueRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  metricValue: { fontSize: Typography['2xl'], fontFamily: 'SpaceGrotesk_700Bold' },
  metricUnit:  { fontSize: Typography.sm, fontFamily: 'Inter_500Medium', marginBottom: 3 },
  alertRow:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  alertMsg:    { fontSize: Typography.xs, fontFamily: 'Inter_400Regular', color: '#EF4444' },
  chartWrap:   { gap: Spacing.sm },
  chartHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chartTitle:  { fontSize: Typography.xs, fontFamily: 'Inter_500Medium' },
  chartEmpty:  { paddingVertical: Spacing.md, alignItems: 'center' },
  chartEmptyText: { fontSize: Typography.xs, fontFamily: 'Inter_400Regular' },
  pulseWrap: { width: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  pulseRing: { position: 'absolute', width: 16, height: 16, borderRadius: 8, borderWidth: 1.5 },
  pulseDot:  { width: 8, height: 8, borderRadius: 4 },
  noDataBox: { paddingVertical: Spacing['4xl'], alignItems: 'center', gap: Spacing.md },
  noDataIconWrap: { width: 72, height: 72, borderRadius: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  noDataTitle: { fontSize: Typography.lg, fontFamily: 'SpaceGrotesk_700Bold' },
  noDataSub:   { fontSize: Typography.sm, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 22, paddingHorizontal: Spacing.xl },
  statsSection: { marginTop: Spacing.xl, gap: Spacing.sm },
  statsGrid:    { flexDirection: 'row', gap: Spacing.sm },
  statBox:      { flex: 1, borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.md, gap: 4 },
  statValueRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  statValue:    { fontSize: Typography.xl, fontFamily: 'SpaceGrotesk_700Bold' },
  statUnit:     { fontSize: Typography.xs, fontFamily: 'Inter_500Medium', marginBottom: 2 },
  statLabel:    { fontSize: Typography.xs, fontFamily: 'Inter_400Regular' },
});
