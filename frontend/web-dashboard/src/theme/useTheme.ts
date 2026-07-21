// src/theme/useTheme.ts

import { createContext, useContext } from 'react';
import type { Theme, ThemeMode } from './themes';

// ─────────────────────────────────────────────
// Context Setup
// ─────────────────────────────────────────────

export interface ThemeContextValue {
  theme:       Theme;
  mode:        ThemeMode;
  isDark:      boolean;
  toggleTheme: () => void;
  setTheme:    (mode: ThemeMode) => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

// ─────────────────────────────────────────────
// Primary hook
// ─────────────────────────────────────────────

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error(
      'useTheme must be used within a <ThemeProvider>. ' +
        'Wrap your app root with <ThemeProvider>.'
    );
  }

  return context;
}

// ─────────────────────────────────────────────
// Convenience hooks
// ─────────────────────────────────────────────

export function useIsDark(): boolean {
  return useTheme().isDark;
}

export function useThemeColors() {
  return useTheme().theme.colors;
}

export function useThemeMode() {
  const { mode, toggleTheme, setTheme } = useTheme();
  return { mode, toggleTheme, setTheme };
}
