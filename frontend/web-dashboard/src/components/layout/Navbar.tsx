// src/components/layout/Navbar.tsx

import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useUnreadCount } from '../../hooks/useNotifications';
import { ThemeSwitcher } from './ThemeSwitcher';
import { UserRole } from '../../types/enums';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface NavbarProps {
  onMenuToggle: () => void;
  sidebarOpen:  boolean;
  className?:   string;
}

// ─────────────────────────────────────────────
// Notification bell
// ─────────────────────────────────────────────

function NotificationBell() {
  const { count }  = useUnreadCount();     // ← count not unreadCount
  const navigate   = useNavigate();

  return (
    <button
      onClick={() => navigate('/notifications')}
      aria-label={`Notifications${count > 0 ? ` (${count} unread)` : ''}`}
      className={[
        'relative w-8 h-8 rounded-lg flex items-center justify-center',
        'text-slate-500 dark:text-slate-400',
        'hover:bg-slate-100 dark:hover:bg-slate-700/60',
        'hover:text-slate-700 dark:hover:text-slate-200',
        'transition-all duration-150',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
      ].join(' ')}
    >
      <svg
        className="w-[18px] h-[18px]"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0
          006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714
          0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
      </svg>

      {count > 0 && (
        <span
          className={[
            'absolute -top-0.5 -right-0.5',
            'min-w-[16px] h-4 px-0.5 rounded-full',
            'bg-red-500 text-white text-[10px] font-bold',
            'flex items-center justify-center',
            'ring-2 ring-white dark:ring-slate-900',
            'animate-pulse',
          ].join(' ')}
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  );
}

// ─────────────────────────────────────────────
// User menu
// ─────────────────────────────────────────────

function UserMenu() {
  const { user, logout, isAdmin, isAuthority } = useAuth();
  const navigate                                = useNavigate();
  const [open, setOpen]                         = useState(false);
  const menuRef                                 = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  if (!user) return null;

  const roleLabel: Record<UserRole, string> = {
    [UserRole.ADMIN]:     'Administrator',
    [UserRole.AUTHORITY]: 'Authority',
    [UserRole.TOURIST]:   'Tourist',
  };

  const roleBadgeColor: Record<UserRole, string> = {
    [UserRole.ADMIN]:     'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    [UserRole.AUTHORITY]: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    [UserRole.TOURIST]:   'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  };

  // full_name is the only name field on User
  const displayName = user.full_name || user.email;
  const initials    = user.full_name
    ? user.full_name
        .split(' ')
        .filter(Boolean)
        .map((w) => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : user.email[0].toUpperCase();

  return (
    <div ref={menuRef} className="relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        className={[
          'flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg',
          'hover:bg-slate-100 dark:hover:bg-slate-700/60',
          'transition-colors duration-150',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
        ].join(' ')}
      >
        {/* Avatar */}
        <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-bold text-white">{initials}</span>
        </div>

        {/* Name */}
        <div className="hidden sm:block text-left min-w-0">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[120px]">
            {displayName}
          </p>
        </div>

        {/* Chevron */}
        <svg
          className={[
            'w-3 h-3 text-slate-400 transition-transform duration-150',
            open ? 'rotate-180' : '',
          ].join(' ')}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className={[
            'absolute right-0 top-full mt-2 w-56 z-50',
            'bg-white dark:bg-slate-900',
            'border border-slate-200 dark:border-slate-700',
            'rounded-xl shadow-xl animate-fade-in',
          ].join(' ')}
        >
          {/* User info */}
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
              {user.full_name || '—'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
              {user.email}
            </p>
            <span
              className={[
                'inline-flex mt-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full',
                roleBadgeColor[user.role],
              ].join(' ')}
            >
              {roleLabel[user.role]}
            </span>
          </div>

          {/* Menu items */}
          <div className="py-1">
            {/* isAdmin / isAuthority are booleans not functions */}
            {(isAdmin || isAuthority) && (
              <MenuButton
                icon={
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5
                      20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125
                      1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125
                      1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504
                      21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                  </svg>
                }
                label="Dashboard"
                onClick={() => { navigate('/dashboard'); setOpen(false); }}
              />
            )}

            <MenuButton
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0
                    006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255
                    24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                </svg>
              }
              label="Notifications"
              onClick={() => { navigate('/notifications'); setOpen(false); }}
            />
          </div>

          {/* Sign out */}
          <div className="py-1 border-t border-slate-100 dark:border-slate-800">
            <MenuButton
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0
                    007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                </svg>
              }
              label="Sign out"
              onClick={async () => { await logout(); window.location.replace('/login'); }}
              danger
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Menu button helper
// ─────────────────────────────────────────────

function MenuButton({
  icon,
  label,
  onClick,
  danger = false,
}: {
  icon:    React.ReactNode;
  label:   string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        'w-full flex items-center gap-3 px-4 py-2 text-sm',
        'transition-colors duration-100',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
        danger
          ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800',
      ].join(' ')}
    >
      <span className="flex-shrink-0">{icon}</span>
      {label}
    </button>
  );
}

// ─────────────────────────────────────────────
// Navbar
// ─────────────────────────────────────────────

export function Navbar({ onMenuToggle, sidebarOpen, className = '' }: NavbarProps) {
  return (
    <header
      className={[
        'h-14 flex items-center justify-between px-4 gap-3',
        'bg-white dark:bg-slate-900',
        'border-b border-slate-200 dark:border-slate-700/60',
        'sticky top-0 z-30',
        className,
      ].join(' ')}
    >
      {/* Left — hamburger + logo */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          className={[
            'w-8 h-8 rounded-lg flex items-center justify-center',
            'text-slate-500 dark:text-slate-400',
            'hover:bg-slate-100 dark:hover:bg-slate-700/60',
            'transition-colors duration-150',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
          ].join(' ')}
        >
          {sidebarOpen ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          )}
        </button>

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shadow-sm">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003
                9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196
                0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <span className="hidden md:block text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Sentinel Tour
          </span>
        </div>
      </div>

      {/* Right — actions */}
      <div className="flex items-center gap-1.5">
        <ThemeSwitcher variant="icon" />
        <NotificationBell />
        <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />
        <UserMenu />
      </div>
    </header>
  );
}