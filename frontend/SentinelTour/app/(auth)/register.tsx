import { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  FadeInRight,
  FadeOutLeft,
  FadeInLeft,
  FadeOutRight,
} from 'react-native-reanimated';
import { authApi } from '@/api/auth';
import { SecureStorage } from '@/utils/storage';
import { Config } from '@/constants/config';
import { useAuthStore } from '@/store/authStore';
import { Colors, Typography, Spacing, Radius } from '@/constants/theme';
import type { UserLanguage } from '@/types/api';
import { wsClient } from '@/utils/websocket';
import { useThemedStyles } from '@/utils/themedStyles';
import { useTheme } from '@react-navigation/native';

const t = useThemedStyles()

// ─── Step schemas ─────────────────────────────────────────
const step1Schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z
    .string()
    .min(8, 'Minimum 8 characters')
    .regex(/[A-Z]/, 'Must have uppercase')
    .regex(/[a-z]/, 'Must have lowercase')
    .regex(/\d/, 'Must have a number')
    .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, 'Must have special char'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

const step2Schema = z.object({
  full_name: z.string().min(2, 'Enter your full name').max(150),
  phone: z.string().min(7, 'Enter a valid phone number').max(20),
  gender: z.enum(['Male', 'Female', 'Other', 'Prefer not to say']),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),
  nationality: z.string().min(2, 'Enter your nationality').max(100),
});

const step3Schema = z.object({
  emergency_contact: z.string().min(7, 'Enter emergency contact number').max(20),
  blood_group: z.enum(['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-', 'Unknown']),
  medical_conditions: z.string().max(500).optional(),
  allergies: z.string().max(500).optional(),
});

type Step1 = z.infer<typeof step1Schema>;
type Step2 = z.infer<typeof step2Schema>;
type Step3 = z.infer<typeof step3Schema>;

const STEPS = ['Account', 'Personal', 'Medical'];

const GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-', 'Unknown'];

