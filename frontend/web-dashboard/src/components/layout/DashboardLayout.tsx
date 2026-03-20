// src/components/layout/DashboardLayout.tsx

import { useState, useEffect, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { STORAGE_KEYS } from '../../constants/storage';

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const MOBILE_BREAKPOINT  = 1024; // lg
const COLLAPSED_STORAGE_KEY = STORAGE_KEYS.THEME + '_sidebar_collapsed'; // reuse prefix

// ─────────────────────────────────────────────
// DashboardLayout
// ─────────────────────────────────────────────

export function DashboardLayout() {
  // ── Sidebar collapsed state (persisted) ──
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(COLLAPSED_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  // ── Mobile sidebar open state ──
  const [mobileOpen, setMobileOpen] = useState(false);

  // ── Persist collapsed ──
  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_STORAGE_KEY, String(collapsed));
    } catch {
      // ignore
    }
  }, [collapsed]);

  // ── Close mobile sidebar on resize to desktop ──
  useEffect(() => {
    const handler = () => {
      if (window.innerWidth >= MOBILE_BREAKPOINT) {
        setMobileOpen(false);
      }
    };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // ── Handlers ──
  const handleCollapse = useCallback(() => {
    if (window.innerWidth < MOBILE_BREAKPOINT) {
      // On mobile: toggle open/close, not collapsed
      setMobileOpen((v) => !v);
    } else {
      setCollapsed((v) => !v);
    }
  }, []);

  const handleMenuToggle = useCallback(() => {
    if (window.innerWidth < MOBILE_BREAKPOINT) {
      setMobileOpen((v) => !v);
    } else {
      setCollapsed((v) => !v);
    }
  }, []);

  const sidebarWidth = collapsed ? 60 : 240;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex">

      {/* Sidebar */}
      <Sidebar
        open={mobileOpen}
        collapsed={collapsed}
        onCollapse={handleCollapse}
      />

      {/* Main content — offset by sidebar width on desktop */}
      <div
        className="flex flex-col flex-1 min-w-0 transition-all duration-300"
        style={{
          marginLeft: window.innerWidth >= MOBILE_BREAKPOINT ? sidebarWidth : 0,
        }}
      >
        {/* Topbar */}
        <Navbar
          onMenuToggle={handleMenuToggle}
          sidebarOpen={mobileOpen || !collapsed}
        />

        {/* Page content */}
        <main className="flex-1 p-4 md:p-6 min-w-0 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}