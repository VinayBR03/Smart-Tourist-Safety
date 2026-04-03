import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Colors, Typography, Spacing, Radius } from '@/constants/theme';
import { Icon } from '@/components/ui/Icons';

interface HealthMetricCardProps {
  label:    string;
  value:    string | number | null;
  unit:     string;
  icon:     React.ReactNode;   // ← ReactNode, not emoji string
  color:    string;
  isAlert?: boolean;
  subtitle?: string;
  index?:   number;
}

export function HealthMetricCard({
  label, value, unit, icon, color, isAlert = false, subtitle, index = 0,
}: HealthMetricCardProps) {
  return (
    <Animated.View
      entering={FadeInDown.duration(400).delay(index * 80)}
      style={[styles.card, isAlert && styles.alertCard]}
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
        <Text style={[styles.value, { color }, value === null && styles.noValue]}>
          {value !== null ? String(value) : '—'}
        </Text>
        <Text style={[styles.unit, { color }]}>{unit}</Text>
      </View>

      <Text style={styles.label}>{label}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}

      <View style={[styles.accent, { backgroundColor: color }]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    minWidth: 140,
    position: 'relative',
    overflow: 'hidden',
  },
  alertCard: { borderColor: Colors.error, borderWidth: 1.5 },
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
    backgroundColor: Colors.error,
    alignItems: 'center', justifyContent: 'center',
  },
  valueRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, marginBottom: 2 },
  value:    { fontSize: Typography['2xl'], fontFamily: 'SpaceGrotesk_700Bold' },
  noValue:  { color: Colors.textMuted },
  unit:     { fontSize: Typography.sm, fontFamily: 'Inter_500Medium', marginBottom: 3 },
  label: {
    fontSize: Typography.xs, fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: Typography.xs, fontFamily: 'Inter_400Regular',
    color: Colors.textMuted, marginTop: 2,
  },
  accent: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, opacity: 0.6,
  },
});