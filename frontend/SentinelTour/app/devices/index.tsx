// app/devices/index.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { Device } from 'react-native-ble-plx';
import Animated, {
  FadeInDown, useSharedValue, useAnimatedStyle,
  withRepeat, withTiming, Easing,
} from 'react-native-reanimated';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icons';
import { bluetoothService } from '@/services/bluetoothService';
import { useDeviceStore } from '@/store/deviceStore';
import { Typography, Spacing, Radius } from '@/constants/theme';
import { formatDistanceToNow } from 'date-fns';
import Svg, { Circle } from 'react-native-svg';
import { useThemedStyles } from '@/utils/themedStyles';
import { useColors } from '@/context/ThemeContext';

// ─── Battery ring ─────────────────────────────────────────
function BatteryRing({ percentage }: { percentage: number }) {
  const SIZE = 100; const RADIUS = 40; const CIRC = 2 * Math.PI * RADIUS;
  const offset = CIRC - (percentage / 100) * CIRC;
  const color  = percentage > 50 ? '#10B981' : percentage > 20 ? '#F59E0B' : '#EF4444';
  return (
    <View style={styles.batteryRingWrap}>
      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <Circle cx={SIZE/2} cy={SIZE/2} r={RADIUS} fill="none" stroke="#374151" strokeWidth={6} />
        <Circle cx={SIZE/2} cy={SIZE/2} r={RADIUS} fill="none" stroke={color} strokeWidth={6}
          strokeLinecap="round" strokeDasharray={CIRC} strokeDashoffset={offset}
          transform={`rotate(-90 ${SIZE/2} ${SIZE/2})`} />
      </Svg>
      <View style={styles.batteryRingCenter}>
        <Text style={[styles.batteryPercent, { color }]}>{percentage}</Text>
        <Text style={styles.batteryPercentUnit}>%</Text>
      </View>
    </View>
  );
}

// ─── Scanning animation ───────────────────────────────────
function ScanningAnimation() {
  const scale1 = useSharedValue(1); const op1 = useSharedValue(0.6);
  const scale2 = useSharedValue(1); const op2 = useSharedValue(0.3);
  useEffect(() => {
    scale1.value = withRepeat(withTiming(2.2, { duration: 1800, easing: Easing.out(Easing.ease) }), -1, false);
    op1.value    = withRepeat(withTiming(0,   { duration: 1800, easing: Easing.out(Easing.ease) }), -1, false);
    setTimeout(() => {
      scale2.value = withRepeat(withTiming(2.2, { duration: 1800, easing: Easing.out(Easing.ease) }), -1, false);
      op2.value    = withRepeat(withTiming(0,   { duration: 1800, easing: Easing.out(Easing.ease) }), -1, false);
    }, 600);
  }, [scale1, op1, scale2, op2]);
  const ring1Style = useAnimatedStyle(() => ({ transform: [{ scale: scale1.value }], opacity: op1.value }));
  const ring2Style = useAnimatedStyle(() => ({ transform: [{ scale: scale2.value }], opacity: op2.value }));
  return (
    <View style={styles.scanAnim}>
      <Animated.View style={[styles.scanRing, ring1Style]} />
      <Animated.View style={[styles.scanRing, ring2Style]} />
      <View style={styles.scanCenter}><Icon.Bluetooth size={28} color="#3B82F6" /></View>
    </View>
  );
}

