// src/components/common/Loader.tsx

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type LoaderSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type LoaderVariant = 'spinner' | 'dots' | 'pulse' | 'ring';

interface LoaderProps {
  size?:      LoaderSize;
  variant?:   LoaderVariant;
  label?:     string;
  center?:    boolean;
  fullPage?:  boolean;
  className?: string;
  color?:     string;
}

// ─────────────────────────────────────────────
// Size maps
// ─────────────────────────────────────────────

const SIZES: Record<LoaderSize, string> = {
  xs: 'w-3 h-3',
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
  xl: 'w-12 h-12',
};

const DOT_SIZES: Record<LoaderSize, string> = {
  xs: 'w-1 h-1',
  sm: 'w-1.5 h-1.5',
  md: 'w-2 h-2',
  lg: 'w-2.5 h-2.5',
  xl: 'w-3 h-3',
};

// ─────────────────────────────────────────────
// Spinner variant
// ─────────────────────────────────────────────

function Spinner({ size, color = 'text-blue-500' }: { size: LoaderSize; color?: string }) {
  return (
    <svg
      className={`animate-spin ${SIZES[size]} ${color}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      role="status"
      aria-label="Loading"
    >
      <circle
        className="opacity-20"
        cx="12" cy="12" r="10"
        stroke="currentColor" strokeWidth="4"
      />
      <path
        className="opacity-80"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

// ─────────────────────────────────────────────
// Dots variant
// ─────────────────────────────────────────────

function Dots({ size, color = 'bg-blue-500' }: { size: LoaderSize; color?: string }) {
  return (
    <div className="flex items-center gap-1.5" role="status" aria-label="Loading">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`rounded-full ${DOT_SIZES[size]} ${color} animate-bounce`}
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Ring variant
// ─────────────────────────────────────────────

function Ring({ size, color = 'border-blue-500' }: { size: LoaderSize; color?: string }) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={[
        'rounded-full border-2 border-transparent animate-spin',
        SIZES[size],
        color,
      ].join(' ')}
      style={{ borderTopColor: 'currentColor' }}
    />
  );
}

// ─────────────────────────────────────────────
// Main Loader component
// ─────────────────────────────────────────────

export function Loader({
  size      = 'md',
  variant   = 'spinner',
  label,
  center    = false,
  fullPage  = false,
  className = '',
  color,
}: LoaderProps) {
  const inner = (
    <div
      className={[
        'flex flex-col items-center gap-3',
        center && !fullPage ? 'w-full justify-center py-12' : '',
        className,
      ].join(' ')}
    >
      {variant === 'spinner' && (
        <Spinner size={size} color={color ?? 'text-blue-500 dark:text-blue-400'} />
      )}
      {variant === 'dots' && (
        <Dots size={size} color={color ?? 'bg-blue-500 dark:bg-blue-400'} />
      )}
      {variant === 'ring' && (
        <Ring size={size} color={color ?? 'border-blue-500 dark:border-blue-400'} />
      )}
      {variant === 'pulse' && (
        <div
          className={[
            'rounded-full animate-pulse',
            SIZES[size],
            color ?? 'bg-blue-500 dark:bg-blue-400',
          ].join(' ')}
          role="status"
          aria-label="Loading"
        />
      )}

      {label && (
        <p className="text-sm text-slate-500 dark:text-slate-400 animate-pulse">
          {label}
        </p>
      )}
    </div>
  );

  if (fullPage) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-4 bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-2xl">
          <Spinner size="lg" color="text-blue-500" />
          {label && (
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{label}</p>
          )}
        </div>
      </div>
    );
  }

  if (center) {
    return (
      <div className="flex items-center justify-center w-full py-12">
        {inner}
      </div>
    );
  }

  return inner;
}

// ─────────────────────────────────────────────
// Inline loader (for buttons etc.)
// ─────────────────────────────────────────────

export function InlineLoader({ size = 'sm' }: { size?: LoaderSize }) {
  return <Spinner size={size} color="text-current" />;
}