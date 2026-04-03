import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Avatar } from '@/components/ui/Avatar';
import { Icon } from '@/components/ui/Icons';
import { useAuthStore } from '@/store/authStore';
import { useNotificationStore } from '@/store/notificationStore';
import { useColors } from '@/context/ThemeContext';
import { notificationsApi } from '@/api/notifications';
import { Typography, Spacing, Radius } from '@/constants/theme';


interface HeaderProps {
  title?:    string;
  showBack?: boolean;
  rightEl?:  React.ReactNode;
}

export function Header({ title, showBack = false, rightEl }: HeaderProps) {
  const C                               = useColors();
  const { user }                        = useAuthStore();
  const { unreadCount, setUnreadCount } = useNotificationStore();
  const insets                          = useSafeAreaInsets();

  useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const data = await notificationsApi.unreadCount();
      setUnreadCount(data.unread_count);
      return data;
    },
    refetchInterval: 30_000,
  });

  return (
    <View
      style={[
        styles.header,
        {
          paddingTop:      insets.top + 4,
          backgroundColor: C.background,
          borderBottomColor: C.border,
        },
      ]}
    >
      {/* Left */}
      <View style={styles.left}>
        {showBack ? (
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: C.surface, borderColor: C.border }]}
            onPress={() => router.back()}
          >
            <Icon.ArrowLeft size={20} color={C.textPrimary} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={() => router.push('/profile')} activeOpacity={0.8}>
            <Avatar name={user?.full_name} size={38} />
          </TouchableOpacity>
        )}
      </View>

      {/* Center */}
      <View style={styles.center}>
        {title ? (
          <Text style={[styles.title, { color: C.textPrimary }]} numberOfLines={1}>
            {title}
          </Text>
        ) : (
          <View style={styles.brand}>
            <View style={[styles.brandDot, { backgroundColor: C.primary }]} />
            <Text style={[styles.brandText, { color: C.textPrimary }]}>SENTINEL</Text>
            <Text style={[styles.brandText, { color: C.primary }]}>TOUR</Text>
          </View>
        )}
      </View>

      {/* Right */}
      <View style={styles.right}>
        {rightEl ?? (
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: C.surface, borderColor: C.border }]}
            onPress={() => router.push('/(tabs)/notifications')}
            activeOpacity={0.8}
          >
            <Icon.Bell size={20} color={C.textPrimary} />
            {unreadCount > 0 && (
              <View style={[styles.badge, { borderColor: C.background }]}>
                <Text style={styles.badgeText}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection:    'row',
    alignItems:       'center',
    paddingHorizontal: Spacing.base,
    paddingBottom:    Spacing.md,
    borderBottomWidth: 1,
  },
  left:   { width: 48, alignItems: 'flex-start' },
  center: { flex: 1,   alignItems: 'center'     },
  right:  { width: 48, alignItems: 'flex-end'   },
  title: {
    fontSize:    Typography.lg,
    fontFamily:  'SpaceGrotesk_700Bold',
    letterSpacing: 0.3,
  },
  brand:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  brandDot: { width: 8, height: 8, borderRadius: 4 },
  brandText: { fontSize: Typography.md, fontFamily: 'SpaceGrotesk_700Bold', letterSpacing: 2 },
  iconBtn: {
    width: 40, height: 40, borderRadius: Radius.md,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  badge: {
    position:  'absolute', top: -4, right: -4,
    minWidth:  18, height: 18, borderRadius: 9,
    backgroundColor: '#EF4444',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3, borderWidth: 1.5,
  },
  badgeText: { color: '#fff', fontSize: 9, fontFamily: 'SpaceGrotesk_700Bold' },
});