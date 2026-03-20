// src/components/ui/Card.tsx

import React from 'react';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type CardPadding = 'none' | 'sm' | 'md' | 'lg';
type CardVariant = 'default' | 'bordered' | 'elevated' | 'ghost' | 'danger' | 'warning' | 'success' | 'info';

interface CardProps {
  children:    React.ReactNode;
  padding?:    CardPadding;
  variant?:    CardVariant;
  hoverable?:  boolean;
  clickable?:  boolean;
  onClick?:    () => void;
  className?:  string;
  as?:         React.ElementType;
}

// ─────────────────────────────────────────────
// Style maps
// ─────────────────────────────────────────────

const PADDING_CLASSES: Record<CardPadding, string> = {
  none: '',
  sm:   'p-3',
  md:   'p-5',
  lg:   'p-6',
};

const VARIANT_CLASSES: Record<CardVariant, string> = {
  default:  'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60',
  bordered: 'bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700',
  elevated: 'bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700/40 shadow-lg dark:shadow-slate-950/50',
  ghost:    'bg-slate-50 dark:bg-slate-800/50 border border-transparent',
  danger:   'bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/40',
  warning:  'bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800/40',
  success:  'bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40',
  info:     'bg-cyan-50 dark:bg-cyan-950/20 border border-cyan-200 dark:border-cyan-800/40',
};

// ─────────────────────────────────────────────
// Card
// ─────────────────────────────────────────────

export function Card({
  children,
  padding   = 'md',
  variant   = 'default',
  hoverable = false,
  clickable = false,
  onClick,
  className = '',
  as:       Tag = 'div',
}: CardProps) {
  const isInteractive = clickable || !!onClick;

  return (
    <Tag
      onClick={onClick}
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onKeyDown={
        isInteractive
          ? (e: React.KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') onClick?.();
            }
          : undefined
      }
      className={[
        'rounded-xl transition-all duration-150',
        VARIANT_CLASSES[variant],
        PADDING_CLASSES[padding],
        hoverable || isInteractive
          ? 'hover:shadow-md dark:hover:shadow-slate-950/60 hover:-translate-y-0.5'
          : '',
        isInteractive
          ? 'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500'
          : '',
        className,
      ].join(' ')}
    >
      {children}
    </Tag>
  );
}

// ─────────────────────────────────────────────
// Card sub-components
// ─────────────────────────────────────────────

interface CardHeaderProps {
  children:   React.ReactNode;
  className?: string;
  border?:    boolean;
}

export function CardHeader({ children, className = '', border = true }: CardHeaderProps) {
  return (
    <div
      className={[
        'flex items-center justify-between px-5 py-4',
        border ? 'border-b border-slate-100 dark:border-slate-800' : '',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  );
}

interface CardBodyProps {
  children:   React.ReactNode;
  className?: string;
  padding?:   CardPadding;
}

export function CardBody({ children, className = '', padding = 'md' }: CardBodyProps) {
  return (
    <div className={[PADDING_CLASSES[padding], className].join(' ')}>
      {children}
    </div>
  );
}

interface CardFooterProps {
  children:   React.ReactNode;
  className?: string;
  border?:    boolean;
}

export function CardFooter({ children, className = '', border = true }: CardFooterProps) {
  return (
    <div
      className={[
        'px-5 py-4',
        border ? 'border-t border-slate-100 dark:border-slate-800' : '',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────
// Card title helper
// ─────────────────────────────────────────────

interface CardTitleProps {
  title:       string;
  subtitle?:   string;
  icon?:       React.ReactNode;
  action?:     React.ReactNode;
  className?:  string;
}

export function CardTitle({ title, subtitle, icon, action, className = '' }: CardTitleProps) {
  return (
    <div className={['flex items-center justify-between w-full', className].join(' ')}>
      <div className="flex items-center gap-3 min-w-0">
        {icon && (
          <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
            {title}
          </h3>
          {subtitle && (
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {action && <div className="flex-shrink-0 ml-4">{action}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────
// Metric card (simple labeled value)
// ─────────────────────────────────────────────

interface MetricCardProps {
  label:      string;
  value:      React.ReactNode;
  delta?:     { value: string; positive: boolean };
  className?: string;
}

export function MetricCard({ label, value, delta, className = '' }: MetricCardProps) {
  return (
    <Card className={className}>
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
        {label}
      </p>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          {value}
        </span>
        {delta && (
          <span
            className={[
              'text-xs font-medium',
              delta.positive
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-red-600 dark:text-red-400',
            ].join(' ')}
          >
            {delta.positive ? '↑' : '↓'} {delta.value}
          </span>
        )}
      </div>
    </Card>
  );
}