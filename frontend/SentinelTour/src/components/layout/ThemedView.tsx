import { View, ViewStyle } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

interface ThemedViewProps {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
}

export function ThemedView({ children, style }: ThemedViewProps) {
  const { C } = useTheme();
  return (
    <View style={[{ flex: 1, backgroundColor: C.background }, style]}>
      {children}
    </View>
  );
}