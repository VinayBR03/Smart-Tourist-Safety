// src/components/layout/Sidebar.tsx

import React from 'react';
import { NavLink } from 'react-router-dom';        // ← removed unused useLocation
import { useAuth } from '../../hooks/useAuth';
import { useUnreadCount } from '../../hooks/useNotifications';
import { Footer } from './Footer';
import logo from '../../assets/logos/SentinelTour-logo.svg';
import { UserRole } from '../../types/enums';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface SidebarProps {
  open:       boolean;
  collapsed:  boolean;
  onCollapse: () => void;
  className?: string;
}

interface NavItem {
  label:   string;
  path:    string;
  icon:    React.ReactNode;
  roles?:  UserRole[];
  exact?:  boolean;
  showBadge?: boolean;
}

interface NavGroup {
  group:  string;
  items:  NavItem[];
  roles?: UserRole[];
}

// ─────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────

const IC = {
  dashboard: (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21
        6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0
        1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5
        4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125
        1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  ),
  zones: (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869
        1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3
        6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158
        1.006 0z" />
    </svg>
  ),
  incidents: (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874
        1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  ),
  devices: (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0
        0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
    </svg>
  ),
  health: (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1
        3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
    </svg>
  ),
  notifications: (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0
        006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714
        0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
  ),
  map: (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
    </svg>
  ),
  analytics: (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25
        2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
    </svg>
  ),
  users: (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15
        19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331
        0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75
        0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  ),
  authority: (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824
        10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  ),
};

// ─────────────────────────────────────────────
// Nav config
// ─────────────────────────────────────────────

const NAV_GROUPS: NavGroup[] = [
  {
    group: 'Overview',
    items: [
      { label: 'Dashboard',      path: '/dashboard', icon: IC.dashboard, exact: true, roles: [UserRole.ADMIN, UserRole.AUTHORITY] },
      { label: 'Operations Map', path: '/map',        icon: IC.map,                   roles: [UserRole.ADMIN, UserRole.AUTHORITY] },
    ],
  },
  {
    group: 'Management',
    items: [
      { label: 'Zones',     path: '/zones',     icon: IC.zones,     roles: [UserRole.ADMIN, UserRole.AUTHORITY] },
      { label: 'Incidents', path: '/incidents', icon: IC.incidents, roles: [UserRole.ADMIN, UserRole.AUTHORITY] },
      { label: 'Devices',   path: '/devices',   icon: IC.devices,   roles: [UserRole.ADMIN, UserRole.AUTHORITY] },
      { label: 'Health',    path: '/health',    icon: IC.health,    roles: [UserRole.ADMIN, UserRole.AUTHORITY] },
    ],
  },
  {
    group: 'Communication',
    items: [
      { label: 'Notifications', path: '/notifications', icon: IC.notifications, showBadge: true },
    ],
  },
  {
    group: 'Analytics',
    roles: [UserRole.ADMIN, UserRole.AUTHORITY],
    items: [
      { label: 'Analytics', path: '/analytics', icon: IC.analytics, roles: [UserRole.ADMIN, UserRole.AUTHORITY] },
    ],
  },
  {
    group: 'Admin',
    roles: [UserRole.ADMIN],
    items: [
      { label: 'Users',       path: '/admin/users',       icon: IC.users,     roles: [UserRole.ADMIN] },
      { label: 'Authorities', path: '/admin/authorities', icon: IC.authority, roles: [UserRole.ADMIN] },
    ],
  },
];

// ─────────────────────────────────────────────
// NavItem component
// ─────────────────────────────────────────────

