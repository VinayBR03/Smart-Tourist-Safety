// src/screens/ProfileScreen.tsx
// Professional Profile Screen with Validation

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
import { COLORS, SPACING, TYPOGRAPHY, RADIUS, VALIDATION, SUCCESS_MESSAGES } from '../constants/config';

type Props = NativeStackScreenProps<any, 'Profile'>;

export default function ProfileScreen({ navigation }: Props) {
  const { user, updateProfile, isLoading } = useAuth();
  
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [errors, setErrors] = useState<any>({});
  const [touched, setTouched] = useState<any>({});
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setPhone(user.phone || '');
      setEmergencyContact(user.emergency_contact || '');
    }
  }, [user]);

  useEffect(() => {
    const changed = 
      fullName !== (user?.full_name || '') ||
      phone !== (user?.phone || '') ||
      emergencyContact !== (user?.emergency_contact || '');
    setHasChanges(changed);
  }, [fullName, phone, emergencyContact, user]);

  const validateField = (field: string, value: string): string | undefined => {
    if (field === 'fullName') {
      if (value && value.length < VALIDATION.NAME.MIN_LENGTH) {
        return `Name must be at least ${VALIDATION.NAME.MIN_LENGTH} characters`;
      }
      if (value && value.length > VALIDATION.NAME.MAX_LENGTH) {
        return `Name must be less than ${VALIDATION.NAME.MAX_LENGTH} characters`;
      }
    }
    if (field === 'phone' || field === 'emergencyContact') {
      if (value && !VALIDATION.PHONE.REGEX.test(value)) {
        return 'Invalid phone number format';
      }
    }
    return undefined;
  };

  const validateForm = (): boolean => {
    const newErrors: any = {};
    
    const fullNameError = validateField('fullName', fullName);
    const phoneError = validateField('phone', phone);
    const emergencyError = validateField('emergencyContact', emergencyContact);

    if (fullNameError) newErrors.fullName = fullNameError;
    if (phoneError) newErrors.phone = phoneError;
    if (emergencyError) newErrors.emergencyContact = emergencyError;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    setTouched({ fullName: true, phone: true, emergencyContact: true });
    
    if (!validateForm()) {
      Alert.alert('Validation Error', 'Please fix the errors before saving');
      return;
    }

    try {
      await updateProfile({
        full_name: fullName.trim(),
        phone: phone.trim(),
        emergency_contact: emergencyContact.trim(),
      });

      Alert.alert('Success', SUCCESS_MESSAGES.PROFILE_UPDATE_SUCCESS);
      setHasChanges(false);
    } catch (error: any) {
      Alert.alert('Update Failed', error.message || 'Failed to update profile');
    }
  };

  const handleReset = () => {
    if (user) {
      setFullName(user.full_name || '');
      setPhone(user.phone || '');
      setEmergencyContact(user.emergency_contact || '');
      setErrors({});
      setTouched({});
      setHasChanges(false);
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
          
          {/* Profile Header */}
          <View style={styles.header}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(user?.full_name || user?.email || 'U').charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.email}>{user?.email}</Text>
            <Text style={styles.role}>Tourist Account</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={[styles.input, touched.fullName && errors.fullName && styles.inputError]}
                placeholder="Enter your full name"
                placeholderTextColor={COLORS.textSecondary}
                value={fullName}
                onChangeText={(text) => {
                  setFullName(text);
                  if (touched.fullName) {
                    setErrors((p: any) => ({ ...p, fullName: validateField('fullName', text) }));
                  }
                }}
                onBlur={() => setTouched((p: any) => ({ ...p, fullName: true }))}
                editable={!isLoading}
              />
              {touched.fullName && errors.fullName && (
                <Text style={styles.errorText}>⚠️ {errors.fullName}</Text>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                style={[styles.input, touched.phone && errors.phone && styles.inputError]}
                placeholder="+91 1234567890"
                placeholderTextColor={COLORS.textSecondary}
                value={phone}
                onChangeText={(text) => {
                  setPhone(text);
                  if (touched.phone) {
                    setErrors((p: any) => ({ ...p, phone: validateField('phone', text) }));
                  }
                }}
                onBlur={() => setTouched((p: any) => ({ ...p, phone: true }))}
                keyboardType="phone-pad"
                editable={!isLoading}
              />
              {touched.phone && errors.phone && (
                <Text style={styles.errorText}>⚠️ {errors.phone}</Text>
              )}
              <Text style={styles.helperText}>Your contact number for emergencies</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Emergency Contact</Text>
              <TextInput
                style={[styles.input, touched.emergencyContact && errors.emergencyContact && styles.inputError]}
                placeholder="+91 9876543210"
                placeholderTextColor={COLORS.textSecondary}
                value={emergencyContact}
                onChangeText={(text) => {
                  setEmergencyContact(text);
                  if (touched.emergencyContact) {
                    setErrors((p: any) => ({ ...p, emergencyContact: validateField('emergencyContact', text) }));
                  }
                }}
                onBlur={() => setTouched((p: any) => ({ ...p, emergencyContact: true }))}
                keyboardType="phone-pad"
                editable={!isLoading}
              />
              {touched.emergencyContact && errors.emergencyContact && (
                <Text style={styles.errorText}>⚠️ {errors.emergencyContact}</Text>
              )}
              <Text style={styles.helperText}>Contact to notify in emergencies</Text>
            </View>

            {hasChanges && (
              <View style={styles.changesIndicator}>
                <Text style={styles.changesText}>⚠️ You have unsaved changes</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.button, (!hasChanges || isLoading) && styles.buttonDisabled]}
              onPress={handleSave}
              disabled={!hasChanges || isLoading}>
              {isLoading ? (
                <ActivityIndicator color={'#FFFFFF'} />
              ) : (
                <Text style={styles.buttonText}>Save Changes</Text>
              )}
            </TouchableOpacity>

            {hasChanges && (
              <TouchableOpacity
                style={styles.resetButton}
                onPress={handleReset}
                disabled={isLoading}>
                <Text style={styles.resetButtonText}>Reset to Original</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Info Card */}
          <View style={styles.infoCard}>
            <Text style={styles.infoIcon}>ℹ️</Text>
            <Text style={styles.infoText}>
              Your profile information is securely stored and only shared with emergency services when needed.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { flexGrow: 1, paddingBottom: SPACING['2xl'] },
  header: { backgroundColor: COLORS.primary, padding: SPACING.xl, alignItems: 'center', paddingTop: SPACING['2xl'], paddingBottom: SPACING['2xl'] },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.md },
  avatarText: { fontSize: 36, fontWeight: TYPOGRAPHY.fontWeight.bold, color: COLORS.primary },
  email: { fontSize: TYPOGRAPHY.fontSize.lg, color: '#FFFFFF', fontWeight: TYPOGRAPHY.fontWeight.medium },
  role: { fontSize: TYPOGRAPHY.fontSize.sm, color: '#FFFFFF', opacity: 0.9, marginTop: SPACING.xs },
  form: { padding: SPACING.lg },
  inputGroup: { marginBottom: SPACING.lg },
  label: { fontSize: TYPOGRAPHY.fontSize.sm, fontWeight: TYPOGRAPHY.fontWeight.semibold, color: COLORS.text, marginBottom: SPACING.xs },
  input: { backgroundColor: COLORS.surface, borderWidth: 2, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.md, fontSize: TYPOGRAPHY.fontSize.base, color: COLORS.text },
  inputError: { borderColor: COLORS.error, backgroundColor: '#FEF2F2' },
  errorText: { fontSize: TYPOGRAPHY.fontSize.xs, color: COLORS.error, marginTop: SPACING.xs },
  helperText: { fontSize: TYPOGRAPHY.fontSize.xs, color: COLORS.textSecondary, marginTop: SPACING.xs, fontStyle: 'italic' },
  changesIndicator: { backgroundColor: '#FEF3C7', borderRadius: RADIUS.md, padding: SPACING.sm, marginBottom: SPACING.md, borderLeftWidth: 4, borderLeftColor: COLORS.warning },
  changesText: { fontSize: TYPOGRAPHY.fontSize.sm, color: '#92400E', fontWeight: TYPOGRAPHY.fontWeight.medium },
  button: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, padding: SPACING.md + 2, alignItems: 'center', marginTop: SPACING.md },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#FFFFFF', fontSize: TYPOGRAPHY.fontSize.base, fontWeight: TYPOGRAPHY.fontWeight.bold },
  resetButton: { alignItems: 'center', marginTop: SPACING.md },
  resetButtonText: { color: COLORS.textSecondary, fontSize: TYPOGRAPHY.fontSize.sm, fontWeight: TYPOGRAPHY.fontWeight.medium },
  infoCard: { backgroundColor: '#DBEAFE', borderRadius: RADIUS.lg, padding: SPACING.md, margin: SPACING.lg, flexDirection: 'row', alignItems: 'flex-start' },
  infoIcon: { fontSize: 20, marginRight: SPACING.sm },
  infoText: { flex: 1, fontSize: TYPOGRAPHY.fontSize.sm, color: COLORS.text, lineHeight: 20 },
});