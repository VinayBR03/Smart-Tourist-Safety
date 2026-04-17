import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Typography, Spacing, Radius } from '@/constants/theme';
import { Icon } from '@/components/ui/Icons';
import { useColors } from '@/context/ThemeContext';

interface HealthMetricCardProps {
  label:    string;
  value:    string | number | null;
  unit:     string;
  icon:     React.ReactNode;
  color:    string;
  isAlert?: boolean;
  subtitle?: string;
  index?:   number;
}

export function HealthMetricCard({
  label, value, unit, icon, color, isAlert = false, subtitle, index = 0,
}: HealthMetricCardProps) {
  const C = useColors();  // ← reactive, not hardcoded Colors.*

  return (
    <Animated.View
      entering={FadeInDown.duration(400).delay(index * 80)}
      style={[
        styles.card,
        {
          backgroundColor: C.surface,
          borderColor:     isAlert ? C.error : C.border,
          borderWidth:     isAlert ? 1.5 : 1,
        },
      ]}
    >
      <View style={styles.topRow}>
        <View style={[styles.iconBg, { backgroundColor: `${color}18` }]}>
          {icon}
        </View>
        {isAlert && (
          <View style={styles.alertDot}>
            <Icon.AlertTriangle size={10} color="#fff" strokeWidth={2.5} />
          </View>
        )}
      </View>

      <View style={styles.valueRow}>
        <Text style={[styles.value, { color }, value === null && { color: C.textMuted }]}>
          {value !== null ? String(value) : '—'}
        </Text>
        <Text style={[styles.unit, { color }]}>{unit}</Text>
      </View>

      <Text style={[styles.label, { color: C.textSecondary }]}>{label}</Text>
      {subtitle && <Text style={[styles.subtitle, { color: C.textMuted }]}>{subtitle}</Text>}

      <View style={[styles.accent, { backgroundColor: color }]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    minWidth: 140,
    position: 'relative',
    overflow: 'hidden',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  iconBg: {
    width: 36, height: 36, borderRadius: Radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  alertDot: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#EF4444',
    alignItems: 'center', justifyContent: 'center',
  },
  valueRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, marginBottom: 2 },
  value:    { fontSize: Typography['2xl'], fontFamily: 'SpaceGrotesk_700Bold' },
  unit:     { fontSize: Typography.sm, fontFamily: 'Inter_500Medium', marginBottom: 3 },
  label: {
    fontSize: Typography.xs, fontFamily: 'Inter_500Medium',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: Typography.xs, fontFamily: 'Inter_400Regular', marginTop: 2,
  },
  accent: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, opacity: 0.6,
  },
});