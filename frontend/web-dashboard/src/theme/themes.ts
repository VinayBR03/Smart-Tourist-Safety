// src/theme/themes.ts

// ─────────────────────────────────────────────
// Theme Types
// ─────────────────────────────────────────────

export type ThemeMode = 'light' | 'dark';

export interface ColorScale {
  50:  string;
  100: string;
  200: string;
  300: string;
  400: string;
  500: string;
  600: string;
  700: string;
  800: string;
  900: string;
  950: string;
}

export interface ThemeColors {
  // Backgrounds
  bgPrimary:       string;
  bgSecondary:     string;
  bgTertiary:      string;
  bgCard:          string;
  bgCardHover:     string;
  bgSidebar:       string;
  bgNavbar:        string;
  bgOverlay:       string;
  bgInput:         string;
  bgInputFocus:    string;
  bgBadge:         string;
  bgModal:         string;

  // Borders
  borderPrimary:   string;
  borderSecondary: string;
  borderFocus:     string;
  borderCard:      string;

  // Text
  textPrimary:     string;
  textSecondary:   string;
  textTertiary:    string;
  textDisabled:    string;
  textInverse:     string;
  textLink:        string;
  textLinkHover:   string;

  // Brand (accent)
  brand:           string;
  brandHover:      string;
  brandLight:      string;
  brandDark:       string;
  brandMuted:      string;

  // Semantic — Success
  success:         string;
  successHover:    string;
  successBg:       string;
  successText:     string;
  successBorder:   string;

  // Semantic — Warning
  warning:         string;
  warningHover:    string;
  warningBg:       string;
  warningText:     string;
  warningBorder:   string;

  // Semantic — Danger
  danger:          string;
  dangerHover:     string;
  dangerBg:        string;
  dangerText:      string;
  dangerBorder:    string;

  // Semantic — Info
  info:            string;
  infoHover:       string;
  infoBg:          string;
  infoText:        string;
  infoBorder:      string;

  // Risk levels
  riskLow:         string;
  riskLowBg:       string;
  riskMedium:      string;
  riskMediumBg:    string;
  riskHigh:        string;
  riskHighBg:      string;

  // Shadows
  shadowSm:        string;
  shadowMd:        string;
  shadowLg:        string;
  shadowXl:        string;

  // Scrollbar
  scrollbarThumb:  string;
  scrollbarTrack:  string;
}

export interface Theme {
  mode:   ThemeMode;
  colors: ThemeColors;
}

// ─────────────────────────────────────────────
// Light Theme
// ─────────────────────────────────────────────

export const lightTheme: Theme = {
  mode: 'light',
  colors: {
    // Backgrounds
    bgPrimary:       '#f8fafc',
    bgSecondary:     '#f1f5f9',
    bgTertiary:      '#e2e8f0',
    bgCard:          '#ffffff',
    bgCardHover:     '#f8fafc',
    bgSidebar:       '#0f172a',
    bgNavbar:        '#ffffff',
    bgOverlay:       'rgba(15, 23, 42, 0.5)',
    bgInput:         '#ffffff',
    bgInputFocus:    '#f8fafc',
    bgBadge:         '#f1f5f9',
    bgModal:         '#ffffff',

    // Borders
    borderPrimary:   '#e2e8f0',
    borderSecondary: '#cbd5e1',
    borderFocus:     '#3b82f6',
    borderCard:      '#e2e8f0',

    // Text
    textPrimary:     '#0f172a',
    textSecondary:   '#475569',
    textTertiary:    '#94a3b8',
    textDisabled:    '#cbd5e1',
    textInverse:     '#ffffff',
    textLink:        '#3b82f6',
    textLinkHover:   '#2563eb',

    // Brand
    brand:           '#3b82f6',
    brandHover:      '#2563eb',
    brandLight:      '#eff6ff',
    brandDark:       '#1d4ed8',
    brandMuted:      '#bfdbfe',

    // Success
    success:         '#22c55e',
    successHover:    '#16a34a',
    successBg:       '#f0fdf4',
    successText:     '#15803d',
    successBorder:   '#bbf7d0',

    // Warning
    warning:         '#f97316',
    warningHover:    '#ea580c',
    warningBg:       '#fff7ed',
    warningText:     '#c2410c',
    warningBorder:   '#fed7aa',

    // Danger
    danger:          '#ef4444',
    dangerHover:     '#dc2626',
    dangerBg:        '#fef2f2',
    dangerText:      '#b91c1c',
    dangerBorder:    '#fecaca',

    // Info
    info:            '#06b6d4',
    infoHover:       '#0891b2',
    infoBg:          '#ecfeff',
    infoText:        '#0e7490',
    infoBorder:      '#a5f3fc',

    // Risk
    riskLow:         '#22c55e',
    riskLowBg:       '#f0fdf4',
    riskMedium:      '#f97316',
    riskMediumBg:    '#fff7ed',
    riskHigh:        '#ef4444',
    riskHighBg:      '#fef2f2',

    // Shadows
    shadowSm:        '0 1px 2px 0 rgba(0,0,0,0.05)',
    shadowMd:        '0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -1px rgba(0,0,0,0.04)',
    shadowLg:        '0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -2px rgba(0,0,0,0.04)',
    shadowXl:        '0 20px 25px -5px rgba(0,0,0,0.08), 0 10px 10px -5px rgba(0,0,0,0.03)',

    // Scrollbar
    scrollbarThumb:  '#cbd5e1',
    scrollbarTrack:  '#f1f5f9',
  },
};

