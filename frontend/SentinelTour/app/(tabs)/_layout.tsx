import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Tabs, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useAuthStore } from '@/store/authStore';
import { useNotificationStore } from '@/store/notificationStore';
import { useTheme } from '@/hooks/useTheme';
import { wsClient } from '@/utils/websocket';
import { Icon } from '@/components/ui/Icons';
import { Spacing } from '@/constants/theme';

function SOSIcon({ color }: { color: string }) {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
        fill={color} stroke={color} strokeWidth={1.5}
        strokeLinecap="round" strokeLinejoin="round"
      />
      <Path d="M12 8v4M12 16h.01" stroke="#fff" strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function TabIcon({ icon, focused, badge }: { icon: React.ReactNode; focused: boolean; badge?: number }) {
  const { C } = useTheme();
  return (
    <View style={styles.tabItem}>
      <View style={styles.iconWrap}>
        <View style={{ opacity: focused ? 1 : 0.4 }}>{icon}</View>
        {badge != null && badge > 0 && (
          <View style={[styles.badge, { borderColor: C.surface }]}>
            <View style={[styles.badgeDot, { backgroundColor: C.error }]} />
          </View>
        )}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const { isAuthenticated } = useAuthStore();
  const { unreadCount }     = useNotificationStore();
  const { C }               = useTheme();
  const insets              = useSafeAreaInsets();

  useEffect(() => {
    if (!isAuthenticated) { router.replace('/(auth)/login'); return; }
    wsClient.connect();
    return () => wsClient.disconnect();
  }, [isAuthenticated]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: C.surface,
          borderTopColor:  C.border,
          borderTopWidth: 1,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: Spacing.xs,
          elevation: 0,
        },
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen name="index"
        options={{ tabBarIcon: ({ focused }) => (
          <TabIcon focused={focused} icon={<Icon.Home size={24} color={focused ? C.primary : C.textMuted} />} />
        )}} />
      <Tabs.Screen name="map"
        options={{ tabBarIcon: ({ focused }) => (
          <TabIcon focused={focused} icon={<Icon.Map size={24} color={focused ? C.primary : C.textMuted} />} />
        )}} />
      <Tabs.Screen name="health"
        options={{ tabBarIcon: ({ focused }) => (
          <TabIcon focused={focused} icon={<Icon.HeartPulse size={24} color={focused ? C.heartRate : C.textMuted} />} />
        )}} />
      <Tabs.Screen name="sos"
        options={{ tabBarIcon: () => (
          <View style={[styles.sosTab, { backgroundColor: C.surface, borderColor: C.sos }]}>
            <SOSIcon color={C.sos} />
          </View>
        )}} />
      <Tabs.Screen name="notifications"
        options={{ tabBarIcon: ({ focused }) => (
          <TabIcon focused={focused} badge={unreadCount}
            icon={<Icon.Bell size={24} color={focused ? C.primary : C.textMuted} />} />
        )}} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabItem:  { alignItems: 'center', justifyContent: 'center', paddingTop: 4 },
  iconWrap: { position: 'relative' },
  badge:    { position: 'absolute', top: -2, right: -6 },
  badgeDot: { width: 8, height: 8, borderRadius: 4, borderWidth: 1.5 },
  sosTab: {
    width: 46, height: 46, borderRadius: 23, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center', marginBottom: -10,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.45, shadowRadius: 12, elevation: 10,
  },
});
