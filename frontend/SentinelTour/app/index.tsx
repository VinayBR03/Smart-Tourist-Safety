import { useEffect } from 'react';
import { View, Image, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withTiming, withDelay, Easing,
} from 'react-native-reanimated';
import { useAuthStore } from '@/store/authStore';
import { authApi } from '@/api/auth';
import { Typography, Spacing } from '@/constants/theme';
import { useThemedStyles } from '@/utils/themedStyles';
import { i18n, normaliseLanguage } from '@/utils/i18n';

const logo = require('../assets/logo.png');

export default function SplashPage() {
  const t = useThemedStyles();
  const { hydrate, setUser } = useAuthStore();

  const logoOpacity    = useSharedValue(0);
  const logoScale      = useSharedValue(0.75);
  const taglineOpacity = useSharedValue(0);

  const logoStyle    = useAnimatedStyle(() => ({
    opacity:   logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));
  const taglineStyle = useAnimatedStyle(() => ({ opacity: taglineOpacity.value }));

  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    logoOpacity.value    = withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) });
    // eslint-disable-next-line react-hooks/immutability
    logoScale.value      = withTiming(1, { duration: 700, easing: Easing.out(Easing.back(1.15)) });
    // eslint-disable-next-line react-hooks/immutability
    taglineOpacity.value = withDelay(500, withTiming(1, { duration: 500 }));

    const init = async () => {
      const hasToken = await hydrate();
      await new Promise((r) => setTimeout(r, 1800));
      if (hasToken) {
        try {
          const user = await authApi.me();
          setUser(user);
          i18n.setLanguage(normaliseLanguage(user.preferred_language));
          router.replace('/(tabs)');
        } catch {
          router.replace('/(auth)/login');
        }
      } else {
        router.replace('/(auth)/login');
      }
    };
    init();
  }, [hydrate, logoOpacity, logoScale, setUser, taglineOpacity]);

  return (
    <View style={[styles.container, t.bg]}>
      <View style={styles.orb1} />
      <View style={styles.orb2} />

      <Animated.View style={[styles.content, logoStyle]}>
        <Image source={logo} style={styles.logo} resizeMode="contain" />
        <Animated.View style={[styles.taglineWrap, taglineStyle]}>
          <Text style={[styles.appName, t.textPrimary]}>
            SENTINEL<Text style={styles.appNameAccent}>TOUR</Text>
          </Text>
          <Text style={[styles.tagline, t.textSecondary]}>YOUR SAFETY COMPANION</Text>
        </Animated.View>
      </Animated.View>

      <Animated.View style={[styles.loaderRow, taglineStyle]}>
        <View style={styles.dot} />
        <View style={[styles.dot, styles.dotMid]} />
        <View style={styles.dot} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orb1: {
    position: 'absolute', width: 300, height: 300, borderRadius: 150,
    backgroundColor: 'rgba(59,130,246,0.07)', top: -80, right: -80,
  },
  orb2: {
    position: 'absolute', width: 200, height: 200, borderRadius: 100,
    backgroundColor: 'rgba(6,182,212,0.05)', bottom: 100, left: -60,
  },
  content:    { alignItems: 'center', gap: Spacing.xl },
  logo:       { width: 120, height: 120 },
  taglineWrap:{ alignItems: 'center', gap: Spacing.xs },
  appName: {
    fontSize: Typography['3xl'], fontFamily: 'SpaceGrotesk_700Bold',
    letterSpacing: 4,
  },
  appNameAccent: { color: '#3B82F6' },
  tagline: {
    fontSize: Typography.xs, fontFamily: 'Inter_400Regular',
    letterSpacing: 2.5,
  },
  loaderRow: {
    position: 'absolute', bottom: 80,
    flexDirection: 'row', gap: 8, alignItems: 'center',
  },
  dot:    { width: 6, height: 6, borderRadius: 3, backgroundColor: '#3B82F6', opacity: 0.45 },
  dotMid: { opacity: 1, width: 8, height: 8, borderRadius: 4, marginTop: -1 },
});