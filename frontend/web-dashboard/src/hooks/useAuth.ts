// src/hooks/useAuth.ts

import {
  useState,
  useCallback,
  useEffect,
  useRef,
} from 'react';

import { login as apiLogin, logout as apiLogout, getMe, refreshToken as apiRefreshToken } from '../api/authApi';
import { apiClient } from '../api/apiClient';
import { STORAGE_KEYS } from '../constants/storage';
import { TOKEN_REFRESH_INTERVAL_MS } from '../constants/config';
import { websocketService } from '../services/websocketService';
import type { User, LoginRequest, AuthState } from '../types/user';
import { UserRole } from '../types/enums';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function loadFromStorage(): Pick<AuthState, 'user' | 'accessToken' | 'refreshToken'> {
  try {
    const accessToken  = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
    const userRaw      = localStorage.getItem(STORAGE_KEYS.USER);
    const user         = userRaw ? (JSON.parse(userRaw) as User) : null;
    return { user, accessToken, refreshToken };
  } catch {
    return { user: null, accessToken: null, refreshToken: null };
  }
}

function saveToStorage(user: User, accessToken: string, refreshToken: string): void {
  localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN,  accessToken);
  localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
  localStorage.setItem(STORAGE_KEYS.USER,          JSON.stringify(user));
}

function clearStorage(): void {
  localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.USER);
}

// ─────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────

export function useAuth() {
  const stored = loadFromStorage();

  const [state, setState] = useState<AuthState>({
    user:            stored.user,
    accessToken:     stored.accessToken,
    refreshToken:    stored.refreshToken,
    isAuthenticated: !!stored.accessToken && !!stored.user,
    isLoading:       false,
  });

  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ───────────────────────────────────────────
  // Connect WebSocket after auth
  // ───────────────────────────────────────────

  const connectWebSockets = useCallback((user: User) => {
    websocketService.connect('notifications');
    if (
      user.role === UserRole.ADMIN ||
      user.role === UserRole.AUTHORITY
    ) {
      websocketService.connect('authority/live');
    }
  }, []);

  // ───────────────────────────────────────────
  // Validate stored session on mount
  // ───────────────────────────────────────────

  useEffect(() => {
    if (!stored.accessToken || !stored.user) return;

    let cancelled = false;

    getMe()
      .then((user) => {
        if (cancelled) return;
        saveToStorage(user, stored.accessToken!, stored.refreshToken!);
        setState((prev) => ({ ...prev, user, isAuthenticated: true }));
        connectWebSockets(user);
      })
      .catch(() => {
        if (cancelled) return;
        clearStorage();
        setState({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
        });
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ───────────────────────────────────────────
  // Proactive token refresh timer
  // ───────────────────────────────────────────

  useEffect(() => {
    if (!state.isAuthenticated) {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      return;
    }

    refreshTimerRef.current = setInterval(async () => {
      try {
        const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
        if (!refreshToken) return;

        const tokens = await apiRefreshToken(refreshToken);   // ← direct call, no dynamic import
        apiClient.setTokens(tokens.access_token, tokens.refresh_token);

        setState((prev) => ({
          ...prev,
          accessToken:  tokens.access_token,
          refreshToken: tokens.refresh_token,
      }));
      } catch {
        // The apiClient handles full session expiry + redirect
      }
    }, TOKEN_REFRESH_INTERVAL_MS);

    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [state.isAuthenticated]);

  // ───────────────────────────────────────────
  // Login
  // ───────────────────────────────────────────

  const login = useCallback(async (credentials: LoginRequest): Promise<void> => {
    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      const tokens = await apiLogin(credentials);
      apiClient.setTokens(tokens.access_token, tokens.refresh_token);

      const user = await getMe();
      saveToStorage(user, tokens.access_token, tokens.refresh_token);

      setState({
        user,
        accessToken:     tokens.access_token,
        refreshToken:    tokens.refresh_token,
        isAuthenticated: true,
        isLoading:       false,
      });

      connectWebSockets(user);
    } catch (err) {
      setState((prev) => ({ ...prev, isLoading: false }));
      throw err;
    }
  }, [connectWebSockets]);

  // ───────────────────────────────────────────
  // Logout
  // ───────────────────────────────────────────

  const logout = useCallback(async (): Promise<void> => {
    const refreshToken = state.refreshToken;

    websocketService.disconnectAll();

    if (refreshToken) {
      try {
        await apiLogout(refreshToken);
      } catch {
        // Ignore — clear locally regardless
      }
    }

    clearStorage();
    apiClient.clearTokens();

    setState({
      user:            null,
      accessToken:     null,
      refreshToken:    null,
      isAuthenticated: false,
      isLoading:       false,
    });
  }, [state.refreshToken]);

  // ───────────────────────────────────────────
  // Role helpers
  // ───────────────────────────────────────────

  const isAdmin     = state.user?.role === UserRole.ADMIN;
  const isAuthority = state.user?.role === UserRole.AUTHORITY;
  const isTourist   = state.user?.role === UserRole.TOURIST;

  const hasRole = useCallback(
    (...roles: UserRole[]): boolean =>
      !!state.user && roles.includes(state.user.role),
    [state.user]
  );

  return {
    ...state,
    login,
    logout,
    isAdmin,
    isAuthority,
    isTourist,
    hasRole,
  };
}