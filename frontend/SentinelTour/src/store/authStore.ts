// src/store/authStore.ts
import { create } from 'zustand';
import { SecureStorage } from '@/utils/storage';
import { Config } from '@/constants/config';
import { locationService } from '@/services/locationService';
import { wsClient } from '@/utils/websocket';
import { queryClient } from '@/utils/queryClientSingleton';
import type { User } from '@/types/api';

// ─── Global abort flag ────────────────────────────────────
// Set to true the instant logout begins. The axios request interceptor
// checks this synchronously and silently aborts any new request.
// This prevents the 401 flood between "tokens cleared" and "tabs unmounted".
export let isLoggingOut = false;

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser:    (user: User)          => void;
  mergeUser:  (data: Partial<User>) => void;
  setLoading: (v: boolean)          => void;
  logout:     ()                    => Promise<void>;
  hydrate:    ()                    => Promise<boolean>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null, isAuthenticated: false, isLoading: true,

  setUser: (user) => set({ user, isAuthenticated: true }),

  mergeUser: (partial) =>
    set((s) => ({ user: s.user ? { ...s.user, ...partial } : s.user })),

  setLoading: (isLoading) => set({ isLoading }),

  logout: async () => {
    isLoggingOut = true;

    try { locationService.stopTracking(); } catch { /* ignore */ }
    try { wsClient.disconnect(); }          catch { /* ignore */ }

    try {
      await queryClient.cancelQueries();
      queryClient.clear();
    } catch { /* ignore */ }

    await SecureStorage.clear([
      Config.ACCESS_TOKEN_KEY,
      Config.REFRESH_TOKEN_KEY,
    ]);

    set({ user: null, isAuthenticated: false });

    setTimeout(() => { isLoggingOut = false; }, 500);
  },

  hydrate: async () => {
    try {
      const token = await SecureStorage.get(Config.ACCESS_TOKEN_KEY);
      if (!token) { set({ isLoading: false }); return false; }
      set({ isLoading: false, isAuthenticated: true });
      return true;
    } catch {
      set({ isLoading: false });
      return false;
    }
  },
}));