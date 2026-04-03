// src/components/layout/Footer.tsx
import logo from '../../assets/logos/SentinelTour-logo.svg';

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
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shadow-sm">
            <img 
              src={logo}
              className="w-7 h-7"
              alt="Sentinel Tour Logo" 
            />
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
            Sentinel Tour © {year}
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