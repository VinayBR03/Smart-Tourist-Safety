// src/components/ui/MapLegend.tsx

import React, { useState } from 'react';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface LegendItem {
  color:        string;
  label:        string;
  description?: string;
  shape?:       'circle' | 'square' | 'diamond' | 'line';
  dashed?:      boolean;
  opacity?:     number;
}

interface LegendSection {
  title: string;
  items: LegendItem[];
  icon?: React.ReactNode;
}

interface MapLegendProps {
  sections?:    LegendSection[];
  position?:    'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  collapsible?: boolean;
  defaultOpen?: boolean;
  className?:   string;
  title?:       string;
}

// ─────────────────────────────────────────────
// Default sections
// ─────────────────────────────────────────────

const DEFAULT_SECTIONS: LegendSection[] = [
  {
    title: 'Zone Risk',
    icon: (
      <svg
        className="w-3.5 h-3.5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82
             c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125
             1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628
             1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z"
        />
      </svg>
    ),
    items: [
      { color: '#22c55e', label: 'Low Risk',    shape: 'square', opacity: 0.5 },
      { color: '#f97316', label: 'Medium Risk', shape: 'square', opacity: 0.5 },
      { color: '#ef4444', label: 'High Risk',   shape: 'square', opacity: 0.5 },
    ],
  },
  {
    title: 'Incidents',
    icon: (
      <svg
        className="w-3.5 h-3.5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0
             2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697
             16.126zM12 15.75h.007v.008H12v-.008z"
        />
      </svg>
    ),
    items: [
      { color: '#ef4444', label: 'Open',        shape: 'circle' },
      { color: '#f97316', label: 'In Progress', shape: 'circle' },
      { color: '#22c55e', label: 'Resolved',    shape: 'circle' },
    ],
  },
  {
    title: 'Devices',
    icon: (
      <svg
        className="w-3.5 h-3.5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25
             2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3
             18.75h3"
        />
      </svg>
    ),
    items: [
      { color: '#22c55e', label: 'Active',      shape: 'diamond' },
      { color: '#94a3b8', label: 'Inactive',    shape: 'diamond' },
      { color: '#f97316', label: 'Maintenance', shape: 'diamond' },
    ],
  },
  {
    title: 'Tourists',
    icon: (
      <svg
        className="w-3.5 h-3.5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
        />
      </svg>
    ),
    items: [
      { color: '#3b82f6', label: 'Live location', shape: 'circle' },
      { color: '#ef4444', label: 'Health alert',  shape: 'circle', dashed: true },
    ],
  },
];

// ─────────────────────────────────────────────
// Shape renderer
// ─────────────────────────────────────────────

function LegendShape({ item }: { item: LegendItem }) {
  const { color, shape = 'circle', dashed = false, opacity = 1 } = item;

  if (shape === 'circle') {
    return (
      <span
        className="w-3 h-3 rounded-full flex-shrink-0 ring-1 ring-white dark:ring-slate-800"
        style={
          dashed
            ? {
                backgroundColor: 'transparent',
                borderWidth: 2,
                borderStyle: 'dashed',
                borderColor: color,
                opacity,
              }
            : { backgroundColor: color, opacity }
        }
      />
    );
  }

  if (shape === 'square') {
    return (
      <span
        className="w-3 h-3 rounded-sm flex-shrink-0"
        style={{
          backgroundColor: color,
          opacity,
          outline: `1px solid ${color}`,
          outlineOffset: '0px',
        }}
      />
    );
  }

  if (shape === 'diamond') {
    return (
      <span
        className="w-3 h-3 flex-shrink-0 rotate-45 rounded-sm"
        style={{
          backgroundColor: color,
          opacity,
          boxShadow: `0 0 0 1px white`,
        }}
      />
    );
  }

  if (shape === 'line') {
    return (
      <span
        className="w-5 h-0.5 flex-shrink-0 rounded-full"
        style={
          dashed
            ? {
                borderTopWidth: 2,
                borderStyle: 'dashed',
                borderColor: color,
                opacity,
              }
            : { backgroundColor: color, opacity }
        }
      />
    );
  }

  return null;
}

