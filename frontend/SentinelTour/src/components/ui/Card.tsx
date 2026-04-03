import { View, StyleSheet, ViewStyle } from 'react-native';
import { useColors } from '@/context/ThemeContext';
import { Radius, Spacing } from '@/constants/theme';

interface CardProps {
  children:    React.ReactNode;
  style?:      ViewStyle;
  elevated?:   boolean;
  accent?:     boolean;
  accentColor?: string;
  padding?:    number;
}

export function Card({
  children,
  style,
  elevated  = false,
  accent    = false,
  accentColor,
  padding   = Spacing.base,
}: CardProps) {
  const C = useColors(); // context — no Zustand call

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: C.surface,
          borderColor:      C.border,
          padding,
          borderLeftWidth:  accent ? 3 : 1,
          borderLeftColor:  accent ? (accentColor ?? C.primary) : C.border,
        },
        elevated && {
          backgroundColor: C.surfaceAlt,
          shadowColor:     '#000',
          shadowOffset:    { width: 0, height: 4 },
          shadowOpacity:   0.35,
          shadowRadius:    12,
          elevation:       8,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.xl,
    borderWidth:  1,
    overflow:     'hidden',
  },
});