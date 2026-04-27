// src/components/ui/SectionHeader.tsx

import React from 'react';
import { Link } from 'react-router-dom';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type SectionSize = 'sm' | 'md' | 'lg';

interface SectionHeaderProps {
  title:      string;
  subtitle?:  string;
  icon?:      React.ReactNode;
  action?:    React.ReactNode;
  badge?:     React.ReactNode;
  className?: string;
  size?:      SectionSize;
  divider?:   boolean;
}

interface PageHeaderProps {
  title:        string;
  subtitle?:    string;
  icon?:        React.ReactNode;
  action?:      React.ReactNode;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  className?:   string;
}

interface DividerProps {
  label?:     string;
  className?: string;
}

// ─────────────────────────────────────────────
// Size maps
// ─────────────────────────────────────────────

const TITLE_SIZE: Record<SectionSize, string> = {
  sm: 'text-sm font-semibold',
  md: 'text-base font-semibold',
  lg: 'text-xl font-bold',
};

const SUBTITLE_SIZE: Record<SectionSize, string> = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-sm',
};

// Outer coloured box size
const ICON_WRAP: Record<SectionSize, string> = {
  sm: 'w-7 h-7',
  md: 'w-9 h-9',
  lg: 'w-10 h-10',
};

// ─────────────────────────────────────────────
// SectionHeader
// ─────────────────────────────────────────────

export function SectionHeader({
  title,
  subtitle,
  icon,
  action,
  badge,
  className = '',
  size      = 'md',
  divider   = false,
}: SectionHeaderProps) {
  return (
    <div
      className={[
        'flex items-center justify-between gap-4',
        divider
          ? 'pb-4 border-b border-slate-200 dark:border-slate-700 mb-5'
          : 'mb-4',
        className,
      ].join(' ')}
    >
      {/* Left — icon + text */}
      <div className="flex items-center gap-3 min-w-0">
        {icon && (
          <div
            className={[
              'flex-shrink-0 rounded-xl',
              'bg-blue-50 dark:bg-blue-900/30',
              'text-blue-600 dark:text-blue-400',
              // flex centres whatever SVG is placed inside regardless of its own size
              'flex items-center justify-center',
              ICON_WRAP[size],
            ].join(' ')}
          >
            {/* Constrain + centre the icon; [&>svg] targets the SVG child directly */}
            <span className="flex items-center justify-center w-full h-full [&>svg]:w-4 [&>svg]:h-4">
              {icon}
            </span>
          </div>
        )}

        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2
              className={[
                'text-slate-900 dark:text-slate-100 truncate',
                TITLE_SIZE[size],
              ].join(' ')}
            >
              {title}
            </h2>
            {badge && <span className="flex-shrink-0">{badge}</span>}
          </div>

          {subtitle && (
            <p
              className={[
                'text-slate-500 dark:text-slate-400 mt-0.5 truncate',
                SUBTITLE_SIZE[size],
              ].join(' ')}
            >
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Right — action */}
      {action && (
        <div className="flex-shrink-0 flex items-center gap-2">
          {action}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// PageHeader
// ─────────────────────────────────────────────

export function PageHeader({
  title,
  subtitle,
  icon,
  action,
  breadcrumbs,
  className = '',
}: PageHeaderProps) {
  return (
    <div
      className={[
        'flex flex-col gap-1 pb-5 mb-6',
        'border-b border-slate-200 dark:border-slate-700',
        className,
      ].join(' ')}
    >
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1.5 mb-2" aria-label="Breadcrumb">
          {breadcrumbs.map((crumb, i) => (
            <React.Fragment key={i}>
              {i > 0 && (
                <svg
                  className="w-3 h-3 text-slate-400 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8.25 4.5l7.5 7.5-7.5 7.5"
                  />
                </svg>
              )}
              {crumb.href ? (
                <Link
                  to={crumb.href}
                  className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  {crumb.label}
                </span>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}

      {/* Title row */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {icon && (
            <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <span className="flex items-center justify-center [&>svg]:w-5 [&>svg]:h-5">
                {icon}
              </span>
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 truncate">
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {action && (
          <div className="flex-shrink-0 flex items-center gap-2">
            {action}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Divider
// ─────────────────────────────────────────────

export function Divider({ label, className = '' }: DividerProps) {
  if (!label) {
    return (
      <hr
        className={[
          'border-slate-200 dark:border-slate-700 my-4',
          className,
        ].join(' ')}
      />
    );
  }

  return (
    <div className={['flex items-center gap-3 my-4', className].join(' ')}>
      <div className="flex-1 border-t border-slate-200 dark:border-slate-700" />
      <span className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide whitespace-nowrap">
        {label}
      </span>
      <div className="flex-1 border-t border-slate-200 dark:border-slate-700" />
    </div>
  );
}