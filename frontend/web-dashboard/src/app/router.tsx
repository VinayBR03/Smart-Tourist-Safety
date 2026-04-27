// src/app/router.tsx

import { createBrowserRouter, Navigate } from 'react-router-dom';

// Guards (in their own file so react-refresh works correctly)
import { AuthGuard, PublicGuard } from './guards';

// Layouts
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { LoginLayout }     from '../components/layout/LoginLayout';

// Auth Pages
import { LoginPage }       from '../pages/auth/LoginPage';

// Dashboard Pages
import { DashboardPage }           from '../pages/dashboard/DashboardPage';
import { OperationsMapPage }       from '../pages/map/OperationsMapPage';
import { ZonesPage }               from '../pages/zones/ZonesPage';
import { IncidentListPage }        from '../pages/incidents/IncidentListPage';
import { IncidentDetailPage }      from '../pages/incidents/IncidentDetailPage';
import { DevicesPage }             from '../pages/devices/DevicesPage';
import { HealthMonitoringPage }    from '../pages/health/HealthMonitoringPage';
import { NotificationsPage }       from '../pages/notifications/NotificationsPage';
import { OperationsAnalyticsPage } from '../pages/analytics/OperationsAnalyticsPage';

// Admin Pages
import { UsersPage }           from '../pages/admin/UsersPage';
import { AuthoritiesPage }     from '../pages/admin/AuthoritiesPage';
import { SystemAnalyticsPage } from '../pages/admin/SystemAnalyticsPage';

// Settings Pages
import { SettingsPage } from '../pages/settings/SettingsPage';

import { UserRole } from '../types/enums';

/* =========================================================
   ROUTER CONFIG
   ========================================================= */

export const router = createBrowserRouter([
  // ── Public Routes ──────────────────────────────────────
  {
    path: '/login',
    element: (
      <PublicGuard>
        <LoginLayout>
          <LoginPage />
        </LoginLayout>
      </PublicGuard>
    ),
  },

  // ── Protected Dashboard Routes ─────────────────────────
  {
    path: '/',
    element: (
      <AuthGuard>
        <DashboardLayout />
      </AuthGuard>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />,
      },
      { path: 'dashboard',  element: <DashboardPage /> },
      { path: 'map',        element: <OperationsMapPage /> },
      { path: 'zones',      element: <ZonesPage /> },
      { path: 'incidents',  element: <IncidentListPage /> },
      { path: 'incidents/:incidentId', element: <IncidentDetailPage /> },
      { path: 'devices',    element: <DevicesPage /> },
      { path: 'health',     element: <HealthMonitoringPage /> },
      { path: 'notifications', element: <NotificationsPage /> },
      { path: 'settings',   element: <SettingsPage /> },
      { path: 'analytics',  element: <OperationsAnalyticsPage /> },

      // ── Admin Only ──
      {
        path: 'admin/users',
        element: (
          <AuthGuard roles={[UserRole.ADMIN]}>
            <UsersPage />
          </AuthGuard>
        ),
      },
      {
        path: 'admin/authorities',
        element: (
          <AuthGuard roles={[UserRole.ADMIN]}>
            <AuthoritiesPage />
          </AuthGuard>
        ),
      },
      {
        path: 'admin/system',
        element: (
          <AuthGuard roles={[UserRole.ADMIN]}>
            <SystemAnalyticsPage />
          </AuthGuard>
        ),
      },
    ],
  },

  // ── Fallback ───────────────────────────────────────────
  { path: '*', element: <Navigate to="/dashboard" replace /> },
]);