// src/components/common/Skeleton.tsx


// ─────────────────────────────────────────────
// Base skeleton
// ─────────────────────────────────────────────

interface SkeletonProps {
  className?: string;
  width?:     string;
  height?:    string;
  rounded?:   'sm' | 'md' | 'lg' | 'full';
}

export function Skeleton({
  className = '',
  width,
  height,
  rounded = 'md',
}: SkeletonProps) {
  const roundedMap = {
    sm:   'rounded',
    md:   'rounded-md',
    lg:   'rounded-lg',
    full: 'rounded-full',
  };

  return (
    <div
      className={[
        'skeleton-shimmer',
        roundedMap[rounded],
        className,
      ].join(' ')}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}

// ─────────────────────────────────────────────
// Skeleton text lines
// ─────────────────────────────────────────────

interface SkeletonTextProps {
  lines?:     number;
  className?: string;
}

export function SkeletonText({ lines = 3, className = '' }: SkeletonTextProps) {
  return (
    <div className={`space-y-2 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-4"
          width={i === lines - 1 && lines > 1 ? '70%' : '100%'}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Skeleton card
// ─────────────────────────────────────────────

interface SkeletonCardProps {
  className?: string;
  hasImage?:  boolean;
  lines?:     number;
}

export function SkeletonCard({
  className = '',
  hasImage  = false,
  lines     = 3,
}: SkeletonCardProps) {
  return (
    <div
      className={[
        'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700',
        'rounded-xl p-4 space-y-3',
        className,
      ].join(' ')}
      aria-hidden="true"
    >
      {hasImage && <Skeleton className="w-full h-32" rounded="lg" />}
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 flex-shrink-0" rounded="full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <SkeletonText lines={lines} />
    </div>
  );
}

// ─────────────────────────────────────────────
// Skeleton stat card
// ─────────────────────────────────────────────

export function SkeletonStatCard({ className = '' }: { className?: string }) {
  return (
    <div
      className={[
        'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700',
        'rounded-xl p-5',
        className,
      ].join(' ')}
      aria-hidden="true"
    >
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="w-9 h-9" rounded="lg" />
      </div>
      <Skeleton className="h-8 w-20 mb-2" />
      <Skeleton className="h-3 w-32" />
    </div>
  );
}

// ─────────────────────────────────────────────
// Skeleton table row
// ─────────────────────────────────────────────

interface SkeletonTableProps {
  rows?:     number;
  cols?:     number;
  className?: string;
}

export function SkeletonTable({
  rows      = 5,
  cols      = 4,
  className = '',
}: SkeletonTableProps) {
  return (
    <div className={`space-y-3 ${className}`} aria-hidden="true">
      {/* Header */}
      <div
        className="grid gap-4 pb-3 border-b border-slate-200 dark:border-slate-700"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
      >
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-4" width={i === 0 ? '60%' : '80%'} />
        ))}
      </div>

      {/* Rows */}
      {Array.from({ length: rows }).map((_, row) => (
        <div
          key={row}
          className="grid gap-4 py-2"
          style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
        >
          {Array.from({ length: cols }).map((_, col) => (
            <Skeleton
              key={col}
              className="h-4"
              width={col === 0 ? '90%' : col === cols - 1 ? '50%' : '75%'}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Skeleton list item
// ─────────────────────────────────────────────

export function SkeletonListItem({ className = '' }: { className?: string }) {
  return (
    <div
      className={`flex items-start gap-3 py-3 ${className}`}
      aria-hidden="true"
    >
      <Skeleton className="w-9 h-9 flex-shrink-0 mt-0.5" rounded="lg" />
      <div className="flex-1 space-y-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
      </div>
    </div>
  );
}