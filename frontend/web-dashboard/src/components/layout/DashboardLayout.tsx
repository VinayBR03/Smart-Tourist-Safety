// src/components/layout/DashboardLayout.tsx

import { useState, useEffect, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { STORAGE_KEYS } from '../../constants/storage';
import { useNotificationWS } from '../../hooks/useWebSocket';
import { useNotifications } from '../../hooks/useNotifications';

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const MOBILE_BREAKPOINT     = 1024; // lg
const COLLAPSED_STORAGE_KEY = STORAGE_KEYS.THEME + '_sidebar_collapsed';

// ─────────────────────────────────────────────
// DashboardLayout
// ─────────────────────────────────────────────

export function DashboardLayout() {
  // ── All state declared first so handlers below can safely reference setters ──

  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  // ── Mobile sidebar open state ──
  const [mobileOpen, setMobileOpen] = useState(false);

  // ── Sidebar collapsed state (persisted, desktop only) ──
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(COLLAPSED_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const isDesktop = windowWidth >= MOBILE_BREAKPOINT;

  // ── Resize handler — updates width and auto-closes mobile drawer ──
  // setMobileOpen is called from an external event callback (not the effect body),
  // so it does not violate react-hooks/set-state-in-effect.
  useEffect(() => {
    const handler = () => {
      setWindowWidth(window.innerWidth);
      if (window.innerWidth >= MOBILE_BREAKPOINT) {
        setMobileOpen(false);
      }
    };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // ── Persist collapsed ──
  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_STORAGE_KEY, String(collapsed));
    } catch {
      // ignore
    }
  }, [collapsed]);

  // ── Notification WebSocket: plays alert sound on new notifications ──
  const { refetch: refetchNotifications } = useNotifications();

  useNotificationWS(
    useCallback(() => {
      // Sound is already played inside useNotificationWS
      // Refresh unread count / notification list
      refetchNotifications();
    }, [refetchNotifications])
  );

  // ── Handlers ──
  const handleMenuToggle = useCallback(() => {
    if (!isDesktop) {
      setMobileOpen((v) => !v);
    } else {
      setCollapsed((v) => !v);
    }
  }, [isDesktop]);

  const handleOverlayClick = useCallback(() => {
    setMobileOpen(false);
  }, []);

  const sidebarWidth = collapsed ? 60 : 240;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex">

      {/* Sidebar */}
      <Sidebar
        open={mobileOpen}
        collapsed={collapsed}
        onCollapse={handleMenuToggle}
        onOverlayClick={handleOverlayClick}
      />

      {/* Main content — offset by sidebar width on desktop */}
      <div
        className="flex flex-col flex-1 min-w-0 transition-all duration-300"
        style={{ marginLeft: isDesktop ? sidebarWidth : 0 }}
      >
        {/* Topbar */}
        <Navbar
          onMenuToggle={handleMenuToggle}
          mobileOpen={mobileOpen}
          isDesktop={isDesktop}
          collapsed={collapsed}
        />

        {/* Page content */}
        <main className="flex-1 p-4 md:p-6 min-w-0 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}