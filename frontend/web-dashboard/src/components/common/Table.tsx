// src/components/common/Table.tsx

import React from 'react';
import { Loader } from './Loader';
import { EmptyState } from './EmptyState';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type SortDirection = 'asc' | 'desc' | null;

export interface Column<T> {
  key:         string;
  header:      React.ReactNode;
  render:      (row: T, index: number) => React.ReactNode;
  width?:      string;
  sortable?:   boolean;
  align?:      'left' | 'center' | 'right';
  className?:  string;
}

interface TableProps<T> {
  columns:      Column<T>[];
  data:         T[];
  keyExtractor: (row: T, index: number) => string | number;
  isLoading?:   boolean;
  error?:       string | null;
  emptyTitle?:  string;
  emptyMessage?: string;
  sortKey?:     string | null;
  sortDir?:     SortDirection;
  onSort?:      (key: string) => void;
  onRowClick?:  (row: T) => void;
  className?:   string;
  stickyHeader?: boolean;
  compact?:     boolean;
}

// ─────────────────────────────────────────────
// Sort icon
// ─────────────────────────────────────────────

function SortIcon({ direction }: { direction: SortDirection }) {
  if (!direction) {
    return (
      <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
      </svg>
    );
  }
  return (
    <svg className="w-3.5 h-3.5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      {direction === 'asc' ? (
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
      )}
    </svg>
  );
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export function Table<T>({
  columns,
  data,
  keyExtractor,
  isLoading     = false,
  error         = null,
  emptyTitle    = 'No data',
  emptyMessage  = 'Nothing to show here.',
  sortKey,
  sortDir,
  onSort,
  onRowClick,
  className     = '',
  stickyHeader  = false,
  compact       = false,
}: TableProps<T>) {
  const cellPad = compact ? 'px-4 py-2.5' : 'px-4 py-3.5';

  return (
    <div
      className={[
        'w-full overflow-hidden rounded-xl',
        'border border-slate-200 dark:border-slate-700',
        'bg-white dark:bg-slate-900',
        className,
      ].join(' ')}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          {/* Head */}
          <thead
            className={[
              'bg-slate-50 dark:bg-slate-800/60',
              'border-b border-slate-200 dark:border-slate-700',
              stickyHeader ? 'sticky top-0 z-10' : '',
            ].join(' ')}
          >
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{ width: col.width }}
                  className={[
                    cellPad,
                    'font-semibold text-slate-500 dark:text-slate-400',
                    'uppercase tracking-wide text-[11px]',
                    col.align === 'center' ? 'text-center' :
                    col.align === 'right'  ? 'text-right'  : 'text-left',
                    col.sortable && onSort
                      ? 'cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 select-none'
                      : '',
                    col.className ?? '',
                  ].join(' ')}
                  onClick={col.sortable && onSort ? () => onSort(col.key) : undefined}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {col.header}
                    {col.sortable && onSort && (
                      <SortIcon
                        direction={sortKey === col.key ? (sortDir ?? null) : null}
                      />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          {/* Body */}
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} className="py-16">
                  <Loader center size="md" label="Loading..." />
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={columns.length} className="py-12">
                  <div className="text-center text-sm text-red-500 dark:text-red-400">
                    {error}
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-4">
                  <EmptyState
                    title={emptyTitle}
                    message={emptyMessage}
                    compact
                  />
                </td>
              </tr>
            ) : (
              data.map((row, index) => (
                <tr
                  key={keyExtractor(row, index)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={[
                    'transition-colors duration-100',
                    'text-slate-700 dark:text-slate-300',
                    onRowClick
                      ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/30',
                  ].join(' ')}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={[
                        cellPad,
                        col.align === 'center' ? 'text-center' :
                        col.align === 'right'  ? 'text-right'  : 'text-left',
                        col.className ?? '',
                      ].join(' ')}
                    >
                      {col.render(row, index)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}