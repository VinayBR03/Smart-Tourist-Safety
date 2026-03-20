// src/components/common/Button.tsx

import React from 'react';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'danger'
  | 'success'
  | 'ghost'
  | 'outline'
  | 'link';

export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:   ButtonVariant;
  size?:      ButtonSize;
  loading?:   boolean;
  leftIcon?:  React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

// ─────────────────────────────────────────────
// Style maps
// ─────────────────────────────────────────────

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white ' +
    'dark:bg-blue-600 dark:hover:bg-blue-500 shadow-sm',

  secondary:
    'bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 ' +
    'dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200',

  danger:
    'bg-red-600 hover:bg-red-500 active:bg-red-700 text-white ' +
    'dark:bg-red-700 dark:hover:bg-red-600 shadow-sm',

  success:
    'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white ' +
    'dark:bg-emerald-700 dark:hover:bg-emerald-600 shadow-sm',

  ghost:
    'bg-transparent hover:bg-slate-100 active:bg-slate-200 text-slate-600 ' +
    'dark:hover:bg-slate-700/60 dark:text-slate-300',

  outline:
    'bg-transparent border border-slate-300 hover:bg-slate-50 active:bg-slate-100 ' +
    'text-slate-700 dark:border-slate-600 dark:hover:bg-slate-700/40 dark:text-slate-300',

  link:
    'bg-transparent text-blue-600 hover:text-blue-500 dark:text-blue-400 ' +
    'dark:hover:text-blue-300 underline-offset-4 hover:underline p-0 h-auto',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  xs: 'text-xs px-2 py-1 gap-1 rounded',
  sm: 'text-sm px-3 py-1.5 gap-1.5 rounded-md',
  md: 'text-sm px-4 py-2 gap-2 rounded-lg',
  lg: 'text-base px-5 py-2.5 gap-2 rounded-lg',
  xl: 'text-base px-6 py-3 gap-2.5 rounded-xl',
};

// ─────────────────────────────────────────────
// Spinner
// ─────────────────────────────────────────────

function Spinner({ size }: { size: ButtonSize }) {
  const spinnerSize: Record<ButtonSize, string> = {
    xs: 'w-3 h-3',
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
    xl: 'w-5 h-5',
  };

  return (
    <svg
      className={`animate-spin flex-shrink-0 ${spinnerSize[size]}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12" cy="12" r="10"
        stroke="currentColor" strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export function Button({
  children,
  variant   = 'primary',
  size      = 'md',
  loading   = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      {...props}
      disabled={isDisabled}
      className={[
        'inline-flex items-center justify-center font-medium',
        'transition-all duration-150 focus-visible:outline-none',
        'focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
        'dark:focus-visible:ring-offset-slate-900',
        'select-none whitespace-nowrap',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        fullWidth ? 'w-full' : '',
        isDisabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'cursor-pointer',
        className,
      ].join(' ')}
    >
      {loading
        ? <Spinner size={size} />
        : leftIcon && <span className="flex-shrink-0">{leftIcon}</span>
      }
      {children && (
        <span className={loading ? 'opacity-70' : ''}>{children}</span>
      )}
      {!loading && rightIcon && (
        <span className="flex-shrink-0">{rightIcon}</span>
      )}
    </button>
  );
}

// ─────────────────────────────────────────────
// Icon-only button
// ─────────────────────────────────────────────

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon:       React.ReactNode;
  variant?:   ButtonVariant;
  size?:      ButtonSize;
  loading?:   boolean;
  label:      string; // aria-label required
}

const ICON_SIZE_CLASSES: Record<ButtonSize, string> = {
  xs: 'w-6 h-6 rounded',
  sm: 'w-7 h-7 rounded-md',
  md: 'w-8 h-8 rounded-lg',
  lg: 'w-10 h-10 rounded-lg',
  xl: 'w-12 h-12 rounded-xl',
};

export function IconButton({
  icon,
  variant   = 'ghost',
  size      = 'md',
  loading   = false,
  label,
  disabled,
  className = '',
  ...props
}: IconButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      {...props}
      aria-label={label}
      disabled={isDisabled}
      className={[
        'inline-flex items-center justify-center flex-shrink-0',
        'transition-all duration-150 focus-visible:outline-none',
        'focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
        'dark:focus-visible:ring-offset-slate-900',
        VARIANT_CLASSES[variant],
        ICON_SIZE_CLASSES[size],
        isDisabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'cursor-pointer',
        className,
      ].join(' ')}
    >
      {loading
        ? <Spinner size={size} />
        : icon
      }
    </button>
  );
}