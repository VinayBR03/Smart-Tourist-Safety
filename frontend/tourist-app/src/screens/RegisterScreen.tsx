// src/screens/RegisterScreen.tsx
// Professional Registration Screen with validation

import React, { useState } from 'react';
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
import { COLORS, SPACING, TYPOGRAPHY, RADIUS, VALIDATION, SUCCESS_MESSAGES } from '../constants/config';

type Props = NativeStackScreenProps<any, 'Register'>;

export default function RegisterScreen({ navigation }: Props) {
  const { register, isLoading } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<any>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [touched, setTouched] = useState<any>({});

  const validateField = (field: string, value: string): string | undefined => {
    if (field === 'email') {
      if (!value) return 'Email is required';
      if (!VALIDATION.EMAIL.REGEX.test(value)) return 'Invalid email address';
    }
    if (field === 'password') {
      if (!value) return 'Password is required';
      if (value.length < VALIDATION.PASSWORD.MIN_LENGTH) {
        return `Password must be at least ${VALIDATION.PASSWORD.MIN_LENGTH} characters`;
      }
    }
    if (field === 'confirmPassword') {
      if (!value) return 'Please confirm your password';
      if (value !== password) return 'Passwords do not match';
    }
    return undefined;
  };

  const validateForm = (): boolean => {
    const newErrors: any = {};
    ['email', 'password', 'confirmPassword'].forEach((field) => {
      const value = field === 'email' ? email : field === 'password' ? password : confirmPassword;
      const error = validateField(field, value);
      if (error) newErrors[field] = error;
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    setTouched({ email: true, password: true, confirmPassword: true });
    if (!validateForm()) return;

    try {
      await register({ email: email.trim().toLowerCase(), password, role: 'tourist' });
      Alert.alert('Success', SUCCESS_MESSAGES.REGISTER_SUCCESS, [
        { text: 'OK', onPress: () => navigation.replace('Login') },
      ]);
    } catch (err: any) {
      Alert.alert('Registration Failed', err.message || 'An error occurred');
    }
  };

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled">
          
          <View style={styles.header}>
            <Text style={styles.logo}>✨</Text>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join Tourist Safety Network</Text>
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
                  if (touched.email) setErrors((p: any) => ({ ...p, email: validateField('email', text) }));
                }}
                onBlur={() => setTouched((p: any) => ({ ...p, email: true }))}
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
                  placeholder="Create a password"
                  placeholderTextColor={COLORS.textSecondary}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (touched.password) setErrors((p: any) => ({ ...p, password: validateField('password', text) }));
                    if (touched.confirmPassword && confirmPassword) {
                      setErrors((p: any) => ({ ...p, confirmPassword: validateField('confirmPassword', confirmPassword) }));
                    }
                  }}
                  onBlur={() => setTouched((p: any) => ({ ...p, password: true }))}
                  secureTextEntry={!showPassword}
                  editable={!isLoading}
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

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Confirm Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[styles.input, styles.passwordInput, touched.confirmPassword && errors.confirmPassword && styles.inputError]}
                  placeholder="Confirm your password"
                  placeholderTextColor={COLORS.textSecondary}
                  value={confirmPassword}
                  onChangeText={(text) => {
                    setConfirmPassword(text);
                    if (touched.confirmPassword) setErrors((p: any) => ({ ...p, confirmPassword: validateField('confirmPassword', text) }));
                  }}
                  onBlur={() => setTouched((p: any) => ({ ...p, confirmPassword: true }))}
                  secureTextEntry={!showConfirmPassword}
                  editable={!isLoading}
                  onSubmitEditing={handleRegister}
                />
                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                  <Text>{showConfirmPassword ? '👁️' : '👁️‍🗨️'}</Text>
                </TouchableOpacity>
              </View>
              {touched.confirmPassword && errors.confirmPassword && (
                <Text style={styles.errorText}>⚠️ {errors.confirmPassword}</Text>
              )}
            </View>

            <TouchableOpacity
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={isLoading}>
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Create Account</Text>
              )}
            </TouchableOpacity>

            <View style={styles.loginRow}>
              <Text style={styles.loginText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => navigation.goBack()}>
                <Text style={styles.loginLink}>Login</Text>
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
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: SPACING.lg, paddingTop: SPACING['2xl'] },
  header: { alignItems: 'center', marginBottom: SPACING.xl },
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
  button: { backgroundColor: COLORS.secondary, borderRadius: RADIUS.md, padding: SPACING.md + 2, alignItems: 'center', marginTop: SPACING.md },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#FFFFFF', fontSize: TYPOGRAPHY.fontSize.base, fontWeight: TYPOGRAPHY.fontWeight.bold },
  loginRow: { flexDirection: 'row', justifyContent: 'center', marginTop: SPACING.lg },
  loginText: { color: COLORS.textSecondary, fontSize: TYPOGRAPHY.fontSize.sm },
  loginLink: { color: COLORS.primary, fontSize: TYPOGRAPHY.fontSize.sm, fontWeight: TYPOGRAPHY.fontWeight.bold },
});