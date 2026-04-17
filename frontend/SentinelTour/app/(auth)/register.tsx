import { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput,
  TouchableOpacity, ScrollView, KeyboardAvoidingView,
  Platform, ActivityIndicator, Alert, Modal, FlatList,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInRight, FadeOutLeft, FadeInLeft, FadeOutRight, FadeInDown } from 'react-native-reanimated';
import { authApi } from '@/api/auth';
import { SecureStorage } from '@/utils/storage';
import { Config } from '@/constants/config';
import { useAuthStore } from '@/store/authStore';
import { Typography, Spacing, Radius } from '@/constants/theme';
import type { UserLanguage } from '@/types/api';
import { wsClient } from '@/utils/websocket';
import { useThemedStyles } from '@/utils/themedStyles';
import { useColors } from '@/context/ThemeContext';
import { Icon } from '@/components/ui/Icons';

// ─── Step schemas ─────────────────────────────────────────
const step1Schema = z.object({
  email:           z.string().email('Enter a valid email address'),
  password:        z.string().min(8, 'Min 8 chars').regex(/[A-Z]/, 'Needs uppercase').regex(/[a-z]/, 'Needs lowercase').regex(/\d/, 'Needs number').regex(/[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>\/?]/, 'Needs special char'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, { message: "Passwords don't match", path: ['confirmPassword'] });

const step2Schema = z.object({
  full_name:     z.string().min(2, 'Enter your full name').max(150),
  phone:         z.string().min(7, 'Enter a valid phone number').max(20),
  gender:        z.enum(['Male', 'Female', 'Other', 'Prefer not to say']),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Select your date of birth'),
  nationality:   z.string().min(2, 'Select your nationality').max(100),
});

const step3Schema = z.object({
  emergency_contact:  z.string().min(7, 'Enter emergency contact number').max(20),
  blood_group:        z.enum(['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-', 'Unknown']),
  medical_conditions: z.string().max(500).optional(),
  allergies:          z.string().max(500).optional(),
});

type Step1 = z.infer<typeof step1Schema>;
type Step2 = z.infer<typeof step2Schema>;
type Step3 = z.infer<typeof step3Schema>;

const GENDERS      = ['Male', 'Female', 'Other', 'Prefer not to say'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-', 'Unknown'];
const STEPS        = ['Account', 'Personal', 'Medical'];

const NATIONALITIES = [
  'Afghan', 'Albanian', 'Algerian', 'American', 'Andorran', 'Angolan', 'Argentine', 'Armenian',
  'Australian', 'Austrian', 'Azerbaijani', 'Bahraini', 'Bangladeshi', 'Belgian', 'Bolivian',
  'Bosnian', 'Brazilian', 'British', 'Bulgarian', 'Cambodian', 'Cameroonian', 'Canadian',
  'Chilean', 'Chinese', 'Colombian', 'Costa Rican', 'Croatian', 'Cuban', 'Czech', 'Danish',
  'Dutch', 'Ecuadorian', 'Egyptian', 'Emirati', 'Estonian', 'Ethiopian', 'Filipino',
  'Finnish', 'French', 'Georgian', 'German', 'Ghanaian', 'Greek', 'Guatemalan', 'Hungarian',
  'Indian', 'Indonesian', 'Iranian', 'Iraqi', 'Irish', 'Israeli', 'Italian', 'Jamaican',
  'Japanese', 'Jordanian', 'Kazakh', 'Kenyan', 'Korean', 'Kuwaiti', 'Kyrgyz', 'Latvian',
  'Lebanese', 'Libyan', 'Lithuanian', 'Luxembourgish', 'Malaysian', 'Maldivian', 'Mexican',
  'Mongolian', 'Moroccan', 'Mozambican', 'Namibian', 'Nepalese', 'New Zealander', 'Nigerian',
  'Norwegian', 'Omani', 'Pakistani', 'Palestinian', 'Panamanian', 'Paraguayan', 'Peruvian',
  'Polish', 'Portuguese', 'Qatari', 'Romanian', 'Russian', 'Rwandan', 'Saudi', 'Senegalese',
  'Serbian', 'Singaporean', 'Slovak', 'Slovenian', 'Somali', 'South African', 'Spanish',
  'Sri Lankan', 'Sudanese', 'Swedish', 'Swiss', 'Syrian', 'Taiwanese', 'Tajik', 'Thai',
  'Togolese', 'Trinidadian', 'Tunisian', 'Turkish', 'Ugandan', 'Ukrainian', 'Uruguayan',
  'Uzbek', 'Venezuelan', 'Vietnamese', 'Yemeni', 'Zambian', 'Zimbabwean',
];

// ─── Calendar Date Picker ─────────────────────────────────
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS_OF_WEEK = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function CalendarPicker({
  visible, value, onChange, onClose,
}: {
  visible: boolean; value: string; onChange: (d: string) => void; onClose: () => void;
}) {
  const C = useColors();
  const today = new Date();

  const parseDate = () => {
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m] = value.split('-').map(Number);
      return { year: y, month: m - 1 };
    }

    const now = new Date();
    return {
      year: now.getFullYear(),
      month: now.getMonth(),
    };
  };

  const [viewYear,  setViewYear]  = useState(() => parseDate().year);
  const [viewMonth, setViewMonth] = useState(() => parseDate().month);

  const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const getFirstDay    = (y: number, m: number) => new Date(y, m, 1).getDay();

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay    = getFirstDay(viewYear, viewMonth);

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const pad = (n: number) => String(n).padStart(2, '0');

  const selectedDay = value && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? parseInt(value.split('-')[2], 10)
    : null;
  const isCurrentMonth = value
    && parseInt(value.split('-')[0], 10) === viewYear
    && parseInt(value.split('-')[1], 10) - 1 === viewMonth;

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  };
  const prevYear = () => setViewYear((y) => y - 1);
  const nextYear = () => setViewYear((y) => y + 1);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.calModalOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1}>
          <Animated.View
            entering={FadeInDown.duration(250)}
            style={[styles.calModal, { backgroundColor: C.surface, borderColor: C.border }]}
          >
            {/* Year row */}
            <View style={styles.calNavRow}>
              <TouchableOpacity style={styles.calNavBtn} onPress={prevYear}>
                <Text style={[styles.calNavText, { color: C.primary }]}>‹‹</Text>
              </TouchableOpacity>
              <Text style={[styles.calYearText, { color: C.textPrimary }]}>{viewYear}</Text>
              <TouchableOpacity style={styles.calNavBtn} onPress={nextYear}>
                <Text style={[styles.calNavText, { color: C.primary }]}>››</Text>
              </TouchableOpacity>
            </View>

            {/* Month row */}
            <View style={styles.calNavRow}>
              <TouchableOpacity style={styles.calNavBtn} onPress={prevMonth}>
                <Text style={[styles.calNavText, { color: C.primary }]}>‹</Text>
              </TouchableOpacity>
              <Text style={[styles.calMonthText, { color: C.textPrimary }]}>{MONTHS[viewMonth]}</Text>
              <TouchableOpacity style={styles.calNavBtn} onPress={nextMonth}>
                <Text style={[styles.calNavText, { color: C.primary }]}>›</Text>
              </TouchableOpacity>
            </View>

            {/* Day-of-week headers */}
            <View style={styles.calWeekRow}>
              {DAYS_OF_WEEK.map((d) => (
                <Text key={d} style={[styles.calDayHeader, { color: C.textMuted }]}>{d}</Text>
              ))}
            </View>

            {/* Calendar grid */}
            <View style={styles.calGrid}>
              {cells.map((cell, i) => {
                if (cell === null) return <View key={`e${i}`} style={styles.calCell} />;
                const isSelected = isCurrentMonth && cell === selectedDay;
                const isToday    = cell === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();
                return (
                  <TouchableOpacity
                    key={`d${cell}`}
                    style={[
                      styles.calCell,
                      isToday    && [styles.calCellToday, { borderColor: C.primary }],
                      isSelected && [styles.calCellSelected, { backgroundColor: C.primary }],
                    ]}
                    onPress={() => {
                      onChange(`${viewYear}-${pad(viewMonth + 1)}-${pad(cell)}`);
                      onClose();
                    }}
                  >
                    <Text style={[
                      styles.calDayText,
                      { color: isSelected ? '#fff' : isToday ? C.primary : C.textPrimary },
                    ]}>
                      {cell}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity style={[styles.calCancelBtn, { borderTopColor: C.border }]} onPress={onClose}>
              <Text style={[styles.calCancelText, { color: C.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Nationality Picker ───────────────────────────────────
function NationalityPicker({
  visible, value, onChange, onClose,
}: {
  visible: boolean; value: string; onChange: (v: string) => void; onClose: () => void;
}) {
  const C = useColors();
  const [search, setSearch] = useState('');
  const filtered = search.trim()
    ? NATIONALITIES.filter((n) => n.toLowerCase().includes(search.toLowerCase()))
    : NATIONALITIES;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.natModalOverlay, { backgroundColor: 'rgba(0,0,0,0.55)' }]}>
        <View style={[styles.natModal, { backgroundColor: C.surface }]}>
          <View style={[styles.natHeader, { borderBottomColor: C.border }]}>
            <Text style={[styles.natTitle, { color: C.textPrimary }]}>Select Nationality</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={[styles.natClose, { color: C.primary }]}>Done</Text>
            </TouchableOpacity>
          </View>
          <View style={[styles.natSearchWrap, { borderBottomColor: C.border }]}>
            <TextInput
              style={[styles.natSearch, { color: C.textPrimary, backgroundColor: C.surfaceAlt }]}
              placeholder="Search nationality..."
              placeholderTextColor={C.textMuted}
              value={search}
              onChangeText={setSearch}
              autoFocus
            />
          </View>
          <FlatList
            data={filtered}
            keyExtractor={(item) => item}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.natItem, { borderBottomColor: C.border }, value === item && { backgroundColor: 'rgba(59,130,246,0.08)' }]}
                onPress={() => { onChange(item); onClose(); }}
              >
                <Text style={[styles.natItemText, { color: value === item ? C.primary : C.textPrimary }]}>
                  {item}
                </Text>
                {value === item && <Text style={{ color: C.primary, fontSize: 16 }}>✓</Text>}
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

// ─── Shared sub-components ────────────────────────────────
function StepHeader({ step, title, subtitle }: { step: number; title: string; subtitle: string }) {
  const C = useColors();
  return (
    <View style={styles.stepHeader}>
      <Text style={[styles.stepLabel, { color: C.primary }]}>Step {step} of 3</Text>
      <Text style={[styles.stepTitle, { color: C.textPrimary }]}>{title}</Text>
      <Text style={[styles.stepSubtitle, { color: C.textSecondary }]}>{subtitle}</Text>
    </View>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  const C = useColors();
  return (
    <View style={styles.fieldGroup}>
      <Text style={[styles.label, { color: C.textSecondary }]}>{label}</Text>
      {children}
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

function InputBox({ value, onChange, onBlur, placeholder, secureTextEntry, keyboardType, autoCapitalize, error, rightEl }: {
  value: string; onChange: (v: string) => void; onBlur?: () => void; placeholder: string;
  secureTextEntry?: boolean; keyboardType?: any; autoCapitalize?: any; error?: boolean; rightEl?: React.ReactNode;
}) {
  const C = useColors();
  return (
    <View style={[styles.inputWrapper, { backgroundColor: C.surface, borderColor: error ? C.error : C.border }]}>
      <TextInput
        style={[styles.input, { color: C.textPrimary }]}
        value={value} onChangeText={onChange} onBlur={onBlur}
        placeholder={placeholder} placeholderTextColor={C.textMuted}
        secureTextEntry={secureTextEntry} keyboardType={keyboardType}
        autoCapitalize={autoCapitalize ?? 'none'}
      />
      {rightEl}
    </View>
  );
}

function ChipSelector({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  const C = useColors();
  return (
    <View style={styles.chipRow}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt}
          style={[
            styles.chip,
            { backgroundColor: C.surface, borderColor: C.border },
            value === opt && { backgroundColor: 'rgba(59,130,246,0.12)', borderColor: C.primary },
          ]}
          onPress={() => onChange(opt)}
        >
          <Text style={[styles.chipText, { color: value === opt ? C.primary : C.textSecondary }]}>{opt}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Step 1 ───────────────────────────────────────────────
function Step1Form({ form, showPw, showConfirm, setShowPw, setShowConfirm, onNext }: any) {
  const { control, formState: { errors } } = form;
  const C = useColors();
  return (
    <View style={styles.formBody}>
      <Field label="Email Address" error={errors.email?.message}>
        <Controller control={control} name="email" defaultValue=""
          render={({ field: { onChange, value, onBlur } }) => (
            <InputBox value={value} onChange={onChange} onBlur={onBlur} placeholder="your@email.com" keyboardType="email-address" error={!!errors.email} />
          )} />
      </Field>
      <Field label="Password" error={errors.password?.message}>
        <Controller control={control} name="password" defaultValue=""
          render={({ field: { onChange, value, onBlur } }) => (
            <InputBox value={value} onChange={onChange} onBlur={onBlur} placeholder="Min 8 chars, upper, lower, number, symbol"
              secureTextEntry={!showPw} error={!!errors.password}
              rightEl={<TouchableOpacity
                          onPress={() => setShowPw((p:boolean) => !p)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Icon.Eye size={20} color={C.textMuted} showPw={showPw} />
                        </TouchableOpacity>}
            />
          )} />
      </Field>
      <Field label="Confirm Password" error={errors.confirmPassword?.message}>
        <Controller control={control} name="confirmPassword" defaultValue=""
          render={({ field: { onChange, value, onBlur } }) => (
            <InputBox value={value} onChange={onChange} onBlur={onBlur} placeholder="Repeat your password"
              secureTextEntry={!showConfirm} error={!!errors.confirmPassword}
              rightEl={<TouchableOpacity
                          onPress={() => setShowPw((p:boolean) => !p)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Icon.Eye size={20} color={C.textMuted} showPw={showPw} />
                        </TouchableOpacity>}
            />
          )} />
      </Field>
        <TouchableOpacity style={styles.nextBtn} onPress={onNext} activeOpacity={0.85}>
          <Text style={styles.nextBtnText}>Continue</Text>
          <Icon.ArrowRight size={15} />
        </TouchableOpacity>
    </View>
  );
}

// ─── Step 2 ───────────────────────────────────────────────
function Step2Form({ form, onNext }: { form: any; onNext: () => void }) {
  const { control, formState: { errors }, setValue, watch } = form;
  const C = useColors();
  const [showCal, setShowCal]  = useState(false);
  const [showNat, setShowNat]  = useState(false);
  const dobValue  = watch('date_of_birth') ?? '';
  const natValue  = watch('nationality')   ?? '';

  return (
    <View style={styles.formBody}>
      <Field label="Full Name" error={errors.full_name?.message}>
        <Controller control={control} name="full_name" defaultValue=""
          render={({ field: { onChange, value, onBlur } }) => (
            <InputBox value={value} onChange={onChange} onBlur={onBlur} placeholder="John Doe" autoCapitalize="words" error={!!errors.full_name} />
          )} />
      </Field>
      <Field label="Phone Number" error={errors.phone?.message}>
        <Controller control={control} name="phone" defaultValue=""
          render={({ field: { onChange, value, onBlur } }) => (
            <InputBox value={value} onChange={onChange} onBlur={onBlur} placeholder="+91 98765 43210" keyboardType="phone-pad" error={!!errors.phone} />
          )} />
      </Field>

      {/* Gender */}
      <Field label="Gender" error={errors.gender?.message}>
        <Controller control={control} name="gender" defaultValue=""
          render={({ field: { onChange, value } }) => (
            <ChipSelector options={GENDERS} value={value} onChange={onChange} />
          )} />
      </Field>

      {/* Date of Birth — Calendar */}
      <Field label="Date of Birth" error={errors.date_of_birth?.message}>
        <Controller control={control} name="date_of_birth" defaultValue=""
          render={({ field: { onChange, value } }) => (
            <>
              <TouchableOpacity
                style={[styles.pickerBtn, { backgroundColor: C.surface, borderColor: errors.date_of_birth ? C.error : C.border }]}
                onPress={() => setShowCal(true)}
              >
                <Icon.Calendar size={18} color={C.textMuted} />
                <Text style={[styles.pickerBtnText, { color: value ? C.textPrimary : C.textMuted }]}>
                  {value || 'Select date of birth'}
                </Text>
                <Icon.ChevronRight size={16} color={C.textMuted} />
              </TouchableOpacity>
              <CalendarPicker
                visible={showCal}
                value={value}
                onChange={(d) => { onChange(d); setShowCal(false); }}
                onClose={() => setShowCal(false)}
              />
            </>
          )} />
      </Field>

      {/* Nationality — Dropdown */}
      <Field label="Nationality" error={errors.nationality?.message}>
        <Controller control={control} name="nationality" defaultValue=""
          render={({ field: { onChange, value } }) => (
            <>
              <TouchableOpacity
                style={[styles.pickerBtn, { backgroundColor: C.surface, borderColor: errors.nationality ? C.error : C.border }]}
                onPress={() => setShowNat(true)}
              >
                <Icon.Globe size={18} color={C.textMuted} />
                <Text style={[styles.pickerBtnText, { color: value ? C.textPrimary : C.textMuted }]}>
                  {value || 'Select nationality'}
                </Text>
                <Icon.ChevronRight size={16} color={C.textMuted} />
              </TouchableOpacity>
              <NationalityPicker
                visible={showNat}
                value={value}
                onChange={(v) => { onChange(v); setShowNat(false); }}
                onClose={() => setShowNat(false)}
              />
            </>
          )} />
      </Field>

      <TouchableOpacity style={styles.nextBtn} onPress={onNext} activeOpacity={0.85}>
        <Text style={styles.nextBtnText}>Continue</Text>
        <Icon.ArrowRight size={15} />
      </TouchableOpacity>
    </View>
  );
}

// ─── Step 3 ───────────────────────────────────────────────
function Step3Form({ form, loading, onSubmit }: { form: any; loading: boolean; onSubmit: () => void }) {
  const { control, formState: { errors } } = form;
  return (
    <View style={styles.formBody}>
      <Field label="Emergency Contact Number" error={errors.emergency_contact?.message}>
        <Controller control={control} name="emergency_contact" defaultValue=""
          render={({ field: { onChange, value, onBlur } }) => (
            <InputBox value={value} onChange={onChange} onBlur={onBlur} placeholder="+91 98765 43210" keyboardType="phone-pad" error={!!errors.emergency_contact} />
          )} />
      </Field>
      <Field label="Blood Group" error={errors.blood_group?.message}>
        <Controller control={control} name="blood_group" defaultValue=""
          render={({ field: { onChange, value } }) => (
            <ChipSelector options={BLOOD_GROUPS} value={value} onChange={onChange} />
          )} />
      </Field>
      <Field label="Medical Conditions (optional)" error={errors.medical_conditions?.message}>
        <Controller control={control} name="medical_conditions" defaultValue=""
          render={({ field: { onChange, value, onBlur } }) => {
            const C = useColors();
            return (
              <View style={[styles.inputWrapper, { backgroundColor: C.surface, borderColor: C.border, height: 88, alignItems: 'flex-start', paddingTop: Spacing.sm }]}>
                <TextInput
                  style={[styles.input, { color: C.textPrimary, textAlignVertical: 'top' }]}
                  value={value} onChangeText={onChange} onBlur={onBlur}
                  placeholder="e.g. Diabetes, Hypertension..." placeholderTextColor={C.textMuted}
                  multiline numberOfLines={3} autoCapitalize="sentences"
                />
              </View>
            );
          }} />
      </Field>
      <Field label="Allergies (optional)" error={errors.allergies?.message}>
        <Controller control={control} name="allergies" defaultValue=""
          render={({ field: { onChange, value, onBlur } }) => {
            const C = useColors();
            return (
              <View style={[styles.inputWrapper, { backgroundColor: C.surface, borderColor: C.border, height: 88, alignItems: 'flex-start', paddingTop: Spacing.sm }]}>
                <TextInput
                  style={[styles.input, { color: C.textPrimary, textAlignVertical: 'top' }]}
                  value={value} onChangeText={onChange} onBlur={onBlur}
                  placeholder="e.g. Penicillin, Pollen..." placeholderTextColor={C.textMuted}
                  multiline numberOfLines={3} autoCapitalize="sentences"
                />
              </View>
            );
          }} />
      </Field>
      <TouchableOpacity
        style={[styles.nextBtn, loading && { opacity: 0.6 }]}
        onPress={onSubmit} disabled={loading} activeOpacity={0.85}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.nextBtnText}>Create Account</Text>}
      </TouchableOpacity>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────
export default function RegisterScreen() {
  const t = useThemedStyles();
  const { language } = useLocalSearchParams<{ language: UserLanguage }>();
  const { setUser }  = useAuthStore();

  const [step,      setStep]      = useState(0);
  const [loading,   setLoading]   = useState(false);
  const [goingBack, setGoingBack] = useState(false);
  const [step1Data, setStep1Data] = useState<Step1 | null>(null);
  const [step2Data, setStep2Data] = useState<Step2 | null>(null);

  const form1 = useForm<Step1>({ resolver: zodResolver(step1Schema) });
  const form2 = useForm<Step2>({ resolver: zodResolver(step2Schema) });
  const form3 = useForm<Step3>({ resolver: zodResolver(step3Schema) });
  const [showPw, setShowPw]         = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleStep1 = (data: Step1) => { setStep1Data(data); setGoingBack(false); setStep(1); };
  const handleStep2 = (data: Step2) => { setStep2Data(data); setGoingBack(false); setStep(2); };

  const handleStep3 = async (data: Step3) => {
    if (!step1Data || !step2Data) return;
    setLoading(true);
    try {
      await authApi.register({ email: step1Data.email, password: step1Data.password, role: 'TOURIST', full_name: step2Data.full_name, phone: step2Data.phone });
      const tokens = await authApi.login({ email: step1Data.email, password: step1Data.password });
      await SecureStorage.set(Config.ACCESS_TOKEN_KEY, tokens.access_token);
      await SecureStorage.set(Config.REFRESH_TOKEN_KEY, tokens.refresh_token);
      await authApi.updateProfile({
        gender: step2Data.gender, date_of_birth: step2Data.date_of_birth,
        nationality: step2Data.nationality, emergency_contact: data.emergency_contact,
        blood_group: data.blood_group, medical_conditions: data.medical_conditions,
        allergies: data.allergies, preferred_language: language ?? 'en',
      });
      const user = await authApi.me();
      setUser(user);
      wsClient.connect();
      router.replace('/(tabs)');
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      Alert.alert('Registration Failed',
        detail === 'Email already registered.' ? 'This email is already in use.' : 'Registration failed. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => { setGoingBack(true); setStep((s) => s - 1); };
  const enterAnim = goingBack ? FadeInLeft : FadeInRight;
  const exitAnim  = goingBack ? FadeOutRight : FadeOutLeft;
  const C = useColors();

  return (
    <SafeAreaView style={[styles.safe, t.bg]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* Progress Header */}
        <View style={styles.progressHeader}>
          <TouchableOpacity onPress={step === 0 ? () => router.back() : goBack} style={styles.backBtn}>
            <Icon.ArrowLeft size={15} color={C.textPrimary}/>
          </TouchableOpacity>
          <View style={styles.progressSteps}>
            {STEPS.map((s, i) => (
              <View key={s} style={styles.stepItem}>
                <View style={[styles.stepDot, i <= step && styles.stepDotActive, i < step && styles.stepDotDone]}>
                  {i < step
                    ? <Text style={styles.stepCheck}>✓</Text>
                    : <Text style={[styles.stepNum, i === step && styles.stepNumActive]}>{i + 1}</Text>
                  }
                </View>
                {i < STEPS.length - 1 && <View style={[styles.stepLine, i < step && styles.stepLineActive]} />}
              </View>
            ))}
          </View>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {step === 0 && (
            <Animated.View entering={enterAnim.duration(300)} exiting={exitAnim.duration(200)}>
              <StepHeader step={1} title="Create Your Account" subtitle="Your credentials for Sentinel Tour" />
              <Step1Form form={form1} showPw={showPw} showConfirm={showConfirm} setShowPw={setShowPw} setShowConfirm={setShowConfirm} onNext={form1.handleSubmit(handleStep1)} />
            </Animated.View>
          )}
          {step === 1 && (
            <Animated.View entering={enterAnim.duration(300)} exiting={exitAnim.duration(200)}>
              <StepHeader step={2} title="Personal Information" subtitle="Help us know you better" />
              <Step2Form form={form2} onNext={form2.handleSubmit(handleStep2)} />
            </Animated.View>
          )}
          {step === 2 && (
            <Animated.View entering={enterAnim.duration(300)} exiting={exitAnim.duration(200)}>
              <StepHeader step={3} title="Medical & Emergency" subtitle="For your safety during emergencies" />
              <Step3Form form={form3} loading={loading} onSubmit={form3.handleSubmit(handleStep3)} />
            </Animated.View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:  { flex: 1 },
  scroll: { paddingHorizontal: Spacing.base, paddingBottom: Spacing['4xl'] },

  progressHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.md,
  },
  backBtn:     { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backBtnText: { fontSize: 22 },
  progressSteps: { flexDirection: 'row', alignItems: 'center' },
  stepItem:   { flexDirection: 'row', alignItems: 'center' },
  stepDot: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#374151', alignItems: 'center', justifyContent: 'center',
  },
  stepDotActive: { backgroundColor: '#3B82F6' },
  stepDotDone:   { backgroundColor: '#10B981' },
  stepNum:       { fontSize: 12, fontFamily: 'Inter_500Medium', color: '#6B7280' },
  stepNumActive: { color: '#fff' },
  stepCheck:     { fontSize: 12, color: '#fff', fontFamily: 'SpaceGrotesk_700Bold' },
  stepLine:      { width: 32, height: 2, backgroundColor: '#374151', marginHorizontal: 2 },
  stepLineActive:{ backgroundColor: '#3B82F6' },

  stepHeader: { paddingVertical: Spacing.xl, gap: Spacing.xs },
  stepLabel:  { fontSize: Typography.sm, fontFamily: 'Inter_500Medium', letterSpacing: 0.5 },
  stepTitle:  { fontSize: Typography['2xl'], fontFamily: 'SpaceGrotesk_700Bold' },
  stepSubtitle: { fontSize: Typography.sm, fontFamily: 'Inter_400Regular' },

  formBody: { gap: Spacing.base },
  fieldGroup: { gap: Spacing.xs },
  label: { fontSize: Typography.sm, fontFamily: 'Inter_500Medium', letterSpacing: 0.3 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: Radius.lg, borderWidth: 1,
    paddingHorizontal: Spacing.md, minHeight: 52, gap: Spacing.sm,
  },
  input: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: Typography.sm },
  errorText: { fontSize: Typography.xs, fontFamily: 'Inter_400Regular', color: '#EF4444', marginTop: 2 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  chip: {
    paddingHorizontal: Spacing.sm, paddingVertical: 8,
    borderRadius: Radius.full, borderWidth: 1.5,
  },
  chipText: { fontSize: Typography.xs, fontFamily: 'Inter_500Medium' },

  pickerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    borderRadius: Radius.lg, borderWidth: 1,
    paddingHorizontal: Spacing.md, height: 52,
  },
  pickerBtnText: { flex: 1, fontSize: Typography.sm, fontFamily: 'Inter_400Regular' },
  pickerArrow:   { fontSize: 18 },

  nextBtn: {
    height: 54, backgroundColor: '#3B82F6', borderRadius: Radius.lg,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
  },
  nextBtnText: { color: '#fff', fontSize: Typography.md, fontFamily: 'SpaceGrotesk_600SemiBold', letterSpacing: 0.5 },

  // Calendar modal
  calModalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  calModal: {
    width: 320, borderRadius: Radius.xl,
    borderWidth: 1, overflow: 'hidden',
    paddingHorizontal: Spacing.base, paddingTop: Spacing.md,
  },
  calNavRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  calNavBtn:    { padding: Spacing.sm },
  calNavText:   { fontSize: 20, fontFamily: 'SpaceGrotesk_700Bold' },
  calYearText:  { fontSize: Typography.xl, fontFamily: 'SpaceGrotesk_700Bold' },
  calMonthText: { fontSize: Typography.md,  fontFamily: 'SpaceGrotesk_600SemiBold' },
  calWeekRow:   { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 4 },
  calDayHeader: { width: 36, textAlign: 'center', fontSize: Typography.xs, fontFamily: 'Inter_500Medium' },
  calGrid:      { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', paddingBottom: Spacing.sm },
  calCell:      { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, margin: 1 },
  calCellToday:    { borderWidth: 1 },
  calCellSelected: {},
  calDayText:   { fontSize: Typography.sm, fontFamily: 'Inter_500Medium' },
  calCancelBtn: { borderTopWidth: 1, paddingVertical: Spacing.md, alignItems: 'center' },
  calCancelText:{ fontSize: Typography.sm, fontFamily: 'Inter_500Medium' },

  // Nationality modal
  natModalOverlay: { flex: 1, justifyContent: 'flex-end' },
  natModal:        { height: '75%', borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, overflow: 'hidden' },
  natHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  natTitle:  { fontSize: Typography.md, fontFamily: 'SpaceGrotesk_700Bold' },
  natClose:  { fontSize: Typography.base, fontFamily: 'Inter_500Medium' },
  natSearchWrap: { paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm, borderBottomWidth: 1 },
  natSearch:     { height: 44, borderRadius: Radius.lg, paddingHorizontal: Spacing.md, fontFamily: 'Inter_400Regular', fontSize: Typography.sm },
  natItem:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.base, paddingVertical: Spacing.md, borderBottomWidth: 0.5 },
  natItemText:   { fontSize: Typography.base, fontFamily: 'Inter_400Regular' },
});
