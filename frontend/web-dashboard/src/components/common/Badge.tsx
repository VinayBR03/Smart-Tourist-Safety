// src/components/common/Badge.tsx

import React from 'react';
import { RiskLevel, IncidentStatus, DeviceStatus, NotificationSeverity } from '../../types/enums';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type BadgeVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'brand'
  | 'ghost';

export type BadgeSize = 'sm' | 'md' | 'lg';

interface BadgeProps {
  children:  React.ReactNode;
  variant?:  BadgeVariant;
  size?:     BadgeSize;
  dot?:      boolean;
  pulse?:    boolean;
  className?: string;
}

// ─────────────────────────────────────────────
// Style maps
// ─────────────────────────────────────────────

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  default: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  success: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  warning: 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  danger:  'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  info:    'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  brand:   'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  ghost:   'bg-transparent text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700',
};

const DOT_CLASSES: Record<BadgeVariant, string> = {
  default: 'bg-slate-500',
  success: 'bg-emerald-500',
  warning: 'bg-orange-500',
  danger:  'bg-red-500',
  info:    'bg-cyan-500',
  brand:   'bg-blue-500',
  ghost:   'bg-slate-400',
};

const SIZE_CLASSES: Record<BadgeSize, string> = {
  sm: 'text-[10px] px-1.5 py-0.5 gap-1',
  md: 'text-xs px-2 py-0.5 gap-1.5',
  lg: 'text-sm px-2.5 py-1 gap-2',
};

const DOT_SIZE_CLASSES: Record<BadgeSize, string> = {
  sm: 'w-1.5 h-1.5',
  md: 'w-2 h-2',
  lg: 'w-2.5 h-2.5',
};

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export function Badge({
  children,
  variant   = 'default',
  size      = 'md',
  dot       = false,
  pulse     = false,
  className = '',
}: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center font-medium rounded-full whitespace-nowrap',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      ].join(' ')}
    >
      {dot && (
        <span
          className={[
            'rounded-full flex-shrink-0',
            DOT_CLASSES[variant],
            DOT_SIZE_CLASSES[size],
            pulse ? 'animate-pulse' : '',
          ].join(' ')}
        />
      )}
      {children}
    </span>
  );
}

// ─────────────────────────────────────────────
// Semantic badge factories
// ─────────────────────────────────────────────

export function RiskBadge({ level }: { level: RiskLevel | null | undefined }) {
  if (!level) return <Badge variant="ghost">—</Badge>;

  const map: Record<RiskLevel, { variant: BadgeVariant; label: string }> = {
    [RiskLevel.LOW]:    { variant: 'success', label: 'Low' },
    [RiskLevel.MEDIUM]: { variant: 'warning', label: 'Medium' },
    [RiskLevel.HIGH]:   { variant: 'danger',  label: 'High' },
  };

  const { variant, label } = map[level];
  return <Badge variant={variant} dot>{label}</Badge>;
}

export function IncidentStatusBadge({ status }: { status: IncidentStatus }) {
  const map: Record<IncidentStatus, { variant: BadgeVariant; label: string }> = {
    [IncidentStatus.OPEN]:        { variant: 'danger',  label: 'Open' },
    [IncidentStatus.IN_PROGRESS]: { variant: 'warning', label: 'In Progress' },
    [IncidentStatus.ESCALATED]:   { variant: 'danger',  label: 'Escalated' },
    [IncidentStatus.RESOLVED]:    { variant: 'success', label: 'Resolved' },
    [IncidentStatus.CLOSED]:      { variant: 'ghost',   label: 'Closed' },
    [IncidentStatus.CANCELLED]:   { variant: 'ghost',   label: 'Cancelled' },
    [IncidentStatus.REJECTED]:    { variant: 'ghost',   label: 'Rejected' },
  };

  const { variant, label } = map[status];
  return <Badge variant={variant} dot>{label}</Badge>;
}

export function DeviceStatusBadge({ status }: { status: DeviceStatus }) {
  const map: Record<DeviceStatus, { variant: BadgeVariant; label: string; pulse?: boolean }> = {
    [DeviceStatus.ACTIVE]:         { variant: 'success', label: 'Active', pulse: true },
    [DeviceStatus.INACTIVE]:       { variant: 'ghost',   label: 'Inactive' },
    [DeviceStatus.MAINTENANCE]:    { variant: 'warning', label: 'Maintenance' },
    [DeviceStatus.SUSPENDED]:      { variant: 'danger',  label: 'Suspended' },
    [DeviceStatus.DECOMMISSIONED]: { variant: 'ghost',   label: 'Decommissioned' },
    [DeviceStatus.LOST]:           { variant: 'danger',  label: 'Lost' },
  };

  const { variant, label, pulse } = map[status];
  return <Badge variant={variant} dot pulse={pulse}>{label}</Badge>;
}

export function SeverityBadge({ severity }: { severity: NotificationSeverity }) {
  const map: Record<NotificationSeverity, { variant: BadgeVariant; label: string }> = {
    [NotificationSeverity.INFO]:     { variant: 'info',    label: 'Info' },
    [NotificationSeverity.WARNING]:  { variant: 'warning', label: 'Warning' },
    [NotificationSeverity.CRITICAL]: { variant: 'danger',  label: 'Critical' },
  };

  const { variant, label } = map[severity];
  return <Badge variant={variant} dot>{label}</Badge>;
}