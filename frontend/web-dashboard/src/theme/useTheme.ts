// src/theme/useTheme.ts

import { useContext } from 'react';
import { ThemeContext } from './ThemeProvider';
import type { ThemeContextValue } from './ThemeProvider';

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