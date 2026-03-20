// src/components/common/EmptyState.tsx

import React from 'react';
import { Button } from './Button';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface EmptyStateProps {
  title:      string;
  message?:   string;
  icon?:      React.ReactNode;
  action?:    {
    label:   string;
    onClick: () => void;
    loading?: boolean;
  };
  compact?:   boolean;
  className?: string;
}

// ─────────────────────────────────────────────
// Default icon
// ─────────────────────────────────────────────

function DefaultIcon() {
  return (
    <svg
      className="w-10 h-10 text-slate-300 dark:text-slate-600"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75
        7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375
        c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
      />
    </svg>
  );
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export function EmptyState({
  title,
  message,
  icon,
  action,
  compact   = false,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={[
        'flex flex-col items-center justify-center text-center',
        compact ? 'py-8 px-4' : 'py-16 px-6',
        className,
      ].join(' ')}
    >
      {/* Icon */}
      <div
        className={[
          'flex items-center justify-center rounded-2xl mb-4',
          compact
            ? 'w-12 h-12 bg-slate-100 dark:bg-slate-800'
            : 'w-16 h-16 bg-slate-100 dark:bg-slate-800',
        ].join(' ')}
      >
        {icon ?? <DefaultIcon />}
      </div>

      {/* Title */}
      <h3
        className={[
          'font-semibold text-slate-900 dark:text-slate-100',
          compact ? 'text-sm' : 'text-base',
        ].join(' ')}
      >
        {title}
      </h3>

      {/* Message */}
      {message && (
        <p
          className={[
            'mt-1.5 text-slate-500 dark:text-slate-400 max-w-sm',
            compact ? 'text-xs' : 'text-sm',
          ].join(' ')}
        >
          {message}
        </p>
      )}

      {/* Action */}
      {action && (
        <div className="mt-5">
          <Button
            variant="primary"
            size={compact ? 'sm' : 'md'}
            onClick={action.onClick}
            loading={action.loading}
          >
            {action.label}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Preset empty states
// ─────────────────────────────────────────────

export function NoIncidents({ onRefresh }: { onRefresh?: () => void }) {
  return (
    <EmptyState
      title="No incidents found"
      message="There are no active incidents matching your filters."
      icon={
        <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874
            1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
      }
      action={onRefresh ? { label: 'Refresh', onClick: onRefresh } : undefined}
    />
  );
}

export function NoDevices({ onCreate }: { onCreate?: () => void }) {
  return (
    <EmptyState
      title="No devices registered"
      message="Register IoT devices to start monitoring tourists."
      icon={
        <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0
            0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
        </svg>
      }
      action={onCreate ? { label: 'Register Device', onClick: onCreate } : undefined}
    />
  );
}

export function NoNotifications() {
  return (
    <EmptyState
      title="All caught up"
      message="No new notifications at this time."
      icon={
        <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006
            9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255
            0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
      }
    />
  );
}