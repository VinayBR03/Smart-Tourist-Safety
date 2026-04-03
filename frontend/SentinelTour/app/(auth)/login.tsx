import { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput,
  TouchableOpacity, KeyboardAvoidingView,
  Platform, ScrollView, ActivityIndicator,
  Alert, Image,
} from 'react-native';
import { router } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withTiming, withSequence,
} from 'react-native-reanimated';
import Constants from 'expo-constants';
import { authApi } from '@/api/auth';
import { useAuthStore } from '@/store/authStore';
import { SecureStorage } from '@/utils/storage';
import { Config } from '@/constants/config';
import { Colors, Typography, Spacing, Radius } from '@/constants/theme';
import { Icon } from '@/components/ui/Icons';
import { wsClient } from '@/utils/websocket';
import { useThemedStyles } from '@/utils/themedStyles';

const t = useThemedStyles();

const logo = require('../../assets/logo.png');

const schema = z.object({
  email:    z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Minimum 8 characters'),
});
type FormData = z.infer<typeof schema>;

export default function LoginScreen() {
  const { setUser } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [showPw,  setShowPw]  = useState(false);

  const shakeX   = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shakeX.value }] }));

  const { control, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const deviceInfo = `${Platform.OS} ${Constants.osVersion ?? ''}`.trim();
      const tokens = await authApi.login({ ...data, device_info: deviceInfo });

      await SecureStorage.set(Config.ACCESS_TOKEN_KEY, tokens.access_token);
      await SecureStorage.set(Config.REFRESH_TOKEN_KEY, tokens.refresh_token);

      const user = await authApi.me();
      setUser(user);
      wsClient.connect();
      router.replace('/(tabs)');
    } catch (err: any) {
      shakeX.value = withSequence(
        withTiming(-10, { duration: 55 }), withTiming(10, { duration: 55 }),
        withTiming(-8,  { duration: 55 }), withTiming(8,  { duration: 55 }),
        withTiming(0,   { duration: 55 })
      );
      const msg = err?.response?.data?.detail === 'Invalid credentials.'
        ? 'Incorrect email or password.'
        : 'Login failed. Please try again.';
      Alert.alert('Login Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, t.bg]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Image source={logo} style={styles.logo} resizeMode="contain" />
            <Text style={styles.brandName}>SENTINEL TOUR</Text>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Sign in to continue your safe journey</Text>
          </View>

          {/* Form */}
          <Animated.View style={[styles.form, shakeStyle]}>
            {/* Email */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email Address</Text>
              <Controller
                control={control} name="email"
                render={({ field: { onChange, value, onBlur } }) => (
                  <View style={[styles.inputWrapper, t.surface, t.border, errors.email && styles.inputError]}>
                    <Icon.User size={17} color={Colors.textMuted} />
                    <TextInput
                      style={styles.input}
                      placeholder="your@email.com"
                      placeholderTextColor={Colors.textMuted}
                      value={value} onChangeText={onChange} onBlur={onBlur}
                      keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
                    />
                  </View>
                )}
              />
              {errors.email && <Text style={styles.errorText}>{errors.email.message}</Text>}
            </View>

            {/* Password */}
            <View style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Password</Text>
              </View>
              <Controller
                control={control} name="password"
                render={({ field: { onChange, value, onBlur } }) => (
                  <View style={[styles.inputWrapper, t.surface, t.border, errors.password && styles.inputError]}>
                    <Icon.Lock size={17} color={Colors.textMuted} />
                    <TextInput
                      style={styles.input}
                      placeholder="••••••••"
                      placeholderTextColor={Colors.textMuted}
                      value={value} onChangeText={onChange} onBlur={onBlur}
                      secureTextEntry={!showPw}
                    />
                    <TouchableOpacity onPress={() => setShowPw((p) => !p)}>
                      <Icon.Eye size={17} color={Colors.textMuted} showPw={showPw} />
                    </TouchableOpacity>
                  </View>
                )}
              />
              {errors.password && <Text style={styles.errorText}>{errors.password.message}</Text>}
            </View>

            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleSubmit(onSubmit)} disabled={loading} activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>Sign In</Text>
              }
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              style={[styles.secondaryBtn, t.border]}
              onPress={() => router.push('/(auth)/language-select')}
              activeOpacity={0.8}
            >
              <Text style={styles.secondaryBtnText}>Create New Account</Text>
            </TouchableOpacity>
          </Animated.View>

          <Text style={styles.footer}>Sentinel Tour · Tourist Safety System</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.background },
  scroll: { flexGrow: 1, paddingHorizontal: Spacing.base, paddingBottom: Spacing['3xl'] },
  header: { alignItems: 'center', paddingTop: Spacing['3xl'], paddingBottom: Spacing['2xl'] },
  logo:   { width: 80, height: 80, marginBottom: Spacing.md },
  brandName: {
    fontSize: Typography.xs, fontFamily: 'SpaceGrotesk_700Bold',
    color: Colors.primary, letterSpacing: 3, marginBottom: Spacing.lg,
  },
  title: {
    fontSize: Typography['3xl'], fontFamily: 'SpaceGrotesk_700Bold',
    color: Colors.textPrimary, marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: Typography.base, fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary, textAlign: 'center',
  },
  form:       { gap: Spacing.base },
  fieldGroup: { gap: Spacing.xs },
  label:      { fontSize: Typography.sm, fontFamily: 'Inter_500Medium', color: Colors.textSecondary, letterSpacing: 0.3 },
  labelRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.md, height: 52, gap: Spacing.sm,
  },
  inputError: { borderColor: Colors.error },
  input: { flex: 1, color: Colors.textPrimary, fontFamily: 'Inter_400Regular', fontSize: Typography.base },
  errorText: { fontSize: Typography.xs, fontFamily: 'Inter_400Regular', color: Colors.error, marginTop: 2 },
  btn: {
    height: 54, backgroundColor: Colors.primary, borderRadius: Radius.lg,
    alignItems: 'center', justifyContent: 'center', marginTop: Spacing.sm,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: Typography.md, fontFamily: 'SpaceGrotesk_600SemiBold', letterSpacing: 0.5 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginVertical: Spacing.xs },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { fontSize: Typography.sm, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  secondaryBtn: {
    height: 54, borderRadius: Radius.lg, borderWidth: 1.5, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  secondaryBtnText: { color: Colors.textPrimary, fontSize: Typography.md, fontFamily: 'SpaceGrotesk_600SemiBold' },
  footer: {
    textAlign: 'center', fontSize: Typography.xs, fontFamily: 'Inter_400Regular',
    color: Colors.textMuted, marginTop: Spacing['3xl'], letterSpacing: 0.5,
  },
});