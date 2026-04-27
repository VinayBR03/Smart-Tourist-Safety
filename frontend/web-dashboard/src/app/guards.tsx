// src/app/guards.tsx
// Route guard components in their own file so react-refresh fast reload works.

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth }  from '../hooks/useAuth';
import { UserRole } from '../types/enums';
import { Loader }   from '../components/common/Loader';

// ─────────────────────────────────────────────
// AuthGuard
// ─────────────────────────────────────────────

/**
 * Protects routes that require authentication.
 * Blocks tourist accounts — redirects them back to login.
 * Optionally enforces specific admin roles.
 */
export function AuthGuard({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles?: UserRole[];
}) {
  const { user, isLoading, logout } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <Loader fullPage label="Verifying session..." />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  // Block tourist accounts from the dashboard entirely
  if (user.role === UserRole.TOURIST) {
    logout();
    return (
      <Navigate
        to="/login"
        state={{
          from: location.pathname,
          error:
            'Tourist accounts cannot access the Operations Dashboard. ' +
            'Please use the SentinelTour mobile app.',
        }}
        replace
      />
    );
  }

  // Admin-only route guard
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

// ─────────────────────────────────────────────
// PublicGuard
// ─────────────────────────────────────────────

/**
 * Redirects already-authenticated non-tourist users away from login.
 */
export function PublicGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <Loader fullPage />;
  }

  if (user && user.role !== UserRole.TOURIST) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}