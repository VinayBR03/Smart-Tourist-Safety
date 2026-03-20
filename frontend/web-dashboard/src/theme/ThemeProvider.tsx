// src/theme/ThemeProvider.tsx

import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { STORAGE_KEYS } from '../constants/storage';
import { themes } from './themes';
import type { Theme, ThemeMode } from './themes';

// ─────────────────────────────────────────────
// Context type
// ─────────────────────────────────────────────

export interface ThemeContextValue {
  theme:      Theme;
  mode:       ThemeMode;
  isDark:     boolean;
  toggleTheme: () => void;
  setTheme:   (mode: ThemeMode) => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function getInitialMode(): ThemeMode {
  // 1. Persisted preference
  const stored = localStorage.getItem(STORAGE_KEYS.THEME) as ThemeMode | null;
  if (stored === 'light' || stored === 'dark') return stored;

  // 2. OS preference
  if (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  ) {
    return 'dark';
  }

  return 'dark'; // default for dashboard
}

function applyThemeToDocument(mode: ThemeMode): void {
  const root = document.documentElement;
  root.setAttribute('data-theme', mode);

  // Tailwind dark class support
  if (mode === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

// ─────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [mode, setMode] = useState<ThemeMode>(getInitialMode);

  // Apply to DOM on mount + every change
  useEffect(() => {
    applyThemeToDocument(mode);
    localStorage.setItem(STORAGE_KEYS.THEME, mode);
  }, [mode]);

  // Listen for OS preference changes
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e: MediaQueryListEvent) => {
      // Only follow OS if user hasn't explicitly set a preference
      const stored = localStorage.getItem(STORAGE_KEYS.THEME);
      if (!stored) {
        setMode(e.matches ? 'dark' : 'light');
      }
    };

    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, []);

  const toggleTheme = useCallback(() => {
    setMode((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const handleSetTheme = useCallback((newMode: ThemeMode) => {
    setMode(newMode);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme:       themes[mode],
      mode,
      isDark:      mode === 'dark',
      toggleTheme,
      setTheme:    handleSetTheme,
    }),
    [mode, toggleTheme, handleSetTheme]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}