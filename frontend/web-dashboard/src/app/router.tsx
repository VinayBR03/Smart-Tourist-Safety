// c:\Users\Vinay B R\Desktop\Smart Tourist Safety System\frontend\web-dashboard\src\app\router.tsx

import React from 'react';
import { createBrowserRouter, Navigate, useLocation } from 'react-router-dom';

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

// Components & Hooks
import { Loader }   from '../components/common/Loader';
import { useAuth }  from '../hooks/useAuth';
import { UserRole } from '../types/enums';

/* =========================================================
   GUARDS
   ========================================================= */

/**
 * Protects routes that require authentication.
 * Optionally checks for specific roles.
 */
function AuthGuard({ 
  children, 
  roles 
}: { 
  children: React.ReactNode; 
  roles?: UserRole[] 
}) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <Loader fullPage label="Verifying session..." />;
  }

  if (!user) {
    // Redirect to login, remembering the location they tried to access
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (roles && !roles.includes(user.role)) {
    // User is logged in but doesn't have permission
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

/**
 * Redirects authenticated users away from public-only routes (like login).
 */
function PublicGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <Loader fullPage />;
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

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
      {
        path: 'dashboard',
        element: <DashboardPage />,
      },
      {
        path: 'map',
        element: <OperationsMapPage />,
      },
      {
        path: 'zones',
        element: <ZonesPage />,
      },
      {
        path: 'incidents',
        element: <IncidentListPage />,
      },
      {
        path: 'incidents/:incidentId',
        element: <IncidentDetailPage />,
      },
      {
        path: 'devices',
        element: <DevicesPage />,
      },
      {
        path: 'health',
        element: <HealthMonitoringPage />,
      },
      {
        path: 'notifications',
        element: <NotificationsPage />,
      },
      {
        path: 'settings',
        element: <SettingsPage />,
      },
      {
        path: 'analytics',
        element: <OperationsAnalyticsPage />,
      },

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
  {
    path: '*',
    element: <Navigate to="/dashboard" replace />,
  },
]);
