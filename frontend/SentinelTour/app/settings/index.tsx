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
import { i18n } from '@/utils/i18n';
import { Colors, Typography, Spacing, Radius } from '@/constants/theme';
import type { UserLanguage } from '@/types/api';
import { useTheme } from '@/hooks/useTheme';
import { useThemedStyles } from '@/utils/themedStyles';

const t = useThemedStyles();

const LANGUAGES: { code: UserLanguage; label: string; native: string }[] = [
  { code: 'en', label: 'English',   native: 'English'  },
  { code: 'hi', label: 'Hindi',     native: 'हिंदी'     },
  { code: 'kn', label: 'Kannada',   native: 'ಕನ್ನಡ'    },
  { code: 'te', label: 'Telugu',    native: 'తెలుగు'   },
  { code: 'ta', label: 'Tamil',     native: 'தமிழ்'    },
  { code: 'ml', label: 'Malayalam', native: 'മലയാളം'   },
];

function SettingRow({ icon, label, subtitle, onPress, danger, rightEl }: {
  icon: React.ReactNode; label: string; subtitle?: string;
  onPress?: () => void; danger?: boolean; rightEl?: React.ReactNode;
}) {
  return (
    <TouchableOpacity
      style={styles.settingRow}
      onPress={onPress}
      activeOpacity={onPress ? 0.75 : 1}
      disabled={!onPress && !rightEl}
    >
      <View style={[styles.settingRowIcon, danger && styles.settingRowIconDanger]}>{icon}</View>
      <View style={styles.settingRowContent}>
        <Text style={[styles.settingRowLabel, danger && styles.settingRowLabelDanger]}>{label}</Text>
        {subtitle && <Text style={styles.settingRowSub}>{subtitle}</Text>}
      </View>
      {rightEl ?? (onPress && <Icon.ChevronRight size={18} color={Colors.textMuted} />)}
    </TouchableOpacity>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

function RowDivider() {
  return <View style={styles.rowDivider} />;
}

function ChangePasswordSheet({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState('');
  const [next,    setNext]    = useState('');
  const [confirm, setConfirm] = useState('');
  const [showAll, setShowAll] = useState(false);

  const mutation = useMutation({
    mutationFn: () => authApi.changePassword(current, next, confirm),
    onSuccess: () => {
      Alert.alert('Password Changed', 'Your password has been updated successfully.');
      onClose();
    },
    onError: (err: any) => {
      Alert.alert('Error', err?.response?.data?.detail ?? 'Could not change password.');
    },
  });

  return (
    <View style={[styles.root, t.surfaceAlt, t.border]}>
      <View style={styles.sheetHandle} />
      <Text style={styles.sheetTitle}>Change Password</Text>
      {[
        { label: 'Current Password', value: current, onChange: setCurrent },
        { label: 'New Password',     value: next,    onChange: setNext    },
        { label: 'Confirm Password', value: confirm, onChange: setConfirm },
      ].map((f) => (
        <View key={f.label} style={styles.sheetField}>
          <Text style={styles.sheetFieldLabel}>{f.label}</Text>
          <View style={[styles.sheetInput, t.surface, t.border]}>
            <TextInput
              style={styles.sheetInputText}
              value={f.value} onChangeText={f.onChange}
              secureTextEntry={!showAll}
              placeholder="••••••••" placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
            />
          </View>
        </View>
      ))}
      <TouchableOpacity onPress={() => setShowAll((p) => !p)} style={styles.showPwToggle}>
        <Icon.Lock size={14} color={Colors.textMuted} />
        <Text style={styles.showPwText}>{showAll ? 'Hide' : 'Show'} passwords</Text>
      </TouchableOpacity>
      <View style={styles.sheetActions}>
        <TouchableOpacity style={styles.sheetCancelBtn} onPress={onClose}>
          <Text style={styles.sheetCancelText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sheetSubmitBtn, mutation.isPending && styles.btnDisabled]}
          onPress={() => mutation.mutate()} disabled={mutation.isPending}
        >
          {mutation.isPending
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.sheetSubmitText}>Update Password</Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}

function LanguagePicker({ current, onSelect }: { current: UserLanguage; onSelect: (lang: UserLanguage) => void }) {
  return (
    <View style={styles.langGrid}>
      {LANGUAGES.map((lang) => (
        <TouchableOpacity
          key={lang.code}
          style={[styles.langChip, current === lang.code && styles.langChipActive]}
          onPress={() => onSelect(lang.code)}
        >
          <Text style={[styles.langChipNative, current === lang.code && styles.langChipActiveText]}>{lang.native}</Text>
          <Text style={[styles.langChipLabel,  current === lang.code && styles.langChipActiveText]}>{lang.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function SettingsScreen() {
  const { C } = useTheme();
  const { user, logout, setUser } = useAuthStore();
  const { theme, toggle: toggleTheme } = useThemeStore();
  const queryClient = useQueryClient();

  const [showChangePw,   setShowChangePw]   = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);

  const currentLang = (user?.preferred_language ?? 'en') as UserLanguage;

  const langMutation = useMutation({
    mutationFn: (lang: UserLanguage) => authApi.updateProfile({ preferred_language: lang }),
    onSuccess: (_data, lang) => {
      i18n.setLanguage(lang);
      if (user) setUser({ ...user, preferred_language: lang });
      setShowLangPicker(false);
    },
    onError: (err: any) => {
      Alert.alert('Error', 'Could not update language.');
    },
  });

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout', style: 'destructive',
        onPress: async () => {
          wsClient.disconnect();
          queryClient.clear();
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will schedule your account for deletion. You have 30 days to cancel. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              await authApi.updateProfile({} as any);
              Alert.alert('Deletion Requested', 'Your account is scheduled for deletion in 30 days.');
            } catch {
              Alert.alert('Error', 'Could not request account deletion.');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.background }}>
      <Header title="Settings" showBack />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ── Profile card → opens profile in edit mode ── */}
        <Animated.View entering={FadeInDown.duration(400)}>
          <TouchableOpacity
            style={[styles.profileCard, t.surfaceAlt, t.border]}
            onPress={() => router.push('/profile?edit=true')}   // ← auto-opens edit mode
            activeOpacity={0.8}
          >
            <Avatar name={user?.full_name} size={56} />
            <View style={{ flex: 1 }}>
              <Text style={styles.profileName}>{user?.full_name ?? 'Tourist'}</Text>
              <Text style={styles.profileEmail}>{user?.email}</Text>
              <Text style={styles.profileEdit}>Tap to edit profile</Text>
            </View>
            <Icon.Edit size={18} color={Colors.primary} />
          </TouchableOpacity>
        </Animated.View>

        {/* ── Appearance ────────────────────────────────── */}
        <Animated.View entering={FadeInDown.duration(400).delay(40)}>
          <SectionHeader title="Appearance" />
          <Card>
            <SettingRow
              icon={
                theme === 'dark'
                  ? <Icon.Moon size={20} color={Colors.primary} />
                  : <Icon.Sun  size={20} color={Colors.warning} />
              }
              label={theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
              subtitle={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              rightEl={
                <Switch
                  value={theme === 'dark'}
                  onValueChange={toggleTheme}
                  trackColor={{ false: Colors.border, true: 'rgba(59,130,246,0.4)' }}
                  thumbColor={theme === 'dark' ? Colors.primary : Colors.textMuted}
                />
              }
            />
          </Card>
        </Animated.View>

        {/* ── Language ──────────────────────────────────── */}
        <Animated.View entering={FadeInDown.duration(400).delay(80)}>
          <SectionHeader title="Language" />
          <Card>
            <SettingRow
              icon={<Icon.Globe size={20} color={Colors.primary} />}
              label="App Language"
              subtitle={LANGUAGES.find((l) => l.code === currentLang)?.native ?? 'English'}
              onPress={() => setShowLangPicker((p) => !p)}
              rightEl={
                <View style={styles.langBadge}>
                  <Text style={styles.langBadgeText}>{LANGUAGES.find((l) => l.code === currentLang)?.label}</Text>
                  <Icon.ChevronDown size={14} color={Colors.primary} />
                </View>
              }
            />
            {showLangPicker && (
              <Animated.View entering={FadeInDown.duration(300)} style={styles.langPickerWrap}>
                {langMutation.isPending
                  ? <ActivityIndicator color={Colors.primary} style={{ paddingVertical: Spacing.md }} />
                  : <LanguagePicker current={currentLang} onSelect={(lang) => langMutation.mutate(lang)} />
                }
              </Animated.View>
            )}
          </Card>
        </Animated.View>

        {/* ── Security ──────────────────────────────────── */}
        <Animated.View entering={FadeInDown.duration(400).delay(120)}>
          <SectionHeader title="Security" />
          <Card>
            <SettingRow
              icon={<Icon.Lock size={20} color={Colors.primary} />}
              label="Change Password"
              subtitle="Update your account password"
              onPress={() => setShowChangePw((p) => !p)}
            />
          </Card>
          {showChangePw && (
            <Animated.View entering={FadeInDown.duration(300)}>
              <ChangePasswordSheet onClose={() => setShowChangePw(false)} />
            </Animated.View>
          )}
        </Animated.View>

        {/* ── About ─────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.duration(400).delay(160)}>
          <SectionHeader title="About" />
          <Card>
            <SettingRow
              icon={<Icon.Shield size={20} color={Colors.accent} />}
              label="Sentinel Tour"
              subtitle="Version 1.0.0 · Tourist Safety System"
              rightEl={<View />}
            />
            <RowDivider />
            <SettingRow
              icon={<Icon.Info size={20} color={Colors.textMuted} />}
              label="User ID"
              subtitle={user?.id ? `#${user.id}` : '—'}
              rightEl={<View />}
            />
          </Card>
        </Animated.View>

        {/* ── Account / danger zone ─────────────────────── */}
        <Animated.View entering={FadeInDown.duration(400).delay(200)}>
          <SectionHeader title="Account" />
          <Card>
            <SettingRow
              icon={<Icon.LogOut size={20} color={Colors.error} />}
              label="Logout"
              subtitle="Sign out of your account"
              onPress={handleLogout}
              danger
            />
            <RowDivider />
            <SettingRow
              icon={<Icon.Trash size={20} color={Colors.error} />}
              label="Delete Account"
              subtitle="Permanently remove your data"
              onPress={handleDeleteAccount}
              danger
            />
          </Card>
        </Animated.View>

        <View style={{ height: Spacing['4xl'] }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:         { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingHorizontal: Spacing.base, paddingBottom: Spacing['4xl'], gap: Spacing.sm },
  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.surface, borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.base, marginTop: Spacing.base,
  },
  profileName:  { fontSize: Typography.md, fontFamily: 'SpaceGrotesk_700Bold', color: Colors.textPrimary },
  profileEmail: { fontSize: Typography.xs, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 2 },
  profileEdit:  { fontSize: Typography.xs, fontFamily: 'Inter_500Medium', color: Colors.primary, marginTop: 4 },
  sectionHeader: {
    fontSize: Typography.xs, fontFamily: 'SpaceGrotesk_700Bold', color: Colors.textMuted,
    letterSpacing: 0.8, textTransform: 'uppercase', paddingTop: Spacing.md, paddingBottom: Spacing.xs,
  },
  settingRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm,
  },
  settingRowIcon: {
    width: 36, height: 36, borderRadius: Radius.md,
    backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center',
  },
  settingRowIconDanger:  { backgroundColor: 'rgba(239,68,68,0.1)' },
  settingRowContent:     { flex: 1 },
  settingRowLabel:       { fontSize: Typography.sm, fontFamily: 'Inter_500Medium', color: Colors.textPrimary },
  settingRowLabelDanger: { color: Colors.error },
  settingRowSub:         { fontSize: Typography.xs, fontFamily: 'Inter_400Regular', color: Colors.textMuted, marginTop: 1 },
  rowDivider: { height: 1, backgroundColor: Colors.border, marginLeft: 52 },
  langBadge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  langBadgeText: { fontSize: Typography.xs, fontFamily: 'Inter_500Medium', color: Colors.primary },
  langPickerWrap: { paddingTop: Spacing.sm, paddingHorizontal: Spacing.xs },
  langGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  langChip: {
    paddingHorizontal: Spacing.sm, paddingVertical: 8, borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', minWidth: 90, gap: 2,
  },
  langChipActive:     { borderColor: Colors.primary, backgroundColor: 'rgba(59,130,246,0.1)' },
  langChipNative:     { fontSize: Typography.sm, fontFamily: 'SpaceGrotesk_600SemiBold', color: Colors.textPrimary },
  langChipLabel:      { fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  langChipActiveText: { color: Colors.primary },
  sheet: {
    backgroundColor: Colors.surfaceAlt, borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.base, gap: Spacing.sm, marginTop: Spacing.xs,
  },
  sheetHandle:     { width: 32, height: 3, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 4 },
  sheetTitle:      { fontSize: Typography.md, fontFamily: 'SpaceGrotesk_700Bold', color: Colors.textPrimary },
  sheetField:      { gap: Spacing.xs },
  sheetFieldLabel: { fontSize: Typography.xs, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  sheetInput: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, height: 48,
  },
  sheetInputText:  { color: Colors.textPrimary, fontFamily: 'Inter_400Regular', fontSize: Typography.sm, flex: 1, height: '100%' },
  showPwToggle:    { flexDirection: 'row', alignItems: 'center', gap: 5 },
  showPwText:      { fontSize: Typography.xs, fontFamily: 'Inter_500Medium', color: Colors.textMuted },
  sheetActions:    { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  sheetCancelBtn: {
    flex: 1, height: 46, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  sheetCancelText: { color: Colors.textSecondary, fontSize: Typography.sm, fontFamily: 'Inter_500Medium' },
  sheetSubmitBtn: {
    flex: 2, height: 46, backgroundColor: Colors.primary,
    borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center',
  },
  sheetSubmitText: { color: '#fff', fontSize: Typography.sm, fontFamily: 'SpaceGrotesk_600SemiBold' },
  btnDisabled:     { opacity: 0.55 },
});