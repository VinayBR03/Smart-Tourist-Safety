import { create } from 'zustand';
import { SecureStorage } from '@/utils/storage';
import { Config } from '@/constants/config';
import type { User } from '@/types/api';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  setUser: (user: User) => void;
  mergeUser: (data: Partial<User>) => void;
  setLoading: (v: boolean) => void;
  logout: () => Promise<void>;
  hydrate: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  setUser: (user) => set({ user, isAuthenticated: true }),

  mergeUser: (partial) =>
    set((s) => ({ user: s.user ? { ...s.user, ...partial } : s.user })),


  setLoading: (isLoading) => set({ isLoading }),

  logout: async () => {
    await SecureStorage.clear([
      Config.ACCESS_TOKEN_KEY,
      Config.REFRESH_TOKEN_KEY,
    ]);
    set({ user: null, isAuthenticated: false });
  },

  hydrate: async () => {
    try {
      const token = await SecureStorage.get(Config.ACCESS_TOKEN_KEY);
      if (!token) {
        set({ isLoading: false });
        return false;
      }
      // Auth is valid if token exists (will verify on first API call)
      set({ isLoading: false, isAuthenticated: true });
      return true;
    } catch {
      set({ isLoading: false });
      return false;
    }
  },
}));