// ─────────────────────────────────────────────
// Position classes
// ─────────────────────────────────────────────

const POSITION_CLASSES: Record<NonNullable<MapLegendProps['position']>, string> = {
  'top-left':     'top-3 left-3',
  'top-right':    'top-3 right-3',
  'bottom-left':  'bottom-3 left-3',
  'bottom-right': 'bottom-3 right-3',
};

// ─────────────────────────────────────────────
// MapLegend
// ─────────────────────────────────────────────

export function MapLegend({
  sections    = DEFAULT_SECTIONS,
  position    = 'bottom-right',
  collapsible = true,
  defaultOpen = true,
  className   = '',
  title       = 'Legend',
}: MapLegendProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div
      className={[
        'absolute z-[400]',
        POSITION_CLASSES[position],
        'bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm',
        'border border-slate-200 dark:border-slate-700',
        'rounded-xl shadow-lg',
        'min-w-[160px] max-w-[220px]',
        className,
      ].join(' ')}
    >
      {/* Header */}
      <div
        className={[
          'flex items-center justify-between px-3 py-2.5',
          isOpen ? 'border-b border-slate-100 dark:border-slate-800' : '',
          collapsible
            ? 'cursor-pointer select-none hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-t-xl transition-colors'
            : '',
        ].join(' ')}
        onClick={collapsible ? () => setIsOpen((v) => !v) : undefined}
      >
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
          {title}
        </span>
        {collapsible && (
          <svg
            className={[
              'w-3.5 h-3.5 text-slate-400 transition-transform duration-200',
              isOpen ? 'rotate-180' : '',
            ].join(' ')}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 8.25l-7.5 7.5-7.5-7.5"
            />
          </svg>
        )}
      </div>

      {/* Body */}
      {isOpen && (
        <div className="p-3 space-y-3">
          {sections.map((section, si) => (
            <div key={si}>
              {/* Section title */}
              <div className="flex items-center gap-1.5 mb-2">
                {section.icon && (
                  <span className="text-slate-400 dark:text-slate-500 flex-shrink-0">
                    {section.icon}
                  </span>
                )}
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {section.title}
                </span>
              </div>

              {/* Items */}
              <div className="space-y-1.5 pl-0.5">
                {section.items.map((item, ii) => (
                  <div key={ii} className="flex items-center gap-2">
                    <LegendShape item={item} />
                    <span className="text-[11px] text-slate-600 dark:text-slate-400 leading-tight">
                      {item.label}
                    </span>
                    {item.description && (
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">
                        {item.description}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Section separator */}
              {si < sections.length - 1 && (
                <div className="mt-3 border-t border-slate-100 dark:border-slate-800" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// InlineLegend (for chart legends, non-map use)
// ─────────────────────────────────────────────

interface InlineLegendItem {
  color:  string;
  label:  string;
  value?: string | number;
}

interface InlineLegendProps {
  items:      InlineLegendItem[];
  className?: string;
  vertical?:  boolean;
}

export function InlineLegend({
  items,
  className = '',
  vertical  = false,
}: InlineLegendProps) {
  return (
    <div
      className={[
        'flex flex-wrap gap-x-4 gap-y-2',
        vertical ? 'flex-col' : '',
        className,
      ].join(' ')}
    >
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: item.color }}
          />
          <span className="text-xs text-slate-600 dark:text-slate-400">
            {item.label}
          </span>
          {item.value !== undefined && (
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {item.value}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// RiskLevelLegend (pre-built for zone pages)
// ─────────────────────────────────────────────

export function RiskLevelLegend({ className = '' }: { className?: string }) {
  const items: InlineLegendItem[] = [
    { color: '#22c55e', label: 'Low' },
    { color: '#f97316', label: 'Medium' },
    { color: '#ef4444', label: 'High' },
  ];
  return <InlineLegend items={items} className={className} />;
}