function SidebarNavItem({
  item,
  collapsed,
  badge,
}: {
  item:      NavItem;
  collapsed: boolean;
  badge?:    number;
}) {
  return (
    <NavLink
      to={item.path}
      end={item.exact}
      className={({ isActive }) =>
        [
          'group relative flex items-center rounded-lg transition-all duration-150',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
          collapsed ? 'w-9 h-9 justify-center mx-auto' : 'gap-3 px-3 py-2',
          isActive
            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200',
        ].join(' ')
      }
    >
      {/* Icon */}
      <span className={collapsed ? 'w-5 h-5 flex-shrink-0' : 'w-4 h-4 flex-shrink-0'}>
        {item.icon}
      </span>

      {/* Label */}
      {!collapsed && (
        <span className="text-sm font-medium truncate">{item.label}</span>
      )}

      {/* Badge */}
      {badge !== undefined && badge > 0 && (
        <span
          className={[
            'flex-shrink-0 min-w-[18px] h-[18px] px-1 rounded-full',
            'bg-red-500 text-white text-[10px] font-bold',
            'flex items-center justify-center',
            collapsed
              ? 'absolute -top-1 -right-1 ring-2 ring-white dark:ring-slate-900'
              : 'ml-auto',
          ].join(' ')}
        >
          {badge > 99 ? '99+' : badge}
        </span>
      )}

      {/* Collapsed tooltip */}
      {collapsed && (
        <span
          className={[
            'absolute left-full ml-2 px-2 py-1 rounded-md text-xs font-medium whitespace-nowrap z-50',
            'bg-slate-900 dark:bg-slate-700 text-white',
            'opacity-0 group-hover:opacity-100 pointer-events-none',
            'transition-opacity duration-150',
          ].join(' ')}
        >
          {item.label}
          {badge !== undefined && badge > 0 && ` (${badge})`}
        </span>
      )}
    </NavLink>
  );
}

// ─────────────────────────────────────────────
// Sidebar
// ─────────────────────────────────────────────

export function Sidebar({ open, collapsed, onCollapse, className = '' }: SidebarProps) {
  const { user }   = useAuth();
  const { count }  = useUnreadCount();    // ← count not unreadCount

  if (!user) return null;

  const visibleGroups = NAV_GROUPS
    .filter((g) => !g.roles || g.roles.includes(user.role))
    .map((g) => ({
      ...g,
      items: g.items.filter((item) => !item.roles || item.roles.includes(user.role)),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={onCollapse}
          aria-hidden="true"
        />
      )}

      {/* Panel */}
      <aside
        className={[
          'fixed top-0 left-0 z-30 h-full flex flex-col',
          'bg-white dark:bg-slate-900',
          'border-r border-slate-200 dark:border-slate-700/60',
          'transition-all duration-300 ease-in-out',
          collapsed ? 'w-[60px]' : 'w-60',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          className,
        ].join(' ')}
      >
        {/* Logo */}
        <div
          className={[
            'h-14 flex items-center flex-shrink-0',
            'border-b border-slate-200 dark:border-slate-700/60',
            collapsed ? 'justify-center px-0' : 'px-4 gap-3',
          ].join(' ')}
        >
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shadow-sm">
            <img 
              src={logo}
              className="w-7 h-7"
              alt="Sentinel Tour Logo" 
            />
          </div>
          {!collapsed && (
            <span className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Sentinel Tour
            </span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
          {visibleGroups.map((group) => (
            <div key={group.group}>
              {!collapsed ? (
                <p className="px-3 mb-1 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  {group.group}
                </p>
              ) : (
                <div className="w-5 h-px bg-slate-200 dark:bg-slate-700 mx-auto mb-2 mt-1" />
              )}

              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <SidebarNavItem
                    key={item.path}
                    item={item}
                    collapsed={collapsed}
                    badge={item.showBadge ? count : undefined}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Collapse toggle */}
        <div className="flex-shrink-0 px-2 pb-1">
          <button
            onClick={onCollapse}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={[
              'w-full flex items-center rounded-lg py-2 px-3',
              'text-slate-400 dark:text-slate-500',
              'hover:bg-slate-100 dark:hover:bg-slate-800',
              'hover:text-slate-600 dark:hover:text-slate-300',
              'transition-colors duration-150',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
              collapsed ? 'justify-center' : 'gap-3',
            ].join(' ')}
          >
            <svg
              className={[
                'w-4 h-4 flex-shrink-0 transition-transform duration-300',
                collapsed ? 'rotate-180' : '',
              ].join(' ')}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            {!collapsed && <span className="text-xs font-medium">Collapse</span>}
          </button>
        </div>

        <Footer collapsed={collapsed} />
      </aside>
    </>
  );
}