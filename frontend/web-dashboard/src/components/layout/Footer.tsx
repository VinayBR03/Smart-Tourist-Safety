// src/components/layout/Footer.tsx

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface FooterProps {
  collapsed?: boolean;
  className?: string;
}

// ─────────────────────────────────────────────
// Footer
// ─────────────────────────────────────────────

export function Footer({ collapsed = false, className = '' }: FooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer
      className={[
        'flex items-center px-4 py-3',
        'border-t border-slate-200 dark:border-slate-700/60',
        'bg-white dark:bg-slate-900',
        'transition-all duration-300',
        collapsed ? 'justify-center' : 'justify-between',
        className,
      ].join(' ')}
    >
      {/* Left — branding */}
      {!collapsed && (
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-5 h-5 rounded bg-blue-600 flex items-center justify-center flex-shrink-0">
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0
                003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196
                0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
            Smart Tourist Safety © {year}
          </span>
        </div>
      )}

      {/* Right — status indicator */}
      <div className={['flex items-center gap-1.5', collapsed ? '' : 'flex-shrink-0'].join(' ')}>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        {!collapsed && (
          <span className="text-xs text-slate-400 dark:text-slate-500">
            System online
          </span>
        )}
      </div>
    </footer>
  );
}