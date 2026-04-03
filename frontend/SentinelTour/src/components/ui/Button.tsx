import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Colors, Typography, Spacing, Radius } from '@/constants/theme';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  icon?: string;
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
}

const VARIANT_STYLES: Record<Variant, { bg: string; text: string; border: string }> = {
  primary:   { bg: Colors.primary,     text: '#fff',              border: Colors.primary     },
  secondary: { bg: Colors.surfaceAlt,  text: Colors.textPrimary,  border: Colors.border      },
  danger:    { bg: Colors.error,       text: '#fff',              border: Colors.error       },
  ghost:     { bg: 'transparent',      text: Colors.primary,      border: 'transparent'      },
  outline:   { bg: 'transparent',      text: Colors.textPrimary,  border: Colors.border      },
};

const SIZE_STYLES: Record<Size, { height: number; px: number; font: number }> = {
  sm: { height: 36, px: Spacing.md,   font: Typography.sm   },
  md: { height: 48, px: Spacing.base, font: Typography.base },
  lg: { height: 56, px: Spacing.xl,   font: Typography.md   },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  style,
  textStyle,
  fullWidth = true,
}: ButtonProps) {
  const v = VARIANT_STYLES[variant];
  const s = SIZE_STYLES[size];

  return (
    <TouchableOpacity
      style={[
        styles.base,
        {
          backgroundColor: v.bg,
          borderColor: v.border,
          height: s.height,
          paddingHorizontal: s.px,
        },
        fullWidth && { width: '100%' },
        (disabled || loading) && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.82}
    >
      {loading ? (
        <ActivityIndicator color={v.text} size="small" />
      ) : (
        <>
          {icon && <Text style={{ fontSize: s.font }}>{icon}</Text>}
          <Text style={[styles.text, { color: v.text, fontSize: s.font }, textStyle]}>
            {label}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    gap: Spacing.sm,
  },
  text: { fontFamily: 'SpaceGrotesk_600SemiBold', letterSpacing: 0.4 },
  disabled: { opacity: 0.5 },
});