// ─── Discovered device row ────────────────────────────────
function DeviceRow({ device, onConnect, connecting }: { device: Device; onConnect: () => void; connecting: boolean }) {
  const C = useColors();
  return (
    <Animated.View entering={FadeInDown.duration(350)}>
      <TouchableOpacity
        style={[styles.deviceRow, { backgroundColor: C.surface, borderColor: C.border }]}
        onPress={onConnect} activeOpacity={0.82}
      >
        <View style={styles.deviceRowLeft}>
          <View style={styles.deviceRowIcon}><Icon.Bluetooth size={20} color={C.primary} /></View>
          <View>
            <Text style={[styles.deviceRowName, { color: C.textPrimary }]}>{device.name ?? 'Sentinel Wristband'}</Text>
            <Text style={[styles.deviceRowId, { color: C.textMuted }]} numberOfLines={1}>{device.id}</Text>
            {device.rssi != null && <Text style={[styles.deviceRowRssi, { color: C.textMuted }]}>Signal: {device.rssi} dBm</Text>}
          </View>
        </View>
        {connecting
          ? <ActivityIndicator size="small" color={C.primary} />
          : <View style={styles.connectChip}><Text style={styles.connectChipText}>Connect</Text></View>
        }
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Connected device card ────────────────────────────────
function ConnectedDeviceCard({ onDisconnect }: { onDisconnect: () => void }) {
  const C = useColors();
  const { device } = useDeviceStore();
  if (!device) return null;
  const bat      = device.batteryPercentage;
  const batColor = bat == null ? C.textMuted : bat > 50 ? '#10B981' : bat > 20 ? '#F59E0B' : '#EF4444';
  return (
    <Animated.View entering={FadeInDown.duration(500)}>
      <Card style={styles.connectedCard} elevated>
        <View style={styles.connectedHeader}>
          <View style={styles.connectedHeaderLeft}>
            <View style={styles.connectedIconWrap}><Icon.Bluetooth size={24} color="#3B82F6" /></View>
            <View>
              <Text style={[styles.connectedName, { color: C.textPrimary }]}>{device.name}</Text>
              <Badge label="Connected" variant="success" size="sm" dot />
            </View>
          </View>
          <TouchableOpacity style={styles.disconnectBtn} onPress={onDisconnect} activeOpacity={0.8}>
            <Icon.WifiOff size={14} color="#EF4444" />
            <Text style={styles.disconnectBtnText}>Remove</Text>
          </TouchableOpacity>
        </View>
        {bat != null && (
          <View style={styles.batterySection}>
            <BatteryRing percentage={bat} />
            <View style={styles.batterySectionRight}>
              <Text style={[styles.batterySectionTitle, { color: C.textSecondary }]}>Battery Status</Text>
              <Text style={[styles.batterySectionValue, { color: batColor }]}>
                {bat > 80 ? 'Excellent' : bat > 50 ? 'Good' : bat > 20 ? 'Low' : 'Critical'}
              </Text>
              {bat < 20 && (
                <View style={styles.batteryAlert}>
                  <Icon.AlertTriangle size={12} color="#EF4444" />
                  <Text style={[styles.batteryAlertText, { color: '#EF4444' }]}>Please charge soon</Text>
                </View>
              )}
            </View>
          </View>
        )}
        <View style={[styles.metricsRow, { backgroundColor: C.surfaceAlt }]}>
          <MetricMini label="Heart Rate" value={device.lastHeartRate != null ? `${device.lastHeartRate} bpm` : '—'} icon={<Icon.HeartPulse size={14} color="#EF4444" />} color="#EF4444" />
          <MetricMini label="SpO₂"       value={device.lastSpO2 != null ? `${device.lastSpO2}%` : '—'} icon={<Icon.Droplet size={14} color="#3B82F6" />} color="#3B82F6" />
          <MetricMini label="Temp"        value={device.lastTemperature != null ? `${device.lastTemperature}°C` : '—'} icon={<Icon.Thermometer size={14} color="#F59E0B" />} color="#F59E0B" />
        </View>
        {device.lastSeen && (
          <View style={styles.lastSeen}>
            <Icon.Clock size={12} color={C.textMuted} />
            <Text style={[styles.lastSeenText, { color: C.textMuted }]}>
              Last reading: {formatDistanceToNow(device.lastSeen, { addSuffix: true })}
            </Text>
          </View>
        )}
      </Card>
    </Animated.View>
  );
}

function MetricMini({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) {
  const C = useColors();
  return (
    <View style={styles.metricMini}>
      {icon}
      <Text style={[styles.metricMiniValue, { color }]}>{value}</Text>
      <Text style={[styles.metricMiniLabel, { color: C.textMuted }]}>{label}</Text>
    </View>
  );
}

function SectionTitle({ label }: { label: string }) {
  const C = useColors();
  return <Text style={[styles.sectionTitle, { color: C.textMuted }]}>{label}</Text>;
}

// ─── Main screen ──────────────────────────────────────────
export default function DevicesScreen() {
  const t = useThemedStyles();
  const { device: connectedDevice, isScanning } = useDeviceStore();
  const [discovered, setDiscovered] = useState<Device[]>([]);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [bleError,   setBleError]   = useState<string | null>(null);

  // Keep a ref to the current stop function so the cleanup effect always
  // cancels the LATEST scan, not the one captured at mount time.
  const stopScanRef = useRef<(() => void) | null>(null);

  // ── Start scanning ──────────────────────────────────
  // The BluetoothService now calls stopDeviceScan() internally before starting,
  // so calling startScan() multiple times is safe and always works.
  const startScan = useCallback(async () => {
    setBleError(null);
    setDiscovered([]);

    const granted = await bluetoothService.requestPermissions();
    if (!granted) {
      setBleError('Bluetooth permission denied. Enable it in system settings.');
      return;
    }
    const state = await bluetoothService.checkState();
    if (state !== 'PoweredOn') {
      setBleError('Bluetooth is off. Please enable it and try again.');
      return;
    }

    const stop = bluetoothService.scanForWristband(
      (dev) => setDiscovered((prev) =>
        prev.find((d) => d.id === dev.id) ? prev : [...prev, dev]
      ),
      (err) => setBleError(err.message)
    );

    // Store in ref so the cleanup/stop-scan button always references this scan
    stopScanRef.current = stop;
  }, []);

  const handleStopScan = useCallback(() => {
    stopScanRef.current?.();
    stopScanRef.current = null;
  }, []);

  const handleConnect = async (deviceId: string) => {
    setConnecting(deviceId);
    handleStopScan(); // stop scan before connecting
    try {
      await bluetoothService.connect(deviceId);
      setDiscovered([]);
    } catch (err: any) {
      Alert.alert('Connection Failed', err.message ?? 'Could not connect to the wristband.');
    } finally {
      setConnecting(null);
    }
  };

  const handleDisconnect = () => {
    Alert.alert('Disconnect Wristband', 'Are you sure you want to disconnect your wristband?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Disconnect', style: 'destructive', onPress: () => bluetoothService.disconnect() },
    ]);
  };

  // Stop scan when leaving screen
  useEffect(() => () => { stopScanRef.current?.(); }, []);

  return (
    <View style={[styles.root, t.bg]}>
      <Header title="Devices" showBack />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {connectedDevice ? (
          <View style={styles.section}>
            <SectionTitle label="Connected Wristband" />
            <ConnectedDeviceCard onDisconnect={handleDisconnect} />
          </View>
        ) : (
          <View style={styles.section}>
            <SectionTitle label="Connect Wristband" />
            <Card style={styles.scanCard}>
              {isScanning ? (
                <>
                  <ScanningAnimation />
                  <Text style={[styles.scanTitle, t.textPrimary]}>Searching for wristbands...</Text>
                  <Text style={[styles.scanSub, t.textMuted]}>
                    Make sure your wristband is powered on and nearby.
                  </Text>
                  <TouchableOpacity
                    style={[styles.stopScanBtn, t.surface, t.border]}
                    onPress={handleStopScan}
                  >
                    <Text style={[styles.stopScanText, t.textSecondary]}>Stop Scanning</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <View style={[styles.notConnectedIcon, t.surfaceAlt, t.border]}>
                    <Icon.Bluetooth size={36} color={t.C.textMuted} />
                  </View>
                  <Text style={[styles.scanTitle, t.textPrimary]}>No wristband connected</Text>
                  <Text style={[styles.scanSub, t.textMuted]}>
                    Tap the button below to scan for your Sentinel wristband via Bluetooth.
                  </Text>
                  {/* Start Scanning — works unlimited times; BluetoothService resets scan state internally */}
                  <TouchableOpacity style={styles.scanBtn} onPress={startScan} activeOpacity={0.85}>
                    <Icon.RefreshCw size={18} color="#fff" />
                    <Text style={styles.scanBtnText}>Start Scanning</Text>
                  </TouchableOpacity>
                </>
              )}
              {bleError && (
                <View style={styles.bleError}>
                  <Icon.AlertTriangle size={14} color="#EF4444" />
                  <Text style={styles.bleErrorText}>{bleError}</Text>
                </View>
              )}
            </Card>

            {discovered.length > 0 && (
              <View style={styles.section}>
                <SectionTitle label={`Found ${discovered.length} device${discovered.length > 1 ? 's' : ''}`} />
                {discovered.map((dev) => (
                  <DeviceRow
                    key={dev.id}
                    device={dev}
                    onConnect={() => handleConnect(dev.id)}
                    connecting={connecting === dev.id}
                  />
                ))}
              </View>
            )}
          </View>
        )}

        {/* Setup guide */}
        <Animated.View entering={FadeInDown.duration(400).delay(200)} style={styles.section}>
          <SectionTitle label="Setup Guide" />
          <Card>
            {[
              { icon: <Icon.Zap size={18} color="#F59E0B" />, title: 'Power on your wristband', desc: 'Hold the side button for 3 seconds until the LED blinks blue.' },
              { icon: <Icon.Bluetooth size={18} color="#3B82F6" />, title: 'Enable Bluetooth', desc: 'Make sure Bluetooth is enabled on your phone.' },
              { icon: <Icon.Search size={18} color="#06B6D4" />, title: 'Scan and connect', desc: 'Tap "Start Scanning" and select your wristband from the list.' },
              { icon: <Icon.Shield size={18} color="#10B981" />, title: 'Stay protected', desc: 'Your health metrics and SOS will now sync in real time.' },
            ].map((step, i) => (
              <View key={i}>
                {i > 0 && <View style={[styles.rowDivider, t.border]} />}
                <View style={styles.guideStep}>
                  <View style={styles.guideStepNum}>
                    <Text style={styles.guideStepNumText}>{i + 1}</Text>
                  </View>
                  <View style={styles.guideStepIcon}>{step.icon}</View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.guideStepTitle, t.textPrimary]}>{step.title}</Text>
                    <Text style={[styles.guideStepDesc, t.textMuted]}>{step.desc}</Text>
                  </View>
                </View>
              </View>
            ))}
          </Card>
        </Animated.View>

        <View style={{ height: Spacing['2xl'] }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:          { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.base, paddingBottom: Spacing['4xl'] },
  section:       { marginTop: Spacing.base, gap: Spacing.sm },
  sectionTitle:  { fontSize: Typography.xs, fontFamily: 'SpaceGrotesk_700Bold', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 2 },
  scanCard:      { alignItems: 'center', paddingVertical: Spacing['2xl'], gap: Spacing.md },
  scanTitle:     { fontSize: Typography.lg, fontFamily: 'SpaceGrotesk_700Bold' },
  scanSub:       { fontSize: Typography.sm, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 22, paddingHorizontal: Spacing.lg },
  scanBtn:       { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: '#3B82F6', borderRadius: Radius.lg, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.sm, marginTop: Spacing.sm },
  scanBtnText:   { color: '#fff', fontSize: Typography.base, fontFamily: 'SpaceGrotesk_600SemiBold' },
  stopScanBtn:   { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.sm, borderRadius: Radius.lg, borderWidth: 1 },
  stopScanText:  { fontSize: Typography.sm, fontFamily: 'Inter_500Medium' },
  notConnectedIcon: { width: 80, height: 80, borderRadius: 28, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  bleError:      { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: Radius.md, padding: Spacing.sm, borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)', width: '100%' },
  bleErrorText:  { fontSize: Typography.xs, fontFamily: 'Inter_400Regular', color: '#EF4444', flex: 1 },
  scanAnim:      { width: 80, height: 80, alignItems: 'center', justifyContent: 'center' },
  scanRing:      { position: 'absolute', width: 80, height: 80, borderRadius: 40, borderWidth: 1.5, borderColor: '#3B82F6', opacity: 0.5 },
  scanCenter:    { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(59,130,246,0.12)', alignItems: 'center', justifyContent: 'center' },
  connectedCard: { gap: Spacing.md },
  connectedHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  connectedHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  connectedIconWrap: { width: 48, height: 48, borderRadius: Radius.lg, backgroundColor: 'rgba(59,130,246,0.12)', alignItems: 'center', justifyContent: 'center' },
  connectedName: { fontSize: Typography.base, fontFamily: 'SpaceGrotesk_700Bold', marginBottom: 4 },
  disconnectBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: Radius.md, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', backgroundColor: 'rgba(239,68,68,0.08)' },
  disconnectBtnText: { fontSize: Typography.xs, fontFamily: 'Inter_500Medium', color: '#EF4444' },
  batteryRingWrap:   { width: 100, height: 100, alignItems: 'center', justifyContent: 'center' },
  batteryRingCenter: { position: 'absolute', alignItems: 'center' },
  batteryPercent:    { fontSize: Typography['2xl'], fontFamily: 'SpaceGrotesk_700Bold' },
  batteryPercentUnit:{ fontSize: Typography.xs, fontFamily: 'Inter_400Regular' },
  batterySection:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.xl, paddingHorizontal: Spacing.sm },
  batterySectionRight: { flex: 1, gap: Spacing.xs },
  batterySectionTitle: { fontSize: Typography.sm, fontFamily: 'Inter_500Medium' },
  batterySectionValue: { fontSize: Typography.xl, fontFamily: 'SpaceGrotesk_700Bold' },
  batteryAlert:        { flexDirection: 'row', alignItems: 'center', gap: 4 },
  batteryAlertText:    { fontSize: Typography.xs, fontFamily: 'Inter_400Regular' },
  metricsRow:  { flexDirection: 'row', gap: Spacing.sm, borderRadius: Radius.lg, padding: Spacing.md },
  metricMini:  { flex: 1, alignItems: 'center', gap: 3 },
  metricMiniValue: { fontSize: Typography.sm, fontFamily: 'SpaceGrotesk_700Bold' },
  metricMiniLabel: { fontSize: 10, fontFamily: 'Inter_400Regular' },
  lastSeen:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  lastSeenText:{ fontSize: Typography.xs, fontFamily: 'Inter_400Regular' },
  deviceRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: Radius.xl, borderWidth: 1, padding: Spacing.md },
  deviceRowLeft:{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  deviceRowIcon:{ width: 44, height: 44, borderRadius: Radius.lg, backgroundColor: 'rgba(59,130,246,0.1)', alignItems: 'center', justifyContent: 'center' },
  deviceRowName:{ fontSize: Typography.sm, fontFamily: 'SpaceGrotesk_600SemiBold' },
  deviceRowId:  { fontSize: 10, fontFamily: 'Inter_400Regular', maxWidth: 180 },
  deviceRowRssi:{ fontSize: 10, fontFamily: 'Inter_400Regular' },
  connectChip:  { backgroundColor: '#3B82F6', borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: 6 },
  connectChipText: { color: '#fff', fontSize: Typography.xs, fontFamily: 'SpaceGrotesk_600SemiBold' },
  guideStep:    { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, paddingVertical: Spacing.sm },
  guideStepNum: { width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(59,130,246,0.12)', borderWidth: 1, borderColor: 'rgba(59,130,246,0.25)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  guideStepNumText: { fontSize: 11, fontFamily: 'SpaceGrotesk_700Bold', color: '#3B82F6' },
  guideStepIcon:{ width: 28, alignItems: 'center', paddingTop: 2 },
  guideStepTitle:{ fontSize: Typography.sm, fontFamily: 'SpaceGrotesk_600SemiBold', marginBottom: 2 },
  guideStepDesc: { fontSize: Typography.xs, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  rowDivider:   { height: 1, borderBottomWidth: 1 },
});