// ─────────────────────────────────────────────
// Dark Theme
// ─────────────────────────────────────────────

export const darkTheme: Theme = {
  mode: 'dark',
  colors: {
    // Backgrounds
    bgPrimary:       '#0b0f1a',
    bgSecondary:     '#111827',
    bgTertiary:      '#1e2738',
    bgCard:          '#141b2d',
    bgCardHover:     '#1a2236',
    bgSidebar:       '#080d18',
    bgNavbar:        '#0d1424',
    bgOverlay:       'rgba(0, 0, 0, 0.75)',
    bgInput:         '#1e2738',
    bgInputFocus:    '#263045',
    bgBadge:         '#1e2738',
    bgModal:         '#141b2d',

    // Borders
    borderPrimary:   '#1e2d45',
    borderSecondary: '#263352',
    borderFocus:     '#3b82f6',
    borderCard:      '#1a2640',

    // Text
    textPrimary:     '#f1f5f9',
    textSecondary:   '#94a3b8',
    textTertiary:    '#64748b',
    textDisabled:    '#334155',
    textInverse:     '#0f172a',
    textLink:        '#60a5fa',
    textLinkHover:   '#93c5fd',

    // Brand
    brand:           '#3b82f6',
    brandHover:      '#60a5fa',
    brandLight:      '#1e3a5f',
    brandDark:       '#93c5fd',
    brandMuted:      '#1e3a5f',

    // Success
    success:         '#22c55e',
    successHover:    '#4ade80',
    successBg:       '#052e16',
    successText:     '#4ade80',
    successBorder:   '#14532d',

    // Warning
    warning:         '#f97316',
    warningHover:    '#fb923c',
    warningBg:       '#1c0a00',
    warningText:     '#fb923c',
    warningBorder:   '#431407',

    // Danger
    danger:          '#ef4444',
    dangerHover:     '#f87171',
    dangerBg:        '#1c0505',
    dangerText:      '#f87171',
    dangerBorder:    '#450a0a',

    // Info
    info:            '#06b6d4',
    infoHover:       '#22d3ee',
    infoBg:          '#021f2e',
    infoText:        '#22d3ee',
    infoBorder:      '#0c4a6e',

    // Risk
    riskLow:         '#22c55e',
    riskLowBg:       '#052e16',
    riskMedium:      '#f97316',
    riskMediumBg:    '#1c0a00',
    riskHigh:        '#ef4444',
    riskHighBg:      '#1c0505',

    // Shadows
    shadowSm:        '0 1px 2px 0 rgba(0,0,0,0.4)',
    shadowMd:        '0 4px 6px -1px rgba(0,0,0,0.5), 0 2px 4px -1px rgba(0,0,0,0.3)',
    shadowLg:        '0 10px 15px -3px rgba(0,0,0,0.6), 0 4px 6px -2px rgba(0,0,0,0.35)',
    shadowXl:        '0 20px 25px -5px rgba(0,0,0,0.65), 0 10px 10px -5px rgba(0,0,0,0.4)',

    // Scrollbar
    scrollbarThumb:  '#263352',
    scrollbarTrack:  '#111827',
  },
};

// ─────────────────────────────────────────────
// Theme map
// ─────────────────────────────────────────────

export const themes: Record<ThemeMode, Theme> = {
  light: lightTheme,
  dark:  darkTheme,
};