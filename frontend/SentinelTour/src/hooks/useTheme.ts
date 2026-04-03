import { useColors } from '@/context/ThemeContext';
import { useThemeStore } from '@/store/themeStore';

export function useTheme() {
  const C                   = useColors();           // from context — stable
  const { theme, toggle, setTheme } = useThemeStore(); // only for toggle action

  return { C, theme, toggle, setTheme };
}