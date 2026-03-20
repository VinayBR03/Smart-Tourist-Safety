// src/components/ui/StatCard.tsx

import React from 'react';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type StatCardAccent =
  | 'blue'
  | 'emerald'
  | 'orange'
  | 'red'
  | 'purple'
  | 'cyan'
  | 'slate';

interface TrendInfo {
  value:     number;   // percentage change
  label?:    string;   // e.g. "vs last week"
  positive?: boolean;  // override auto-detect (positive = good)
}

interface StatCardProps {
  title:       string;
  value:       React.ReactNode;
  icon:        React.ReactNode;
  accent?:     StatCardAccent;
  trend?:      TrendInfo;
  subtitle?:   string;
  isLoading?:  boolean;
  onClick?:    () => void;
  className?:  string;
  badge?:      React.ReactNode;
}

// ─────────────────────────────────────────────
// Accent style maps
// ─────────────────────────────────────────────

const ACCENT_ICON_BG: Record<StatCardAccent, string> = {
  blue:    'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  emerald: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
  orange:  'bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
  red:     'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400',
  purple:  'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
  cyan:    'bg-cyan-50 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400',
  slate:   'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
};

const ACCENT_BORDER_TOP: Record<StatCardAccent, string> = {
  blue:    'before:bg-blue-500',
  emerald: 'before:bg-emerald-500',
  orange:  'before:bg-orange-500',
  red:     'before:bg-red-500',
  purple:  'before:bg-purple-500',
  cyan:    'before:bg-cyan-500',
  slate:   'before:bg-slate-400',
};

// ─────────────────────────────────────────────
// Trend arrow
// ─────────────────────────────────────────────

function TrendBadge({ trend }: { trend: TrendInfo }) {
  const isPositive = trend.positive ?? trend.value >= 0;
  const isUp       = trend.value >= 0;

  return (
    <div
      className={[
        'inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full',
        isPositive
          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
          : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      ].join(' ')}
    >
      <svg
        className={['w-3 h-3 transition-transform', isUp ? '' : 'rotate-180'].join(' ')}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2.5}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
      </svg>
      {Math.abs(trend.value).toFixed(1)}%
      {trend.label && (
        <span className="opacity-70">{trend.label}</span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// StatCard
// ─────────────────────────────────────────────

export function StatCard({
  title,
  value,
  icon,
  accent     = 'blue',
  trend,
  subtitle,
  isLoading  = false,
  onClick,
  className  = '',
  badge,
}: StatCardProps) {
  const isClickable = !!onClick;

  return (
    <div
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable
          ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }
          : undefined
      }
      className={[
        // Base card
        'relative overflow-hidden rounded-xl',
        'bg-white dark:bg-slate-900',
        'border border-slate-200 dark:border-slate-700/60',
        'p-5 flex flex-col gap-4',
        // Accent top bar via pseudo (handled via before: utilities)
        `before:absolute before:top-0 before:left-0 before:right-0 before:h-0.5`,
        ACCENT_BORDER_TOP[accent],
        // Interactive
        isClickable
          ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500'
          : 'transition-shadow duration-150 hover:shadow-sm',
        className,
      ].join(' ')}
    >
      {/* Top row — title + icon */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide truncate">
            {title}
          </p>
        </div>

        <div
          className={[
            'flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center',
            ACCENT_ICON_BG[accent],
          ].join(' ')}
        >
          <span className="w-5 h-5 flex items-center justify-center">
            {icon}
          </span>
        </div>
      </div>

      {/* Value row */}
      {isLoading ? (
        <div className="flex items-center gap-3">
          <div className="h-8 w-24 rounded-lg bg-slate-100 dark:bg-slate-800 skeleton-shimmer" />
        </div>
      ) : (
        <div className="flex items-end justify-between gap-2">
          <div>
            <div className="text-3xl font-bold text-slate-900 dark:text-slate-100 leading-none">
              {value}
            </div>
            {subtitle && (
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                {subtitle}
              </p>
            )}
          </div>

          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            {badge && badge}
            {trend && <TrendBadge trend={trend} />}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// StatCard grid wrapper
// ─────────────────────────────────────────────

interface StatGridProps {
  children:   React.ReactNode;
  cols?:      2 | 3 | 4;
  className?: string;
}

const GRID_COLS: Record<2 | 3 | 4, string> = {
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
};

export function StatGrid({ children, cols = 4, className = '' }: StatGridProps) {
  return (
    <div className={['grid gap-4', GRID_COLS[cols], className].join(' ')}>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────
// Mini stat (compact inline variant)
// ─────────────────────────────────────────────

interface MiniStatProps {
  label:      string;
  value:      React.ReactNode;
  icon?:      React.ReactNode;
  accent?:    StatCardAccent;
  isLoading?: boolean;
  className?: string;
}

export function MiniStat({
  label,
  value,
  icon,
  accent    = 'blue',
  isLoading = false,
  className = '',
}: MiniStatProps) {
  return (
    <div
      className={[
        'flex items-center gap-3 p-3 rounded-xl',
        'bg-white dark:bg-slate-900',
        'border border-slate-200 dark:border-slate-700/60',
        className,
      ].join(' ')}
    >
      {icon && (
        <div
          className={[
            'w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center',
            ACCENT_ICON_BG[accent],
          ].join(' ')}
        >
          <span className="w-4 h-4">{icon}</span>
        </div>
      )}
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
          {label}
        </p>
        {isLoading ? (
          <div className="h-5 w-16 mt-0.5 rounded skeleton-shimmer" />
        ) : (
          <p className="text-base font-bold text-slate-900 dark:text-slate-100 truncate">
            {value}
          </p>
        )}
      </div>
    </div>
  );
}