// src/components/common/Tabs.tsx

import React, { useState, useRef } from 'react';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface Tab {
  key:       string;
  label:     React.ReactNode;
  icon?:     React.ReactNode;
  badge?:    number | string;
  disabled?: boolean;
}

type TabsVariant = 'line' | 'pills' | 'boxed';

interface TabsProps {
  tabs:          Tab[];
  activeKey:     string;
  onChange:      (key: string) => void;
  variant?:      TabsVariant;
  fullWidth?:    boolean;
  className?:    string;
}

// ─────────────────────────────────────────────
// Variants
// ─────────────────────────────────────────────

const CONTAINER: Record<TabsVariant, string> = {
  line:  'border-b border-slate-200 dark:border-slate-700',
  pills: 'bg-slate-100 dark:bg-slate-800 rounded-xl p-1',
  boxed: 'border border-slate-200 dark:border-slate-700 rounded-xl p-1 bg-slate-50 dark:bg-slate-800/50',
};

const ACTIVE_TAB: Record<TabsVariant, string> = {
  line:  'text-blue-600 dark:text-blue-400 border-b-2 border-blue-500',
  pills: 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm',
  boxed: 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm',
};

const INACTIVE_TAB: Record<TabsVariant, string> = {
  line:  'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 border-b-2 border-transparent hover:border-slate-300',
  pills: 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-700/60',
  boxed: 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300',
};

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export function Tabs({
  tabs,
  activeKey,
  onChange,
  variant    = 'line',
  fullWidth  = false,
  className  = '',
}: TabsProps) {
  const containerRef  = useRef<HTMLDivElement>(null);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent, key: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onChange(key);
    }
  };

  const basePad = variant === 'line'
    ? 'px-4 py-2.5 -mb-px'
    : 'px-3 py-2';

  return (
    <div
      ref={containerRef}
      role="tablist"
      className={[
        'flex',
        fullWidth ? 'w-full' : '',
        CONTAINER[variant],
        className,
      ].join(' ')}
    >
      {tabs.map((tab) => {
        const isActive   = tab.key === activeKey;
        const isDisabled = tab.disabled ?? false;

        return (
          <button
            key={tab.key}
            role="tab"
            aria-selected={isActive}
            aria-disabled={isDisabled}
            tabIndex={isActive ? 0 : -1}
            disabled={isDisabled}
            onClick={() => !isDisabled && onChange(tab.key)}
            onKeyDown={(e) => !isDisabled && handleKeyDown(e, tab.key)}
            className={[
              'inline-flex items-center gap-2 text-sm font-medium',
              'transition-all duration-150 rounded-lg',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
              'whitespace-nowrap select-none',
              basePad,
              fullWidth ? 'flex-1 justify-center' : '',
              isActive   ? ACTIVE_TAB[variant] : INACTIVE_TAB[variant],
              isDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
            ].join(' ')}
          >
            {tab.icon && (
              <span className="w-4 h-4 flex-shrink-0">{tab.icon}</span>
            )}
            {tab.label}
            {tab.badge !== undefined && (
              <span
                className={[
                  'inline-flex items-center justify-center',
                  'min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold',
                  isActive
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                    : 'bg-slate-200 text-slate-600 dark:bg-slate-600 dark:text-slate-300',
                ].join(' ')}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────
// Controlled tab panel
// ─────────────────────────────────────────────

interface TabPanelProps {
  tabKey:    string;
  activeKey: string;
  children:  React.ReactNode;
  keepMounted?: boolean; // keep DOM alive when inactive
}

export function TabPanel({
  tabKey,
  activeKey,
  children,
  keepMounted = false,
}: TabPanelProps) {
  const isActive = tabKey === activeKey;

  if (!keepMounted && !isActive) return null;

  return (
    <div
      role="tabpanel"
      hidden={!isActive}
      className={isActive ? 'animate-fade-in' : ''}
    >
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────
// Stateful tabs (self-managed)
// ─────────────────────────────────────────────

interface StatefulTabsProps {
  tabs:       (Tab & { content: React.ReactNode })[];
  defaultKey?: string;
  variant?:   TabsVariant;
  fullWidth?: boolean;
  className?: string;
  panelClassName?: string;
}

export function StatefulTabs({
  tabs,
  defaultKey,
  variant       = 'line',
  fullWidth     = false,
  className     = '',
  panelClassName = '',
}: StatefulTabsProps) {
  const [activeKey, setActiveKey] = useState(
    defaultKey ?? tabs[0]?.key ?? ''
  );

  return (
    <div>
      <Tabs
        tabs={tabs}
        activeKey={activeKey}
        onChange={setActiveKey}
        variant={variant}
        fullWidth={fullWidth}
        className={className}
      />
      <div className={panelClassName}>
        {tabs.map((tab) => (
          <TabPanel key={tab.key} tabKey={tab.key} activeKey={activeKey}>
            {tab.content}
          </TabPanel>
        ))}
      </div>
    </div>
  );
}