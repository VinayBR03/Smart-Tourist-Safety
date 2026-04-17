import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, FadeInDown,
} from 'react-native-reanimated';
import { Typography, Spacing, Radius } from '@/constants/theme';
import { i18n } from '@/utils/i18n';
import type { UserLanguage } from '@/types/api';
import { useThemedStyles } from '@/utils/themedStyles';
import { useColors } from '@/context/ThemeContext';
import { Icon } from '@/components/ui/Icons';

const LANGUAGES: { code: UserLanguage; label: string; native: string; flag: string }[] = [
  { code: 'en', label: 'English',   native: 'English',  flag: '🇬🇧' },
  { code: 'hi', label: 'Hindi',     native: 'हिंदी',    flag: '🇮🇳' },
  { code: 'kn', label: 'Kannada',   native: 'ಕನ್ನಡ',   flag: '🇮🇳' },
  { code: 'te', label: 'Telugu',    native: 'తెలుగు',  flag: '🇮🇳' },
  { code: 'ta', label: 'Tamil',     native: 'தமிழ்',   flag: '🇮🇳' },
  { code: 'ml', label: 'Malayalam', native: 'മലയാളം',  flag: '🇮🇳' },
];

function LanguageCard({
  lang, isSelected, onSelect, index,
}: {
  lang: (typeof LANGUAGES)[0];
  isSelected: boolean;
  onSelect: () => void;
  index: number;
}) {
  const C = useColors();
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePress = () => {
    scale.value = withSpring(0.95, {}, () => { scale.value = withSpring(1); });
    onSelect();
  };

  return (
    <Animated.View entering={FadeInDown.duration(400).delay(index * 60)} style={animStyle}>
      <TouchableOpacity
        style={[
          styles.langCard,
          { backgroundColor: C.surface, borderColor: C.border },
          isSelected && { borderColor: C.primary, backgroundColor: 'rgba(59,130,246,0.08)' },
        ]}
        onPress={handlePress}
        activeOpacity={0.8}
      >
        {isSelected && <View style={[styles.selectedDot, { backgroundColor: C.primary }]} />}
        <Text style={styles.langFlag}>{lang.flag}</Text>
        <Text style={[styles.langNative, { color: isSelected ? C.primary : C.textPrimary }]}>
          {lang.native}
        </Text>
        <Text style={[styles.langLabel, { color: isSelected ? C.primary : C.textMuted }]}>
          {lang.label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function LanguageSelectScreen() {
  const t = useThemedStyles();
  const [selected, setSelected] = useState<UserLanguage>('en');

  const handleSelect = (code: UserLanguage) => {
    setSelected(code);
    i18n.setLanguage(code);
  };

  const handleContinue = () => {
    router.push({ pathname: '/(auth)/register', params: { language: selected } });
  };

  const C = useColors();

  return (
    <SafeAreaView style={[styles.safe, t.bg]}>
      <View style={styles.container}>
        <View style={styles.orb} />

        <Animated.View entering={FadeInDown.duration(500)} style={styles.header}>
          <View style={[styles.icon, t.surface, t.border]}>
            <Icon.Globe size={32} color={C.primary} />
          </View>
          <Text style={[styles.title, t.textPrimary]}>Choose Your Language</Text>
          <Text style={[styles.subtitle, t.textSecondary]}>
            You can change this anytime in Settings
          </Text>
        </Animated.View>

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

        <Animated.View entering={FadeInDown.duration(500).delay(300)} style={styles.footer}>
          <TouchableOpacity style={styles.btn} onPress={handleContinue} activeOpacity={0.85}>
            <Text style={styles.btnText}>Continue</Text>
            <Icon.ArrowRight size={15} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
            <Text style={[styles.backText, t.textSecondary]}><Icon.ArrowLeft size={12} color={C.textSecondary}/> Back to Login</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1 },
  container: { flex: 1, paddingHorizontal: Spacing.base },
  orb: {
    position: 'absolute', width: 260, height: 260, borderRadius: 130,
    backgroundColor: 'rgba(59,130,246,0.07)', top: -60, right: -60,
  },
  header: { alignItems: 'center', paddingTop: Spacing['3xl'], paddingBottom: Spacing['2xl'] },
  icon: {
    width: 72, height: 72, borderRadius: 20,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.base,
  },
  iconText: { fontSize: 32 },
  title: {
    fontSize: Typography['2xl'], fontFamily: 'SpaceGrotesk_700Bold',
    marginBottom: Spacing.xs, textAlign: 'center',
  },
  subtitle: {
    fontSize: Typography.sm, fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: Spacing.sm, justifyContent: 'center',
  },
  langCard: {
    width: 156, paddingVertical: Spacing.base, paddingHorizontal: Spacing.sm,
    borderRadius: Radius.xl, borderWidth: 1.5,
    alignItems: 'center', gap: Spacing.xs,
    position: 'relative', overflow: 'hidden',
  },
  selectedDot: {
    position: 'absolute', top: 10, right: 10,
    width: 8, height: 8, borderRadius: 4,
  },
  langFlag:   { fontSize: 28, marginBottom: 2 },
  langNative: { fontSize: Typography.md, fontFamily: 'SpaceGrotesk_700Bold', textAlign: 'center' },
  langLabel:  { fontSize: Typography.xs, fontFamily: 'Inter_400Regular' },
  footer:     { marginTop: 'auto', paddingTop: Spacing.xl, paddingBottom: Spacing.lg, gap: Spacing.md },
  btn: {
    height: 54, backgroundColor: '#3B82F6', borderRadius: Radius.lg,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
  },
  btnText:  { color: '#fff', fontSize: Typography.md, fontFamily: 'SpaceGrotesk_600SemiBold', letterSpacing: 0.5 },
  btnArrow: { color: '#fff', fontSize: Typography.lg },
  backLink: { alignItems: 'center', paddingVertical: Spacing.sm },
  backText: { fontSize: Typography.sm, fontFamily: 'Inter_500Medium' },
});
