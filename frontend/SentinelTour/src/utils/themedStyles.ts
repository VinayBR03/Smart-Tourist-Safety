import { useColors } from '@/context/ThemeContext';

export function useThemedStyles() {
  const C = useColors(); // context, not Zustand hook directly

  return {
    bg:              { backgroundColor: C.background } as const,
    surface:         { backgroundColor: C.surface    } as const,
    surfaceAlt:      { backgroundColor: C.surfaceAlt } as const,
    border:          { borderColor:     C.border      } as const,
    borderPrimary:   { borderColor:     C.primary     } as const,
    textPrimary:     { color:           C.textPrimary   } as const,
    textSecondary:   { color:           C.textSecondary } as const,
    textMuted:       { color:           C.textMuted     } as const,
  };
}