export default function RegisterScreen() {
  const t = useThemedStyles();
  const { language } = useLocalSearchParams<{ language: UserLanguage }>();
  const { setUser } = useAuthStore();

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [goingBack, setGoingBack] = useState(false);

  // Accumulated data
  const [step1Data, setStep1Data] = useState<Step1 | null>(null);
  const [step2Data, setStep2Data] = useState<Step2 | null>(null);

  const form1 = useForm<Step1>({ resolver: zodResolver(step1Schema) });
  const form2 = useForm<Step2>({ resolver: zodResolver(step2Schema) });
  const form3 = useForm<Step3>({ resolver: zodResolver(step3Schema) });

  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleStep1 = (data: Step1) => {
    setStep1Data(data);
    setGoingBack(false);
    setStep(1);
  };

  const handleStep2 = (data: Step2) => {
    setStep2Data(data);
    setGoingBack(false);
    setStep(2);
  };

  const handleStep3 = async (data: Step3) => {
    if (!step1Data || !step2Data) return;
    setLoading(true);
    try {
      // Register with basic fields
      await authApi.register({
        email: step1Data.email,
        password: step1Data.password,
        role: 'TOURIST',
        full_name: step2Data.full_name,
        phone: step2Data.phone,
      });

      // Login to get token
      const tokens = await authApi.login({
        email: step1Data.email,
        password: step1Data.password,
      });

      await SecureStorage.set(Config.ACCESS_TOKEN_KEY, tokens.access_token);
      await SecureStorage.set(Config.REFRESH_TOKEN_KEY, tokens.refresh_token);

      // Update extended profile
      await authApi.updateProfile({
        gender: step2Data.gender,
        date_of_birth: step2Data.date_of_birth,
        nationality: step2Data.nationality,
        emergency_contact: data.emergency_contact,
        blood_group: data.blood_group,
        medical_conditions: data.medical_conditions,
        allergies: data.allergies,
        preferred_language: language ?? 'en',
      });

      const user = await authApi.me();
      setUser(user);
      wsClient.connect();
      router.replace('/(tabs)');
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const msg =
        detail === 'Email already registered.'
          ? 'This email is already in use. Try logging in.'
          : 'Registration failed. Please try again.';
      Alert.alert('Registration Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    setGoingBack(true);
    setStep((s) => s - 1);
  };

  const enterAnim = goingBack ? FadeInLeft : FadeInRight;
  const exitAnim = goingBack ? FadeOutRight : FadeOutLeft;

  return (
    <SafeAreaView style={[styles.safe, t.bg]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Progress Header */}
        <View style={styles.progressHeader}>
          <TouchableOpacity
            onPress={step === 0 ? () => router.back() : goBack}
            style={styles.backBtn}
          >
            <Text style={styles.backBtnText}>←</Text>
          </TouchableOpacity>
          <View style={styles.progressSteps}>
            {STEPS.map((s, i) => (
              <View key={s} style={styles.stepItem}>
                <View style={[styles.stepDot, i <= step && styles.stepDotActive, i < step && styles.stepDotDone]}>
                  {i < step ? (
                    <Text style={styles.stepCheck}>✓</Text>
                  ) : (
                    <Text style={[styles.stepNum, i === step && styles.stepNumActive]}>
                      {i + 1}
                    </Text>
                  )}
                </View>
                {i < STEPS.length - 1 && (
                  <View style={[styles.stepLine, i < step && styles.stepLineActive]} />
                )}
              </View>
            ))}
          </View>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === 0 && (
            <Animated.View entering={enterAnim.duration(300)} exiting={exitAnim.duration(200)}>
              <StepHeader
                step={1}
                title="Create Your Account"
                subtitle="Your credentials for Sentinel Tour"
              />
              <Step1Form
                form={form1}
                showPw={showPw}
                showConfirm={showConfirm}
                setShowPw={setShowPw}
                setShowConfirm={setShowConfirm}
                onNext={form1.handleSubmit(handleStep1)}
              />
            </Animated.View>
          )}

          {step === 1 && (
            <Animated.View entering={enterAnim.duration(300)} exiting={exitAnim.duration(200)}>
              <StepHeader
                step={2}
                title="Personal Information"
                subtitle="Help us know you better"
              />
              <Step2Form form={form2} onNext={form2.handleSubmit(handleStep2)} />
            </Animated.View>
          )}

          {step === 2 && (
            <Animated.View entering={enterAnim.duration(300)} exiting={exitAnim.duration(200)}>
              <StepHeader
                step={3}
                title="Medical & Emergency"
                subtitle="For your safety during emergencies"
              />
              <Step3Form
                form={form3}
                loading={loading}
                onSubmit={form3.handleSubmit(handleStep3)}
              />
            </Animated.View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Step Header ──────────────────────────────────────────
function StepHeader({ step, title, subtitle }: { step: number; title: string; subtitle: string }) {
  return (
    <View style={styles.stepHeader}>
      <Text style={styles.stepLabel}>Step {step} of 3</Text>
      <Text style={[styles.stepTitle, t.textPrimary]}>{title}</Text>
      <Text style={[styles.stepSubtitle, t.textSecondary]}>{subtitle}</Text>
    </View>
  );
}

// ─── Field ────────────────────────────────────────────────
function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={[styles.label, t.textSecondary]}>{label}</Text>
      {children}
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

function InputBox({
  value,
  onChange,
  onBlur,
  placeholder,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  error,
  rightEl,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  placeholder: string;
  secureTextEntry?: boolean;
  keyboardType?: any;
  autoCapitalize?: any;
  error?: boolean;
  rightEl?: React.ReactNode;
}) {
  return (
    <View style={[styles.inputWrapper, error && styles.inputError, t.surface, t.border]}>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize ?? 'none'}
      />
      {rightEl}
    </View>
  );
}

// ─── Chip Selector ────────────────────────────────────────
function ChipSelector({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.chipRow}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt}
          style={[styles.chip, value === opt && styles.chipSelected]}
          onPress={() => onChange(opt)}
        >
          <Text style={[styles.chipText, value === opt && styles.chipTextSelected]}>{opt}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Step 1 ───────────────────────────────────────────────
function Step1Form({ form, showPw, showConfirm, setShowPw, setShowConfirm, onNext }: any) {
  const { control, formState: { errors } } = form;
  return (
    <View style={styles.formBody}>
      <Field label="Email Address" error={errors.email?.message}>
        <Controller
          control={control}
          name="email"
          defaultValue=""
          render={({ field: { onChange, value, onBlur } }) => (
            <InputBox
              value={value}
              onChange={onChange}
              onBlur={onBlur}
              placeholder="your@email.com"
              keyboardType="email-address"
              error={!!errors.email}
            />
          )}
        />
      </Field>

      <Field label="Password" error={errors.password?.message}>
        <Controller
          control={control}
          name="password"
          defaultValue=""
          render={({ field: { onChange, value, onBlur } }) => (
            <InputBox
              value={value}
              onChange={onChange}
              onBlur={onBlur}
              placeholder="Min 8 chars, upper, lower, number, symbol"
              secureTextEntry={!showPw}
              error={!!errors.password}
              rightEl={
                <TouchableOpacity onPress={() => setShowPw((p: boolean) => !p)}>
                  <Text style={{ fontSize: 16 }}>{showPw ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              }
            />
          )}
        />
      </Field>

      <Field label="Confirm Password" error={errors.confirmPassword?.message}>
        <Controller
          control={control}
          name="confirmPassword"
          defaultValue=""
          render={({ field: { onChange, value, onBlur } }) => (
            <InputBox
              value={value}
              onChange={onChange}
              onBlur={onBlur}
              placeholder="Re-enter password"
              secureTextEntry={!showConfirm}
              error={!!errors.confirmPassword}
              rightEl={
                <TouchableOpacity onPress={() => setShowConfirm((p: boolean) => !p)}>
                  <Text style={{ fontSize: 16 }}>{showConfirm ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              }
            />
          )}
        />
      </Field>

      <PasswordStrengthHint />

      <NextButton onPress={onNext} label="Next: Personal Info" />
    </View>
  );
}

function PasswordStrengthHint() {
  return (
    <View style={styles.hint}>
      <Text style={styles.hintTitle}>Password requirements:</Text>
      {['At least 8 characters', 'One uppercase letter', 'One lowercase letter', 'One number', 'One special character'].map((r) => (
        <Text key={r} style={styles.hintItem}>· {r}</Text>
      ))}
    </View>
  );
}

// ─── Step 2 ───────────────────────────────────────────────
function Step2Form({ form, onNext }: any) {
  const { control, formState: { errors } } = form;
  return (
    <View style={styles.formBody}>
      <Field label="Full Name *" error={errors.full_name?.message}>
        <Controller control={control} name="full_name" defaultValue=""
          render={({ field: { onChange, value, onBlur } }) => (
            <InputBox value={value} onChange={onChange} onBlur={onBlur}
              placeholder="John Doe" autoCapitalize="words" error={!!errors.full_name} />
          )}
        />
      </Field>

      <Field label="Phone Number *" error={errors.phone?.message}>
        <Controller control={control} name="phone" defaultValue=""
          render={({ field: { onChange, value, onBlur } }) => (
            <InputBox value={value} onChange={onChange} onBlur={onBlur}
              placeholder="+91 98765 43210" keyboardType="phone-pad" error={!!errors.phone} />
          )}
        />
      </Field>

      <Field label="Gender *" error={errors.gender?.message}>
        <Controller control={control} name="gender" defaultValue=""
          render={({ field: { onChange, value } }) => (
            <ChipSelector options={GENDERS} value={value} onChange={onChange} />
          )}
        />
      </Field>

      <Field label="Date of Birth *" error={errors.date_of_birth?.message}>
        <Controller control={control} name="date_of_birth" defaultValue=""
          render={({ field: { onChange, value, onBlur } }) => (
            <InputBox value={value} onChange={onChange} onBlur={onBlur}
              placeholder="1990-01-31 (YYYY-MM-DD)" keyboardType="numbers-and-punctuation"
              error={!!errors.date_of_birth} />
          )}
        />
      </Field>

      <Field label="Nationality *" error={errors.nationality?.message}>
        <Controller control={control} name="nationality" defaultValue=""
          render={({ field: { onChange, value, onBlur } }) => (
            <InputBox value={value} onChange={onChange} onBlur={onBlur}
              placeholder="Indian" autoCapitalize="words" error={!!errors.nationality} />
          )}
        />
      </Field>

      <NextButton onPress={onNext} label="Next: Medical Info" />
    </View>
  );
}

// ─── Step 3 ───────────────────────────────────────────────
function Step3Form({ form, loading, onSubmit }: any) {
  const { control, formState: { errors } } = form;
  return (
    <View style={styles.formBody}>
      <View style={styles.medicalNote}>
        <Text style={styles.medicalNoteIcon}>🏥</Text>
        <Text style={styles.medicalNoteText}>
          This information is only shared with emergency responders in case of an incident.
        </Text>
      </View>

      <Field label="Emergency Contact Number *" error={errors.emergency_contact?.message}>
        <Controller control={control} name="emergency_contact" defaultValue=""
          render={({ field: { onChange, value, onBlur } }) => (
            <InputBox value={value} onChange={onChange} onBlur={onBlur}
              placeholder="+91 98765 43210" keyboardType="phone-pad"
              error={!!errors.emergency_contact} />
          )}
        />
      </Field>

      <Field label="Blood Group *" error={errors.blood_group?.message}>
        <Controller control={control} name="blood_group" defaultValue=""
          render={({ field: { onChange, value } }) => (
            <ChipSelector options={BLOOD_GROUPS} value={value} onChange={onChange} />
          )}
        />
      </Field>

      <Field label="Medical Conditions (optional)" error={errors.medical_conditions?.message}>
        <Controller control={control} name="medical_conditions" defaultValue=""
          render={({ field: { onChange, value, onBlur } }) => (
            <View style={styles.textAreaWrapper}>
              <TextInput
                style={styles.textArea}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="e.g. Diabetes, Hypertension..."
                placeholderTextColor={Colors.textMuted}
                multiline
                numberOfLines={3}
                autoCapitalize="sentences"
              />
            </View>
          )}
        />
      </Field>

      <Field label="Allergies (optional)" error={errors.allergies?.message}>
        <Controller control={control} name="allergies" defaultValue=""
          render={({ field: { onChange, value, onBlur } }) => (
            <View style={styles.textAreaWrapper}>
              <TextInput
                style={styles.textArea}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="e.g. Penicillin, Pollen..."
                placeholderTextColor={Colors.textMuted}
                multiline
                numberOfLines={3}
                autoCapitalize="sentences"
              />
            </View>
          )}
        />
      </Field>

      <TouchableOpacity
        style={[styles.nextBtn, styles.submitBtn, loading && styles.btnDisabled]}
        onPress={onSubmit}
        disabled={loading}
        activeOpacity={0.85}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.nextBtnText}>Create Account 🎉</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

function NextButton({ onPress, label }: { onPress: () => void; label: string }) {
  return (
    <TouchableOpacity style={styles.nextBtn} onPress={onPress} activeOpacity={0.85}>
      <Text style={styles.nextBtnText}>{label} →</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.base,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: { color: Colors.textPrimary, fontSize: 20 },
  progressSteps: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  stepItem: { flexDirection: 'row', alignItems: 'center' },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: { borderColor: Colors.primary },
  stepDotDone: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  stepCheck: { color: '#fff', fontSize: 13, fontFamily: 'Inter_500Medium' },
  stepNum: { color: Colors.textMuted, fontSize: Typography.sm, fontFamily: 'Inter_500Medium' },
  stepNumActive: { color: Colors.primary },
  stepLine: { width: 28, height: 1.5, backgroundColor: Colors.border, marginHorizontal: 4 },
  stepLineActive: { backgroundColor: Colors.primary },
  scroll: { flexGrow: 1, paddingHorizontal: Spacing.base, paddingBottom: Spacing['4xl'] },
  stepHeader: { paddingTop: Spacing.xl, paddingBottom: Spacing.lg },
  stepLabel: {
    fontSize: Typography.xs,
    fontFamily: 'Inter_500Medium',
    color: Colors.primary,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: Spacing.xs,
  },
  stepTitle: {
    fontSize: Typography['2xl'],
    fontFamily: 'SpaceGrotesk_700Bold',
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  stepSubtitle: {
    fontSize: Typography.sm,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
  },
  formBody: { gap: Spacing.base },
  fieldGroup: { gap: Spacing.xs },
  label: {
    fontSize: Typography.sm,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
    letterSpacing: 0.3,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    height: 52,
    gap: Spacing.sm,
  },
  inputError: { borderColor: Colors.error },
  input: {
    flex: 1,
    color: Colors.textPrimary,
    fontFamily: 'Inter_400Regular',
    fontSize: Typography.base,
  },
  errorText: {
    fontSize: Typography.xs,
    fontFamily: 'Inter_400Regular',
    color: Colors.error,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  chipSelected: { backgroundColor: 'rgba(59,130,246,0.12)', borderColor: Colors.primary },
  chipText: { fontSize: Typography.sm, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  chipTextSelected: { color: Colors.primary },
  textAreaWrapper: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    minHeight: 90,
  },
  textArea: {
    color: Colors.textPrimary,
    fontFamily: 'Inter_400Regular',
    fontSize: Typography.base,
    textAlignVertical: 'top',
  },
  hint: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  hintTitle: { fontSize: Typography.xs, fontFamily: 'Inter_500Medium', color: Colors.textSecondary, marginBottom: 4 },
  hintItem: { fontSize: Typography.xs, fontFamily: 'Inter_400Regular', color: Colors.textMuted },
  medicalNote: {
    flexDirection: 'row',
    backgroundColor: 'rgba(59,130,246,0.08)',
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.2)',
    alignItems: 'flex-start',
  },
  medicalNoteIcon: { fontSize: 18 },
  medicalNoteText: {
    flex: 1,
    fontSize: Typography.sm,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  nextBtn: {
    height: 54,
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
  },
  submitBtn: { backgroundColor: Colors.success },
  btnDisabled: { opacity: 0.6 },
  nextBtnText: {
    color: '#fff',
    fontSize: Typography.md,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    letterSpacing: 0.5,
  },
});