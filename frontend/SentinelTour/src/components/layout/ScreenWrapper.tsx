import { ReactNode } from 'react';
import {
  View,
  ScrollView,
  RefreshControl,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing } from '@/constants/theme';

interface ScreenWrapperProps {
  children: ReactNode;
  scrollable?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  padHorizontal?: boolean;
}

export function ScreenWrapper({
  children,
  scrollable = true,
  refreshing = false,
  onRefresh,
  style,
  contentStyle,
  padHorizontal = true,
}: ScreenWrapperProps) {
  const content = (
    <View style={[padHorizontal && styles.pad, contentStyle]}>{children}</View>
  );

  return (
    <SafeAreaView style={[styles.safe, style]} edges={['top']}>
      {scrollable ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={Colors.primary}
                colors={[Colors.primary]}
              />
            ) : undefined
          }
        >
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: Spacing['4xl'] },
  pad: { paddingHorizontal: Spacing.base },
});