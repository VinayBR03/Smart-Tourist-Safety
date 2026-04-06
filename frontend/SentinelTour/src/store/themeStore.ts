import { create } from 'zustand';
import { createMMKV } from 'react-native-mmkv';

export type AppTheme = 'dark' | 'light';

// Persist theme to MMKV so it survives app kills
const storage = createMMKV({ id: 'sentinel-theme' });
const THEME_KEY = 'app_theme';

function loadTheme(): AppTheme {
  try {
    const stored = storage.getString(THEME_KEY);
    return stored === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

function saveTheme(theme: AppTheme): void {
  try {
    storage.set(THEME_KEY, theme);
  } catch { /* silent */ }
}

interface ThemeState {
  theme:    AppTheme;
  toggle:   () => void;
  setTheme: (t: AppTheme) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: loadTheme(), // ← reads from MMKV on first call

  toggle: () =>
    set((s) => {
      const next = s.theme === 'dark' ? 'light' : 'dark';
      saveTheme(next);
      return { theme: next };
    }),

  setTheme: (theme) => {
    saveTheme(theme);
    set({ theme });
  },
}));