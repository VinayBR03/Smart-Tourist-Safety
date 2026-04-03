import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, Spacing, Radius } from '@/constants/theme';
import type { RiskLevel, IncidentStatus, NotificationSeverity } from '@/types/api';

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'muted' | 'primary';

const VARIANT_STYLES: Record<BadgeVariant, { bg: string; text: string; border: string }> = {
  success: { bg: 'rgba(16,185,129,0.12)', text: Colors.success,  border: 'rgba(16,185,129,0.25)' },
  warning: { bg: 'rgba(245,158,11,0.12)', text: Colors.warning,  border: 'rgba(245,158,11,0.25)' },
  error:   { bg: 'rgba(239,68,68,0.12)',  text: Colors.error,    border: 'rgba(239,68,68,0.25)'  },
  info:    { bg: 'rgba(59,130,246,0.12)', text: Colors.primary,  border: 'rgba(59,130,246,0.25)' },
  muted:   { bg: Colors.surface,          text: Colors.textMuted, border: Colors.border           },
  primary: { bg: Colors.primary,          text: '#fff',           border: Colors.primary          },
};

export function riskVariant(level: RiskLevel): BadgeVariant {
  return level === 'LOW' ? 'success' : level === 'MEDIUM' ? 'warning' : 'error';
}

export function incidentVariant(status: IncidentStatus): BadgeVariant {
  const map: Record<IncidentStatus, BadgeVariant> = {
    OPEN: 'error', IN_PROGRESS: 'warning', ESCALATED: 'error',
    RESOLVED: 'success', CLOSED: 'muted', CANCELLED: 'muted', REJECTED: 'muted',
  };
  return map[status] ?? 'muted';
}

export function severityVariant(sev: NotificationSeverity): BadgeVariant {
  const map: Record<NotificationSeverity, BadgeVariant> = {
    INFO: 'info', WARNING: 'warning', HIGH: 'error', CRITICAL: 'error',
  };
  return map[sev] ?? 'info';
}

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  dot?: boolean;
}

export function Badge({ label, variant = 'info', size = 'md', dot = false }: BadgeProps) {
  const v = VARIANT_STYLES[variant];
  return (
    <View style={[
      styles.badge,
      { backgroundColor: v.bg, borderColor: v.border },
      size === 'sm' && styles.sm,
    ]}>
      {dot && <View style={[styles.dot, { backgroundColor: v.text }]} />}
      <Text style={[styles.text, { color: v.text }, size === 'sm' && styles.textSm]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
    gap: 5,
  },
  sm: { paddingHorizontal: 6, paddingVertical: 2 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontSize: Typography.sm, fontFamily: 'Inter_500Medium', letterSpacing: 0.3 },
  textSm: { fontSize: Typography.xs },
});