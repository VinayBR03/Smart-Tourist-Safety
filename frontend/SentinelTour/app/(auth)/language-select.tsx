import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeInDown,
} from 'react-native-reanimated';
import { Colors, Typography, Spacing, Radius } from '@/constants/theme';
import { i18n } from '@/utils/i18n';
import type { UserLanguage } from '@/types/api';
import { useThemedStyles } from '@/utils/themedStyles';

const t = useThemedStyles();

const LANGUAGES: { code: UserLanguage; label: string; native: string; flag: string }[] = [
  { code: 'en', label: 'English', native: 'English', flag: '🇬🇧' },
  { code: 'hi', label: 'Hindi', native: 'हिंदी', flag: '🇮🇳' },
  { code: 'kn', label: 'Kannada', native: 'ಕನ್ನಡ', flag: '🇮🇳' },
  { code: 'te', label: 'Telugu', native: 'తెలుగు', flag: '🇮🇳' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்', flag: '🇮🇳' },
  { code: 'ml', label: 'Malayalam', native: 'മലയാളം', flag: '🇮🇳' },
];

export default function LanguageSelectScreen() {
  const [selected, setSelected] = useState<UserLanguage>('en');

  const handleSelect = (code: UserLanguage) => {
    setSelected(code);
    i18n.setLanguage(code);
  };

  const handleContinue = () => {
    router.push({ pathname: '/(auth)/register', params: { language: selected } });
  };

  return (
    <SafeAreaView style={[styles.safe, t.bg]}>
      <View style={styles.container}>
        {/* Top decoration */}
        <View style={styles.orb} />

        {/* Header */}
        <Animated.View entering={FadeInDown.duration(500)} style={styles.header}>
          <View style={styles.icon}>
            <Text style={styles.iconText}>🌐</Text>
          </View>
          <Text style={styles.title}>Choose Your Language</Text>
          <Text style={styles.subtitle}>
            You can change this anytime in Settings
          </Text>
        </Animated.View>

        {/* Language Grid */}
        <Animated.View entering={FadeInDown.duration(500).delay(150)} style={styles.grid}>
          {LANGUAGES.map((lang, index) => (
            <LanguageCard
              key={lang.code}
              lang={lang}
              isSelected={selected === lang.code}
              onSelect={() => handleSelect(lang.code)}
              index={index}
            />
          ))}
        </Animated.View>

        {/* Continue Button */}
        <Animated.View entering={FadeInDown.duration(500).delay(300)} style={styles.footer}>
          <TouchableOpacity style={styles.btn} onPress={handleContinue} activeOpacity={0.85}>
            <Text style={styles.btnText}>Continue</Text>
            <Text style={styles.btnArrow}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
            <Text style={styles.backText}>← Back to Login</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

function LanguageCard({
  lang,
  isSelected,
  onSelect,
  index,
}: {
  lang: (typeof LANGUAGES)[0];
  isSelected: boolean;
  onSelect: () => void;
  index: number;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    scale.value = withSpring(0.95, {}, () => {
      scale.value = withSpring(1);
    });
    onSelect();
  };

  return (
    <Animated.View entering={FadeInDown.duration(400).delay(index * 60)} style={animStyle}>
      <TouchableOpacity
        style={[styles.langCard, t.surface, t.border, isSelected && styles.langCardSelected]}
        onPress={handlePress}
        activeOpacity={0.8}
      >
        {isSelected && <View style={styles.selectedDot} />}
        <Text style={styles.langFlag}>{lang.flag}</Text>
        <Text style={[styles.langNative, isSelected && styles.langNativeSelected]}>
          {lang.native}
        </Text>
        <Text style={[styles.langLabel, isSelected && styles.langLabelSelected]}>
          {lang.label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1, paddingHorizontal: Spacing.base },
  orb: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(59,130,246,0.07)',
    top: -60,
    right: -60,
  },
  header: { alignItems: 'center', paddingTop: Spacing['3xl'], paddingBottom: Spacing['2xl'] },
  icon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.base,
  },
  iconText: { fontSize: 32 },
  title: {
    fontSize: Typography['2xl'],
    fontFamily: 'SpaceGrotesk_700Bold',
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: Typography.sm,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    justifyContent: 'center',
  },
  langCard: {
    width: 156,
    paddingVertical: Spacing.base,
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    gap: Spacing.xs,
    position: 'relative',
    overflow: 'hidden',
  },
  langCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(59,130,246,0.08)',
  },
  selectedDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  langFlag: { fontSize: 28, marginBottom: 2 },
  langNative: {
    fontSize: Typography.md,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  langNativeSelected: { color: Colors.primary },
  langLabel: {
    fontSize: Typography.xs,
    fontFamily: 'Inter_400Regular',
    color: Colors.textMuted,
  },
  langLabelSelected: { color: Colors.primary },
  footer: { marginTop: 'auto', paddingTop: Spacing.xl, paddingBottom: Spacing.lg, gap: Spacing.md },
  btn: {
    height: 54,
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  btnText: {
    color: '#fff',
    fontSize: Typography.md,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    letterSpacing: 0.5,
  },
  btnArrow: { color: '#fff', fontSize: Typography.lg },
  backLink: { alignItems: 'center', paddingVertical: Spacing.sm },
  backText: {
    fontSize: Typography.sm,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
  },
});