import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Alert, TextInput, ActivityIndicator, Switch,
} from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icons';
import { Avatar } from '@/components/ui/Avatar';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import { authApi } from '@/api/auth';
import { wsClient } from '@/utils/websocket';
import { i18n, useTranslation } from '@/utils/i18n';
import { Typography, Spacing, Radius } from '@/constants/theme';
import type { UserLanguage } from '@/types/api';
import { useTheme } from '@/hooks/useTheme';
import { useThemedStyles } from '@/utils/themedStyles';
import { useColors } from '@/context/ThemeContext';

const LANGUAGES: { code: UserLanguage; label: string; native: string }[] = [
  { code: 'en', label: 'English',   native: 'English'  },
  { code: 'hi', label: 'Hindi',     native: 'हिंदी'     },
  { code: 'kn', label: 'Kannada',   native: 'ಕನ್ನಡ'    },
  { code: 'te', label: 'Telugu',    native: 'తెలుగు'   },
  { code: 'ta', label: 'Tamil',     native: 'தமிழ்'    },
  { code: 'ml', label: 'Malayalam', native: 'മലയാളം'   },
];

// --- Helper components with useColors() ------------------

function SettingRow({ icon, label, subtitle, onPress, danger, rightEl }: {
  icon: React.ReactNode; label: string; subtitle?: string;
  onPress?: () => void; danger?: boolean; rightEl?: React.ReactNode;
}) {
  const C = useColors();
  return (
    <TouchableOpacity style={styles.settingRow} onPress={onPress}
      activeOpacity={onPress ? 0.75 : 1} disabled={!onPress && !rightEl}
    >
      <View style={[styles.settingRowIcon, { backgroundColor: danger ? 'rgba(239,68,68,0.1)' : C.surfaceAlt }]}>
        {icon}
      </View>
      <View style={styles.settingRowContent}>
        <Text style={[styles.settingRowLabel, { color: danger ? C.error : C.textPrimary }]}>{label}</Text>
        {subtitle && <Text style={[styles.settingRowSub, { color: C.textMuted }]}>{subtitle}</Text>}
      </View>
      {rightEl ?? (onPress && <Icon.ChevronRight size={18} color={C.textMuted} />)}
    </TouchableOpacity>
  );
}

function SectionHeader({ title }: { title: string }) {
  const C = useColors();
  return <Text style={[styles.sectionHeader, { color: C.textMuted }]}>{title}</Text>;
}

function RowDivider() {
  const C = useColors();
  return <View style={[styles.rowDivider, { backgroundColor: C.border }]} />;
}

