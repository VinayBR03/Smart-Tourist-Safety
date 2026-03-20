// src/components/common/Input.tsx

import React, { forwardRef, useState } from 'react';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type InputSize = 'sm' | 'md' | 'lg';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?:       string;
  error?:       string;
  hint?:        string;
  leftIcon?:    React.ReactNode;
  rightIcon?:   React.ReactNode;
  inputSize?:   InputSize;
  fullWidth?:   boolean;
}

// ─────────────────────────────────────────────
// Style maps
// ─────────────────────────────────────────────

const SIZE_CLASSES: Record<InputSize, string> = {
  sm: 'text-sm py-1.5 px-3 rounded-md',
  md: 'text-sm py-2 px-3.5 rounded-lg',
  lg: 'text-base py-2.5 px-4 rounded-lg',
};

const ICON_PAD_LEFT:  Record<InputSize, string> = { sm: 'pl-8',  md: 'pl-9',  lg: 'pl-11' };
const ICON_PAD_RIGHT: Record<InputSize, string> = { sm: 'pr-8',  md: 'pr-9',  lg: 'pr-11' };
const ICON_SIZE:      Record<InputSize, string> = { sm: 'w-3.5 h-3.5', md: 'w-4 h-4', lg: 'w-5 h-5' };
const ICON_POS_LEFT:  Record<InputSize, string> = { sm: 'left-2.5', md: 'left-3', lg: 'left-3.5' };
const ICON_POS_RIGHT: Record<InputSize, string> = { sm: 'right-2.5', md: 'right-3', lg: 'right-3.5' };

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input(
    {
      label,
      error,
      hint,
      leftIcon,
      rightIcon,
      inputSize = 'md',
      fullWidth = true,
      className = '',
      id,
      type,
      ...props
    },
    ref
  ) {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === 'password';
    const inputType  = isPassword ? (showPassword ? 'text' : 'password') : type;
    const inputId    = id ?? `input-${Math.random().toString(36).slice(2, 8)}`;

    return (
      <div className={fullWidth ? 'w-full' : ''}>
        {/* Label */}
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
          >
            {label}
          </label>
        )}

        {/* Input wrapper */}
        <div className="relative">
          {/* Left icon */}
          {leftIcon && (
            <span
              className={[
                'absolute top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none',
                ICON_POS_LEFT[inputSize],
                ICON_SIZE[inputSize],
              ].join(' ')}
            >
              {leftIcon}
            </span>
          )}

          {/* Input element */}
          <input
            ref={ref}
            id={inputId}
            type={inputType}
            className={[
              'block bg-white dark:bg-slate-800',
              'border text-slate-900 dark:text-slate-100',
              'placeholder:text-slate-400 dark:placeholder:text-slate-500',
              'transition-colors duration-150',
              'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              error
                ? 'border-red-400 dark:border-red-500 focus:ring-red-500'
                : 'border-slate-300 dark:border-slate-600',
              SIZE_CLASSES[inputSize],
              leftIcon  ? ICON_PAD_LEFT[inputSize]  : '',
              (rightIcon || isPassword) ? ICON_PAD_RIGHT[inputSize] : '',
              fullWidth ? 'w-full' : '',
              className,
            ].join(' ')}
            {...props}
          />

          {/* Right icon or password toggle */}
          {isPassword ? (
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className={[
                'absolute top-1/2 -translate-y-1/2 text-slate-400',
                'hover:text-slate-600 dark:hover:text-slate-300',
                'focus:outline-none transition-colors',
                ICON_POS_RIGHT[inputSize],
                ICON_SIZE[inputSize],
              ].join(' ')}
              tabIndex={-1}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                  strokeWidth={1.5} stroke="currentColor" className="w-full h-full">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138
                    2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065
                    7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65
                    3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242
                    4.242L9.88 9.88" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                  strokeWidth={1.5} stroke="currentColor" className="w-full h-full">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638
                    0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12
                    19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
            </button>
          ) : rightIcon ? (
            <span
              className={[
                'absolute top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none',
                ICON_POS_RIGHT[inputSize],
                ICON_SIZE[inputSize],
              ].join(' ')}
            >
              {rightIcon}
            </span>
          ) : null}
        </div>

        {/* Error message */}
        {error && (
          <p className="mt-1.5 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1
                1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {error}
          </p>
        )}

        {/* Hint */}
        {!error && hint && (
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{hint}</p>
        )}
      </div>
    );
  }
);

// ─────────────────────────────────────────────
// Select input
// ─────────────────────────────────────────────

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?:     string;
  error?:     string;
  hint?:      string;
  inputSize?: InputSize;
  fullWidth?: boolean;
  options:    Array<{ value: string; label: string; disabled?: boolean }>;
}

export function Select({
  label,
  error,
  hint,
  inputSize = 'md',
  fullWidth = true,
  options,
  className = '',
  id,
  ...props
}: SelectProps) {
  const selectId = id ?? `select-${Math.random().toString(36).slice(2, 8)}`;

  return (
    <div className={fullWidth ? 'w-full' : ''}>
      {label && (
        <label
          htmlFor={selectId}
          className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
        >
          {label}
        </label>
      )}

      <div className="relative">
        <select
          id={selectId}
          className={[
            'block appearance-none bg-white dark:bg-slate-800',
            'border text-slate-900 dark:text-slate-100',
            'transition-colors duration-150 cursor-pointer pr-8',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            error
              ? 'border-red-400 dark:border-red-500 focus:ring-red-500'
              : 'border-slate-300 dark:border-slate-600',
            SIZE_CLASSES[inputSize],
            fullWidth ? 'w-full' : '',
            className,
          ].join(' ')}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* Chevron */}
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </div>

      {error && (
        <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      {!error && hint && (
        <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{hint}</p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Textarea
// ─────────────────────────────────────────────

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?:     string;
  error?:     string;
  hint?:      string;
  fullWidth?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ label, error, hint, fullWidth = true, className = '', id, ...props }, ref) {
    const textareaId = id ?? `textarea-${Math.random().toString(36).slice(2, 8)}`;

    return (
      <div className={fullWidth ? 'w-full' : ''}>
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={[
            'block bg-white dark:bg-slate-800 border rounded-lg',
            'text-sm text-slate-900 dark:text-slate-100 px-3.5 py-2',
            'placeholder:text-slate-400 dark:placeholder:text-slate-500',
            'transition-colors duration-150 resize-y min-h-[80px]',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            error
              ? 'border-red-400 dark:border-red-500'
              : 'border-slate-300 dark:border-slate-600',
            fullWidth ? 'w-full' : '',
            className,
          ].join(' ')}
          {...props}
        />
        {error && (
          <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
        {!error && hint && (
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{hint}</p>
        )}
      </div>
    );
  }
);