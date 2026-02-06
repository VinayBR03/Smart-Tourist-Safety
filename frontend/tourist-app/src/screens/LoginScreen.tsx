// src/screens/LoginScreen.tsx
// Professional Login Screen with validation, loading states, and error handling

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS, VALIDATION } from '../constants/config';

type Props = NativeStackScreenProps<any, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const { login, isLoading, error, clearError } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState({ email: false, password: false });

  useEffect(() => {
    return () => clearError();
  }, [clearError]);

  const validateField = (field: 'email' | 'password', value: string): string | undefined => {
    if (field === 'email') {
      if (!value) return 'Email is required';
      if (!VALIDATION.EMAIL.REGEX.test(value)) return 'Please enter a valid email';
    }
    if (field === 'password') {
      if (!value) return 'Password is required';
      if (value.length < VALIDATION.PASSWORD.MIN_LENGTH) {
        return `Password must be at least ${VALIDATION.PASSWORD.MIN_LENGTH} characters`;
      }
    }
    return undefined;
  };

  const validateForm = (): boolean => {
    const newErrors: { email?: string; password?: string } = {};
    const emailError = validateField('email', email);
    const passwordError = validateField('password', password);
    if (emailError) newErrors.email = emailError;
    if (passwordError) newErrors.password = passwordError;
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    setTouched({ email: true, password: true });
    if (!validateForm()) return;

    try {
      await login({ email: email.trim().toLowerCase(), password });
    } catch (err: any) {
      Alert.alert('Login Failed', err.message || 'Invalid credentials');
    }
  };

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled">
          
          <View style={styles.header}>
            <Text style={styles.logo}>🛡️</Text>
            <Text style={styles.title}>Tourist Safety</Text>
            <Text style={styles.subtitle}>Welcome back!</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={[styles.input, touched.email && errors.email && styles.inputError]}
                placeholder="Enter your email"
                placeholderTextColor={COLORS.textSecondary}
                value={email}
                onChangeText={(text) => {
                  setEmail(text.trim().toLowerCase());
                  if (touched.email) setErrors((p) => ({ ...p, email: validateField('email', text) }));
                }}
                onBlur={() => setTouched((p) => ({ ...p, email: true }))}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!isLoading}
              />
              {touched.email && errors.email && (
                <Text style={styles.errorText}>⚠️ {errors.email}</Text>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[styles.input, styles.passwordInput, touched.password && errors.password && styles.inputError]}
                  placeholder="Enter your password"
                  placeholderTextColor={COLORS.textSecondary}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (touched.password) setErrors((p) => ({ ...p, password: validateField('password', text) }));
                  }}
                  onBlur={() => setTouched((p) => ({ ...p, password: true }))}
                  secureTextEntry={!showPassword}
                  editable={!isLoading}
                  onSubmitEditing={handleLogin}
                />
                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={() => setShowPassword(!showPassword)}>
                  <Text>{showPassword ? '👁️' : '👁️‍🗨️'}</Text>
                </TouchableOpacity>
              </View>
              {touched.password && errors.password && (
                <Text style={styles.errorText}>⚠️ {errors.password}</Text>
              )}
            </View>

            {error && <View style={styles.errorBox}><Text style={styles.errorBoxText}>❌ {error}</Text></View>}

            <TouchableOpacity
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={isLoading}>
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Login</Text>
              )}
            </TouchableOpacity>

            <View style={styles.registerRow}>
              <Text style={styles.registerText}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                <Text style={styles.registerLink}>Sign up</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: SPACING.lg },
  header: { alignItems: 'center', marginBottom: SPACING['2xl'] },
  logo: { fontSize: 64, marginBottom: SPACING.md },
  title: { fontSize: TYPOGRAPHY.fontSize['3xl'], fontWeight: TYPOGRAPHY.fontWeight.bold, color: COLORS.primary, marginBottom: SPACING.xs },
  subtitle: { fontSize: TYPOGRAPHY.fontSize.base, color: COLORS.textSecondary },
  form: { width: '100%' },
  inputGroup: { marginBottom: SPACING.lg },
  label: { fontSize: TYPOGRAPHY.fontSize.sm, fontWeight: TYPOGRAPHY.fontWeight.semibold, color: COLORS.text, marginBottom: SPACING.xs },
  input: { backgroundColor: COLORS.surface, borderWidth: 2, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.md, fontSize: TYPOGRAPHY.fontSize.base, color: COLORS.text },
  inputError: { borderColor: COLORS.error, backgroundColor: '#FEF2F2' },
  passwordContainer: { position: 'relative' },
  passwordInput: { paddingRight: 48 },
  eyeIcon: { position: 'absolute', right: SPACING.md, top: 0, bottom: 0, justifyContent: 'center', padding: SPACING.sm },
  errorText: { fontSize: TYPOGRAPHY.fontSize.xs, color: COLORS.error, marginTop: SPACING.xs },
  errorBox: { backgroundColor: '#FEE2E2', borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.md, borderLeftWidth: 4, borderLeftColor: COLORS.error },
  errorBoxText: { fontSize: TYPOGRAPHY.fontSize.sm, color: COLORS.error, fontWeight: TYPOGRAPHY.fontWeight.medium },
  button: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, padding: SPACING.md + 2, alignItems: 'center', marginTop: SPACING.md },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#FFFFFF', fontSize: TYPOGRAPHY.fontSize.base, fontWeight: TYPOGRAPHY.fontWeight.bold },
  registerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: SPACING.lg },
  registerText: { color: COLORS.textSecondary, fontSize: TYPOGRAPHY.fontSize.sm },
  registerLink: { color: COLORS.primary, fontSize: TYPOGRAPHY.fontSize.sm, fontWeight: TYPOGRAPHY.fontWeight.bold },
});