function ChangePasswordSheet({ onClose }: { onClose: () => void }) {
  const C = useColors();
  const { t } = useTranslation();
  const [current, setCurrent] = useState('');
  const [next,    setNext]    = useState('');
  const [confirm, setConfirm] = useState('');
  const [showAll, setShowAll] = useState(false);

  const mutation = useMutation({
    mutationFn: () => authApi.changePassword(current, next, confirm),
    onSuccess: () => { Alert.alert(t('passwordChanged') ?? 'Password Changed', t('passwordChangedSuccess') ?? 'Your password has been updated successfully.'); onClose(); },
    onError: (err: any) => { Alert.alert(t('error') ?? 'Error', err?.response?.data?.detail ?? t('passwordChangeError') ?? 'Could not change password.'); },
  });

  return (
    <View style={[styles.sheet, { backgroundColor: C.surfaceAlt, borderColor: C.border }]}>
      <View style={[styles.sheetHandle, { backgroundColor: C.border }]} />
      <Text style={[styles.sheetTitle, { color: C.textPrimary }]}>{t('changePassword') ?? 'Change Password'}</Text>
      {[
        { label: t('currentPassword') ?? 'Current Password', value: current, onChange: setCurrent },
        { label: t('newPassword') ?? 'New Password',     value: next,    onChange: setNext    },
        { label: t('confirmPassword') ?? 'Confirm Password', value: confirm, onChange: setConfirm },
      ].map((f) => (
        <View key={f.label} style={styles.sheetField}>
          <Text style={[styles.sheetFieldLabel, { color: C.textSecondary }]}>{f.label}</Text>
          <View style={[styles.sheetInput, { backgroundColor: C.surface, borderColor: C.border }]}>
            <TextInput
              style={[styles.sheetInputText, { color: C.textPrimary }]}
              value={f.value} onChangeText={f.onChange}
              secureTextEntry={!showAll}
              placeholder="••••••••" placeholderTextColor={C.textMuted}
              autoCapitalize="none"
            />
          </View>
        </View>
      ))}
      <TouchableOpacity onPress={() => setShowAll((p) => !p)} style={styles.showPwToggle}>
        <Icon.Lock size={14} color={C.textMuted} />
        <Text style={[styles.showPwText, { color: C.textMuted }]}>{showAll ? (t('hide') ?? 'Hide') : (t('show') ?? 'Show')} {t('passwords') ?? 'passwords'}</Text>
      </TouchableOpacity>
      <View style={styles.sheetActions}>
        <TouchableOpacity style={[styles.sheetCancelBtn, { borderColor: C.border }]} onPress={onClose}>
          <Text style={[styles.sheetCancelText, { color: C.textSecondary }]}>{t('cancel') ?? 'Cancel'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.sheetSubmitBtn, mutation.isPending && styles.btnDisabled]}
          onPress={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.sheetSubmitText}>{t('updatePassword') ?? 'Update Password'}</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function LanguagePicker({ current, onSelect }: { current: UserLanguage; onSelect: (lang: UserLanguage) => void }) {
  const C = useColors();
  return (
    <View style={styles.langGrid}>
      {LANGUAGES.map((lang) => (
        <TouchableOpacity key={lang.code}
          style={[
            styles.langChip,
            { backgroundColor: C.surfaceAlt, borderColor: C.border },
            current === lang.code && { borderColor: C.primary, backgroundColor: 'rgba(59,130,246,0.1)' },
          ]}
          onPress={() => onSelect(lang.code)}
        >
          <Text style={[styles.langChipNative, { color: current === lang.code ? C.primary : C.textPrimary }]}>{lang.native}</Text>
          <Text style={[styles.langChipLabel,  { color: current === lang.code ? C.primary : C.textMuted  }]}>{lang.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// --- Main screen ------------------------------------------
export default function SettingsScreen() {
  const { t: i18nT } = useTranslation();
  const t = useThemedStyles();
  const { C } = useTheme();
  const { user, logout, setUser } = useAuthStore();
  const { theme, toggle: toggleTheme } = useThemeStore();
  const queryClient = useQueryClient();

  const [showChangePw,   setShowChangePw]   = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);

  const currentLang = (user?.preferred_language ?? 'en') as UserLanguage;

  const langMutation = useMutation({
    mutationFn: async (lang: UserLanguage) => {
      await authApi.updateProfile({ preferred_language: lang });
      return authApi.me();
    },
    onSuccess: (updatedUser, lang) => {
      i18n.setLanguage(lang);
      setUser(updatedUser);
      setShowLangPicker(false);
    },
    onError: (err: any) => {
      Alert.alert(i18nT('error') ?? 'Error', `${i18nT('langUpdateError') ?? 'Could not update language:'} ${err?.response?.data?.detail ?? err?.message}`);
    },
  });

  const handleLogout = () => {
    Alert.alert(i18nT('logout') ?? 'Logout', i18nT('logoutConfirm') ?? 'Are you sure you want to log out?', [
      { text: i18nT('cancel') ?? 'Cancel', style: 'cancel' },
      { text: i18nT('logout') ?? 'Logout', style: 'destructive',
        onPress: async () => {
          wsClient.disconnect(); queryClient.clear();
          await logout(); router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(i18nT('deleteAccount') ?? 'Delete Account', i18nT('deleteAccountConfirm') ?? 'This will schedule your account for deletion. You have 30 days to cancel. Are you sure?', [
      { text: i18nT('cancel') ?? 'Cancel', style: 'cancel' },
      { text: i18nT('delete') ?? 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await authApi.updateProfile({} as any); // Assuming this is how your backend marks it
            Alert.alert(i18nT('deletionRequested') ?? 'Deletion Requested', i18nT('deletionRequestedMsg') ?? 'Your account is scheduled for deletion in 30 days.');
          } catch { Alert.alert(i18nT('error') ?? 'Error', i18nT('deleteAccountError') ?? 'Could not request account deletion.'); }
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.background }}>
      <Header title={i18nT('settings') ?? 'Settings'} showBack />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Profile card */}
        <Animated.View entering={FadeInDown.duration(400)}>
          <TouchableOpacity style={[styles.profileCard, t.surfaceAlt, t.border]} onPress={() => router.push('/profile?edit=true')} activeOpacity={0.8}>
            <Avatar name={user?.full_name} size={56} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.profileName, t.textPrimary]}>{user?.full_name ?? i18nT('tourist') ?? 'Tourist'}</Text>
              <Text style={[styles.profileEmail, t.textMuted]}>{user?.email}</Text>
              <Text style={[styles.profileEdit, { color: C.primary }]}>{i18nT('tapToEditProfile') ?? 'Tap to edit profile'}</Text>
            </View>
            <Icon.Edit size={18} color={C.primary} />
          </TouchableOpacity>
        </Animated.View>

        {/* Appearance */}
        <Animated.View entering={FadeInDown.duration(400).delay(40)}>
          <SectionHeader title={i18nT('appearance') ?? 'Appearance'} />
          <Card>
            <SettingRow
              icon={theme === 'dark' ? <Icon.Moon size={20} color={C.primary} /> : <Icon.Sun size={20} color="#F59E0B" />}
              label={theme === 'dark' ? (i18nT('darkMode') ?? 'Dark Mode') : (i18nT('lightMode') ?? 'Light Mode')}
              subtitle={theme === 'dark' ? (i18nT('switchToLight') ?? 'Switch to light theme') : (i18nT('switchToDark') ?? 'Switch to dark theme')}
              rightEl={
                <Switch value={theme === 'dark'} onValueChange={toggleTheme}
                  trackColor={{ false: C.border, true: 'rgba(59,130,246,0.4)' }}
                  thumbColor={theme === 'dark' ? C.primary : C.textMuted}
                />
              }
            />
          </Card>
        </Animated.View>

        {/* Language */}
        <Animated.View entering={FadeInDown.duration(400).delay(80)}>
          <SectionHeader title={i18nT('language') ?? 'Language'} />
          <Card>
            <SettingRow
              icon={<Icon.Globe size={20} color={C.primary} />}
              label={i18nT('appLanguage') ?? 'App Language'}
              subtitle={LANGUAGES.find((l) => l.code === currentLang)?.native ?? 'English'}
              onPress={() => setShowLangPicker((p) => !p)}
              rightEl={
                <View style={styles.langBadge}>
                  <Text style={[styles.langBadgeText, { color: C.primary }]}>{LANGUAGES.find((l) => l.code === currentLang)?.label}</Text>
                  <Icon.ChevronDown size={14} color={C.primary} />
                </View>
              }
            />
            {showLangPicker && (
              <Animated.View entering={FadeInDown.duration(300)} style={styles.langPickerWrap}>
                {langMutation.isPending
                  ? <ActivityIndicator color={C.primary} style={{ paddingVertical: Spacing.md }} />
                  : <LanguagePicker current={currentLang} onSelect={(lang) => langMutation.mutate(lang)} />
                }
              </Animated.View>
            )}
          </Card>
        </Animated.View>

        {/* Security */}
        <Animated.View entering={FadeInDown.duration(400).delay(120)}>
          <SectionHeader title={i18nT('security') ?? 'Security'} />
          <Card>
            <SettingRow icon={<Icon.Lock size={20} color={C.primary} />} label={i18nT('changePassword') ?? 'Change Password'} subtitle={i18nT('updatePasswordDesc') ?? 'Update your account password'} onPress={() => setShowChangePw((p) => !p)} />
          </Card>
          {showChangePw && (
            <Animated.View entering={FadeInDown.duration(300)}>
              <ChangePasswordSheet onClose={() => setShowChangePw(false)} />
            </Animated.View>
          )}
        </Animated.View>

        {/* About */}
        <Animated.View entering={FadeInDown.duration(400).delay(160)}>
          <SectionHeader title={i18nT('about') ?? 'About'} />
          <Card>
            <SettingRow icon={<Icon.Shield size={20} color={C.accent} />} label="Sentinel Tour" subtitle={`Version 1.0.0 · ${i18nT('touristSafetySystem') ?? 'Tourist Safety System'}`} rightEl={<View />} />
            <RowDivider />
            <SettingRow icon={<Icon.Info size={20} color={C.textMuted} />} label={i18nT('userId') ?? 'User ID'} subtitle={user?.id ? `${user.id}` : '—'} rightEl={<View />} />
          </Card>
        </Animated.View>

        {/* Account / danger */}
        <Animated.View entering={FadeInDown.duration(400).delay(200)}>
          <SectionHeader title={i18nT('account') ?? 'Account'} />
          <Card>
            <SettingRow icon={<Icon.LogOut size={20} color={C.error} />} label={i18nT('logout') ?? 'Logout'} subtitle={i18nT('signOutDesc') ?? 'Sign out of your account'} onPress={handleLogout} danger />
            <RowDivider />
            <SettingRow icon={<Icon.Trash size={20} color={C.error} />} label={i18nT('deleteAccount') ?? 'Delete Account'} subtitle={i18nT('deleteAccountDesc') ?? 'Permanently remove your data'} onPress={handleDeleteAccount} danger />
          </Card>
        </Animated.View>

        <View style={{ height: Spacing['4xl'] }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingHorizontal: Spacing.base, paddingBottom: Spacing['4xl'], gap: Spacing.sm },
  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    borderRadius: Radius.xl, borderWidth: 1, padding: Spacing.base, marginTop: Spacing.base,
  },
  profileName:  { fontSize: Typography.md, fontFamily: 'SpaceGrotesk_700Bold' },
  profileEmail: { fontSize: Typography.xs, fontFamily: 'Inter_400Regular', marginTop: 2 },
  profileEdit:  { fontSize: Typography.xs, fontFamily: 'Inter_500Medium', marginTop: 4 },
  sectionHeader: {
    fontSize: Typography.xs, fontFamily: 'SpaceGrotesk_700Bold',
    letterSpacing: 0.8, textTransform: 'uppercase', paddingTop: Spacing.md, paddingBottom: Spacing.xs,
  },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm },
  settingRowIcon:    { width: 36, height: 36, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  settingRowContent: { flex: 1 },
  settingRowLabel:   { fontSize: Typography.sm, fontFamily: 'Inter_500Medium' },
  settingRowSub:     { fontSize: Typography.xs, fontFamily: 'Inter_400Regular', marginTop: 1 },
  rowDivider:        { height: 1, marginLeft: 52 },
  langBadge:         { flexDirection: 'row', alignItems: 'center', gap: 3 },
  langBadgeText:     { fontSize: Typography.xs, fontFamily: 'Inter_500Medium' },
  langPickerWrap:    { paddingTop: Spacing.sm, paddingHorizontal: Spacing.xs },
  langGrid:          { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  langChip:          { paddingHorizontal: Spacing.sm, paddingVertical: 8, borderRadius: Radius.lg, borderWidth: 1, alignItems: 'center', minWidth: 90, gap: 2 },
  langChipNative:    { fontSize: Typography.sm, fontFamily: 'SpaceGrotesk_600SemiBold' },
  langChipLabel:     { fontSize: 10, fontFamily: 'Inter_400Regular' },
  sheet: {
    borderRadius: Radius.xl, borderWidth: 1, padding: Spacing.base, gap: Spacing.sm, marginTop: Spacing.xs,
  },
  sheetHandle:     { width: 32, height: 3, borderRadius: 2, alignSelf: 'center', marginBottom: 4 },
  sheetTitle:      { fontSize: Typography.md, fontFamily: 'SpaceGrotesk_700Bold' },
  sheetField:      { gap: Spacing.xs },
  sheetFieldLabel: { fontSize: Typography.xs, fontFamily: 'Inter_500Medium' },
  sheetInput:      { borderRadius: Radius.lg, borderWidth: 1, paddingHorizontal: Spacing.md, height: 48 },
  sheetInputText:  { fontFamily: 'Inter_400Regular', fontSize: Typography.sm, height: '100%' },
  showPwToggle:    { flexDirection: 'row', alignItems: 'center', gap: 5 },
  showPwText:      { fontSize: Typography.xs, fontFamily: 'Inter_500Medium' },
  sheetActions:    { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  sheetCancelBtn:  { flex: 1, height: 46, borderRadius: Radius.lg, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  sheetCancelText: { fontSize: Typography.sm, fontFamily: 'Inter_500Medium' },
  sheetSubmitBtn:  { flex: 2, height: 46, backgroundColor: '#3B82F6', borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center' },
  sheetSubmitText: { color: '#fff', fontSize: Typography.sm, fontFamily: 'SpaceGrotesk_600SemiBold' },
  btnDisabled:     { opacity: 0.55 },
});