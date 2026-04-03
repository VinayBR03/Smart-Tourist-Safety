import { create } from 'zustand';

export type AppTheme = 'dark' | 'light';

interface ThemeState {
  theme: AppTheme;
  toggle: () => void;
  setTheme: (t: AppTheme) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: 'dark',
  toggle: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
  setTheme: (theme) => set({ theme }),
}));