import { Platform } from 'react-native';
import { useThemeStore } from '@/store/themeStore';

// ─── Dark palette (default) ───────────────────────────────
export const DarkColors = {
  primary:      '#3B82F6',
  primaryDark:  '#1D4ED8',
  primaryLight: '#EFF6FF',
  accent:       '#06B6D4',

  riskLow:    '#10B981',
  riskMedium: '#F59E0B',
  riskHigh:   '#EF4444',

  background:  '#0A0F1E',
  surface:     '#111827',
  surfaceAlt:  '#1F2937',
  border:      '#374151',
  borderLight: '#4B5563',

  textPrimary:   '#F9FAFB',
  textSecondary: '#9CA3AF',
  textMuted:     '#6B7280',
  textInverse:   '#111827',

  success: '#10B981',
  warning: '#F59E0B',
  error:   '#EF4444',
  info:    '#3B82F6',

  heartRate:    '#EF4444',
  spo2:         '#3B82F6',
  temperature:  '#F59E0B',

  sos:     '#DC2626',
  sosLight:'#FEE2E2',

  overlay:      'rgba(0,0,0,0.6)',
  overlayLight: 'rgba(0,0,0,0.3)',

  mapZoneLow:        'rgba(16,185,129,0.2)',
  mapZoneMedium:     'rgba(245,158,11,0.2)',
  mapZoneHigh:       'rgba(239,68,68,0.2)',
  mapZoneLowBorder:    '#10B981',
  mapZoneMediumBorder: '#F59E0B',
  mapZoneHighBorder:   '#EF4444',
};

// ─── Light palette ────────────────────────────────────────
export const LightColors = {
  primary:      '#2563EB',
  primaryDark:  '#1D4ED8',
  primaryLight: '#EFF6FF',
  accent:       '#0891B2',

  riskLow:    '#059669',
  riskMedium: '#D97706',
  riskHigh:   '#DC2626',

  background:  '#F8FAFC',
  surface:     '#FFFFFF',
  surfaceAlt:  '#F1F5F9',
  border:      '#E2E8F0',
  borderLight: '#CBD5E1',

  textPrimary:   '#0F172A',
  textSecondary: '#475569',
  textMuted:     '#94A3B8',
  textInverse:   '#FFFFFF',

  success: '#059669',
  warning: '#D97706',
  error:   '#DC2626',
  info:    '#2563EB',

  heartRate:   '#DC2626',
  spo2:        '#2563EB',
  temperature: '#D97706',

  sos:      '#DC2626',
  sosLight: '#FEE2E2',

  overlay:      'rgba(0,0,0,0.4)',
  overlayLight: 'rgba(0,0,0,0.15)',

  mapZoneLow:          'rgba(5,150,105,0.15)',
  mapZoneMedium:       'rgba(217,119,6,0.15)',
  mapZoneHigh:         'rgba(220,38,38,0.15)',
  mapZoneLowBorder:    '#059669',
  mapZoneMediumBorder: '#D97706',
  mapZoneHighBorder:   '#DC2626',
};

// ─── Dynamic getter — call this in components ─────────────
export function getColors() {
  const theme = useThemeStore.getState().theme;
  return theme === 'dark' ? DarkColors : LightColors;
}

// ─── Static export for StyleSheet (uses dark as base) ────
// Components that need reactive theming should call getColors()
export const Colors = DarkColors;

export const Typography = {
  fontDisplay:  'SpaceGrotesk_700Bold',
  fontSemiBold: 'SpaceGrotesk_600SemiBold',
  fontMedium:   'Inter_500Medium',
  fontRegular:  'Inter_400Regular',
  fontMono: Platform.select({ ios: 'Menlo', android: 'monospace' }),

  xs:   11,
  sm:   13,
  base: 15,
  md:   16,
  lg:   18,
  xl:   20,
  '2xl': 24,
  '3xl': 28,
  '4xl': 34,
  '5xl': 42,
};

export const Spacing = {
  xs:   4,
  sm:   8,
  md:   12,
  base: 16,
  lg:   20,
  xl:   24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
  '5xl': 64,
};

export const Radius = {
  sm:   6,
  md:   10,
  lg:   14,
  xl:   18,
  '2xl': 24,
  full: 9999,
};