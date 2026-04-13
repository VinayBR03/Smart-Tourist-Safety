import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

export type AppTheme = 'dark' | 'light';

const THEME_KEY = 'sentinel_app_theme';

// Synchronous read on first load — SecureStore.getItem is sync in newer Expo
function loadThemeSync(): AppTheme {
  try {
    // expo-secure-store does not have a sync API on all platforms.
    // We default to dark and let the async loader correct it on mount.
    return 'dark';
  } catch {
    return 'dark';
  }
}

async function saveTheme(theme: AppTheme): Promise<void> {
  try {
    await SecureStore.setItemAsync(THEME_KEY, theme);
  } catch { /* silent — theme just won't persist this session */ }
}

async function loadTheme(): Promise<AppTheme> {
  try {
    const stored = await SecureStore.getItemAsync(THEME_KEY);
    return stored === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

interface ThemeState {
  theme:      AppTheme;
  toggle:     () => void;
  setTheme:   (t: AppTheme) => void;
  hydrate:    () => Promise<void>;  // call once in _layout.tsx
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: 'dark', // safe default until hydrate() runs

  toggle: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    set({ theme: next });
    saveTheme(next); // fire-and-forget
  },

  setTheme: (theme) => {
    set({ theme });
    saveTheme(theme);
  },

  hydrate: async () => {
    const saved = await loadTheme();
    set({ theme: saved });
  },
}));