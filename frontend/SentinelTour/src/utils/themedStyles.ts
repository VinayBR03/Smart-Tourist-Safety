import { useColors } from '@/context/ThemeContext';

export function useThemedStyles() {
  const C = useColors();

  return {
    // ── Backgrounds ──────────────────────────────────────
    bg:         { backgroundColor: C.background } as const,
    surface:    { backgroundColor: C.surface    } as const,
    surfaceAlt: { backgroundColor: C.surfaceAlt } as const,

    // ── Borders ───────────────────────────────────────────
    border:        { borderColor: C.border   } as const,
    borderPrimary: { borderColor: C.primary  } as const,
    borderError:   { borderColor: C.error    } as const,

    // ── Text ──────────────────────────────────────────────
    textPrimary:   { color: C.textPrimary   } as const,
    textSecondary: { color: C.textSecondary } as const,
    textMuted:     { color: C.textMuted     } as const,
    textError:     { color: C.error         } as const,
    textSuccess:   { color: C.success       } as const,
    textPrimColor: { color: C.primary       } as const,

    // ── Combined shortcuts ────────────────────────────────
    cardBase: {
      backgroundColor: C.surface,
      borderColor:      C.border,
    } as const,
    inputBase: {
      backgroundColor: C.surfaceAlt,
      borderColor:      C.border,
      color:            C.textPrimary,
    } as const,
    labelText: {
      color: C.textSecondary,
    } as const,
    subtitleText: {
      color: C.textMuted,
    } as const,

    // ── Raw palette (for inline logic) ───────────────────
    C,
  };
}