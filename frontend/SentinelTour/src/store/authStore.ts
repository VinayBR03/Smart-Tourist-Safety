// src/store/authStore.ts
import { create } from 'zustand';
import { SecureStorage } from '@/utils/storage';
import { Config } from '@/constants/config';
import { logoutFlag } from '@/api/logoutFlag';
import { wsClient } from '@/utils/websocket';
import { queryClient } from '@/utils/queryClientSingleton';
import type { User } from '@/types/api';

// ─── Global abort flag ────────────────────────────────────
// Owned by logoutFlag.ts — imported here as a leaf with no further deps.
// Re-exported so any file that imported `isLoggingOut` from authStore still
// compiles unchanged.
export { logoutFlag as isLoggingOut };

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
    logoutFlag.set(true);

    // Lazy import breaks the module-level cycle:
    //   authStore → locationService → location → client → authStore
    try {
      const { locationService } = await import('@/services/locationService');
      locationService.stopTracking();
    } catch { /* ignore */ }
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

    setTimeout(() => { logoutFlag.set(false); }, 500);
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