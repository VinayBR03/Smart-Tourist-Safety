// src/screens/RegisterScreen.tsx

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

  const [step, setStep] = useState(1);

  // Account Info
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Personal Info
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');

  // Medical & Identity
  const [bloodGroup, setBloodGroup] = useState('');
  const [gender, setGender] = useState('');
  const [nationality, setNationality] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');

  const validateStepOne = () => {
    if (!email || !VALIDATION.EMAIL.REGEX.test(email)) {
      Alert.alert('Error', 'Enter valid email');
      return false;
    }
    if (!password || password.length < VALIDATION.PASSWORD.MIN_LENGTH) {
      Alert.alert('Error', 'Password too short');
      return false;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (step === 1 && !validateStepOne()) return;
    setStep(step + 1);
  };

  const handleBack = () => setStep(step - 1);

  const handleRegister = async () => {
    try {
      await register({
        email: email.trim().toLowerCase(),
        password,
        role: 'tourist',
        full_name: fullName,
        phone,
        emergency_contact: emergencyContact,
        blood_group: bloodGroup,
        gender,
        nationality,
        date_of_birth: dateOfBirth,
      });

      Alert.alert('Success', SUCCESS_MESSAGES.REGISTER_SUCCESS, [
        { text: 'Login', onPress: () => navigation.replace('Login') },
      ]);
    } catch (err: any) {
      Alert.alert('Registration Failed', err.message || 'An error occurred');
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <>
            <Text style={styles.stepTitle}>Account Information</Text>

            <TextInput
              style={styles.input}
              placeholder="Email"
              value={email}
              onChangeText={(text) => setEmail(text.trim().toLowerCase())}
              keyboardType="email-address"
            />

            <TextInput
              style={styles.input}
              placeholder="Password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />

            <TextInput
              style={styles.input}
              placeholder="Confirm Password"
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
          </>
        );

      case 2:
        return (
          <>
            <Text style={styles.stepTitle}>Personal Information</Text>

            <TextInput
              style={styles.input}
              placeholder="Full Name"
              value={fullName}
              onChangeText={setFullName}
            />

            <TextInput
              style={styles.input}
              placeholder="Phone Number"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />

            <TextInput
              style={styles.input}
              placeholder="Emergency Contact"
              keyboardType="phone-pad"
              value={emergencyContact}
              onChangeText={setEmergencyContact}
            />
          </>
        );

      case 3:
        return (
          <>
            <Text style={styles.stepTitle}>Medical & Identity</Text>

            <TextInput
              style={styles.input}
              placeholder="Blood Group"
              value={bloodGroup}
              onChangeText={setBloodGroup}
            />

            <TextInput
              style={styles.input}
              placeholder="Gender"
              value={gender}
              onChangeText={setGender}
            />

            <TextInput
              style={styles.input}
              placeholder="Nationality"
              value={nationality}
              onChangeText={setNationality}
            />

            <TextInput
              style={styles.input}
              placeholder="Date of Birth (YYYY-MM-DD)"
              value={dateOfBirth}
              onChangeText={setDateOfBirth}
            />
          </>
        );
    }
  };

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent}>

          <View style={styles.header}>
            <Text style={styles.logo}>✨</Text>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Step {step} of 3</Text>
          </View>

          <View style={styles.form}>
            {renderStep()}

            <View style={styles.navigationRow}>
              {step > 1 && (
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={handleBack}>
                  <Text style={styles.secondaryText}>Back</Text>
                </TouchableOpacity>
              )}

              {step < 3 ? (
                <TouchableOpacity
                  style={styles.button}
                  onPress={handleNext}>
                  <Text style={styles.buttonText}>Next</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.button}
                  onPress={handleRegister}
                  disabled={isLoading}>
                  {isLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.buttonText}>Create Account</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>

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
  title: { fontSize: TYPOGRAPHY.fontSize['3xl'], fontWeight: TYPOGRAPHY.fontWeight.bold, color: COLORS.primary },
  subtitle: { fontSize: TYPOGRAPHY.fontSize.base, color: COLORS.textSecondary, marginTop: 4 },
  form: { width: '100%' },
  stepTitle: { fontSize: TYPOGRAPHY.fontSize.lg, fontWeight: 'bold', marginBottom: SPACING.md },
  input: { backgroundColor: COLORS.surface, borderWidth: 2, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.md },
  button: { backgroundColor: COLORS.secondary, borderRadius: RADIUS.md, padding: SPACING.md + 2, alignItems: 'center', flex: 1 },
  buttonText: { color: '#FFFFFF', fontWeight: 'bold' },
  secondaryButton: { padding: SPACING.md, marginRight: SPACING.md },
  secondaryText: { color: COLORS.primary, fontWeight: 'bold' },
  navigationRow: { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.md },
  loginRow: { flexDirection: 'row', justifyContent: 'center', marginTop: SPACING.lg },
  loginText: { color: COLORS.textSecondary },
  loginLink: { color: COLORS.primary, fontWeight: 'bold' },
});
