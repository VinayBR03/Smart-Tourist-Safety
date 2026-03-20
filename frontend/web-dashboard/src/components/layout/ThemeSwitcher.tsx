// src/components/layout/ThemeSwitcher.tsx

import { useThemeMode, useIsDark } from '../../theme/useTheme';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type SwitcherVariant = 'icon' | 'toggle' | 'segmented';

interface ThemeSwitcherProps {
  variant?:   SwitcherVariant;
  className?: string;
}

// ─────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────

function SunIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591
        1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
    </svg>
  );
}

function MoonIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753
        9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
    </svg>
  );
}

// ─────────────────────────────────────────────
// Icon button variant
// ─────────────────────────────────────────────

function IconVariant({ className }: { className: string }) {
  const isDark           = useIsDark();
  const { toggleTheme }  = useThemeMode();   // ← toggleTheme not toggle

  return (
    <button
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={[
        'w-8 h-8 rounded-lg flex items-center justify-center',
        'text-slate-500 dark:text-slate-400',
        'hover:bg-slate-100 dark:hover:bg-slate-700/60',
        'hover:text-slate-700 dark:hover:text-slate-200',
        'transition-all duration-150',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
        className,
      ].join(' ')}
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

// ─────────────────────────────────────────────
// Toggle (pill) variant
// ─────────────────────────────────────────────

function ToggleVariant({ className }: { className: string }) {
  const isDark          = useIsDark();
  const { toggleTheme } = useThemeMode();   // ← toggleTheme not toggle

  return (
    <button
      onClick={toggleTheme}
      role="switch"
      aria-checked={isDark}
      aria-label="Toggle dark mode"
      className={[
        'relative inline-flex items-center w-14 h-7 rounded-full',
        'transition-colors duration-200 focus:outline-none',
        'focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
        'dark:focus-visible:ring-offset-slate-900',
        isDark ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700',
        className,
      ].join(' ')}
    >
      <span
        className="absolute left-1.5 top-1/2 -translate-y-1/2 text-yellow-400 transition-opacity duration-200"
        style={{ opacity: isDark ? 0 : 1 }}
      >
        <SunIcon className="w-3.5 h-3.5" />
      </span>
      <span
        className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-200 transition-opacity duration-200"
        style={{ opacity: isDark ? 1 : 0 }}
      >
        <MoonIcon className="w-3.5 h-3.5" />
      </span>
      <span
        className={[
          'absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-sm',
          'transform transition-transform duration-200',
          isDark ? 'translate-x-7' : 'translate-x-0.5',
        ].join(' ')}
      />
    </button>
  );
}

// ─────────────────────────────────────────────
// Segmented variant
// ─────────────────────────────────────────────

function SegmentedVariant({ className }: { className: string }) {
  const isDark        = useIsDark();
  const { setTheme }  = useThemeMode();   // ← setTheme not setMode

  return (
    <div
      className={[
        'flex items-center gap-0.5 p-1 rounded-lg',
        'bg-slate-100 dark:bg-slate-800',
        'border border-slate-200 dark:border-slate-700',
        className,
      ].join(' ')}
    >
      <button
        onClick={() => setTheme('light')}
        aria-label="Light mode"
        className={[
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium',
          'transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
          !isDark
            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300',
        ].join(' ')}
      >
        <SunIcon className="w-3.5 h-3.5" />
        Light
      </button>

      <button
        onClick={() => setTheme('dark')}
        aria-label="Dark mode"
        className={[
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium',
          'transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
          isDark
            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300',
        ].join(' ')}
      >
        <MoonIcon className="w-3.5 h-3.5" />
        Dark
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────

export function ThemeSwitcher({ variant = 'icon', className = '' }: ThemeSwitcherProps) {
  if (variant === 'toggle')    return <ToggleVariant    className={className} />;
  if (variant === 'segmented') return <SegmentedVariant className={className} />;
  return                              <IconVariant      className={className} />;
}