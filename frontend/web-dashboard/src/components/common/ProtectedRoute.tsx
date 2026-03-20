// src/components/common/ProtectedRoute.tsx

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { UserRole } from '../../types/enums';
import { Loader } from './Loader';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface ProtectedRouteProps {
  children:      React.ReactNode;
  roles?:        UserRole[];
  redirectTo?:   string;
  fallback?:     React.ReactNode;
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export function ProtectedRoute({
  children,
  roles,
  redirectTo = '/login',
  fallback,
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  // ── Loading state ──
  if (isLoading) {
    return (
      fallback ?? (
        <div className="min-h-screen flex items-center justify-center bg-slate-950">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99
                  0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751
                  h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <Loader size="sm" label="Authenticating..." />
          </div>
        </div>
      )
    );
  }

  // ── Not authenticated ──
  if (!isAuthenticated || !user) {
    return (
      <Navigate
        to={redirectTo}
        state={{ from: location.pathname }}
        replace
      />
    );
  }

  // ── Role check ──
  if (roles && roles.length > 0 && !roles.includes(user.role)) {
    return <UnauthorizedPage />;
  }

  return <>{children}</>;
}

// ─────────────────────────────────────────────
// Unauthorized page
// ─────────────────────────────────────────────

function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-6">
          <svg
            className="w-8 h-8 text-red-600 dark:text-red-400"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
          >
            <path
              strokeLinecap="round" strokeLinejoin="round"
              d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75
              a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-3">
          Access Denied
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mb-8">
          You don't have permission to access this page.
          Contact your administrator if you believe this is an error.
        </p>

        <button
          onClick={() => window.history.back()}
          className={[
            'inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium',
            'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900',
            'hover:bg-slate-700 dark:hover:bg-slate-300 transition-colors',
          ].join(' ')}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Go back
        </button>
      </div>
    </div>
  );
}