import React, { createContext, useContext } from 'react';
import { useThemeStore } from '@/store/themeStore';
import { DarkColors, LightColors } from '@/constants/theme';

export type ColorPalette = typeof DarkColors;

// Context holds the resolved color palette — not the theme string
const ThemeContext = createContext<ColorPalette>(DarkColors);

// Place this once in app/_layout.tsx — single Zustand subscription
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useThemeStore();
  const colors    = theme === 'dark' ? DarkColors : LightColors;

  return (
    <ThemeContext.Provider value={colors}>
      {children}
    </ThemeContext.Provider>
  );
}

// All components call this instead of useThemeStore
// useContext never causes hook-order issues between siblings
export function useColors(): ColorPalette {
  return useContext(ThemeContext);
}