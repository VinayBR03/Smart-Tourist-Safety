import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Image, Modal, FlatList,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icons';
import { authApi } from '@/api/auth';
import { mediaApi } from '@/api/media';
import { useAuthStore } from '@/store/authStore';
import { Typography, Spacing, Radius } from '@/constants/theme';
import { format } from 'date-fns';
import type { User, UserLanguage } from '@/types/api';
import { useThemedStyles } from '@/utils/themedStyles';
import { useColors } from '@/context/ThemeContext';
import { i18n } from '@/utils/i18n';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-', 'Unknown'];
const GENDERS      = ['Male', 'Female', 'Other', 'Prefer not to say'];

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS_OF_WEEK = ['Su','Mo','Tu','We','Th','Fr','Sa'];

const NATIONALITIES = [
  'Afghan','Albanian','Algerian','American','Andorran','Argentine','Armenian',
  'Australian','Austrian','Azerbaijani','Bangladeshi','Belgian','Bolivian',
  'Brazilian','British','Bulgarian','Cambodian','Canadian','Chilean','Chinese',
  'Colombian','Croatian','Czech','Danish','Dutch','Ecuadorian','Egyptian','Emirati',
  'Ethiopian','Filipino','Finnish','French','German','Ghanaian','Greek','Hungarian',
  'Indian','Indonesian','Iranian','Iraqi','Irish','Israeli','Italian','Japanese',
  'Jordanian','Kenyan','Korean','Kuwaiti','Malaysian','Mexican','Mongolian',
  'Moroccan','Nepali','New Zealander','Nigerian','Norwegian','Pakistani','Peruvian',
  'Polish','Portuguese','Qatari','Romanian','Russian','Saudi','Singaporean',
  'South African','Spanish','Sri Lankan','Swedish','Swiss','Thai','Turkish',
  'Ukrainian','Vietnamese','Other',
];

// ─── Calendar date picker ─────────────────────────────────
function CalendarPicker({ visible, value, onChange, onClose }: {
  visible: boolean; value: string; onChange: (d: string) => void; onClose: () => void;
}) {
  const C = useColors();
  const pad = (n: number) => String(n).padStart(2, '0');
  const today = new Date();

  const parseValue = () => {
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split('-').map(Number);
      return { year: y, month: m - 1 };
    }
    return { year: 1990, month: 0 };
  };

  const [viewYear,  setViewYear]  = useState(parseValue().year);
  const [viewMonth, setViewMonth] = useState(parseValue().month);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay    = new Date(viewYear, viewMonth, 1).getDay();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const selectedDay    = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? parseInt(value.split('-')[2], 10) : null;
  const isCurrentMonth = value && parseInt(value.split('-')[0], 10) === viewYear && parseInt(value.split('-')[1], 10) - 1 === viewMonth;

  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); } else setViewMonth((m) => m - 1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); } else setViewMonth((m) => m + 1); };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1}>
          <View style={[styles.calModal, { backgroundColor: C.surface, borderColor: C.border }]}>
            <View style={styles.calNavRow}>
              <TouchableOpacity onPress={() => setViewYear((y) => y - 1)} style={styles.calNavBtn}><Text style={[styles.calNavText, { color: C.primary }]}>‹‹</Text></TouchableOpacity>
              <Text style={[styles.calYearText, { color: C.textPrimary }]}>{viewYear}</Text>
              <TouchableOpacity onPress={() => setViewYear((y) => y + 1)} style={styles.calNavBtn}><Text style={[styles.calNavText, { color: C.primary }]}>››</Text></TouchableOpacity>
            </View>
            <View style={styles.calNavRow}>
              <TouchableOpacity onPress={prevMonth} style={styles.calNavBtn}><Text style={[styles.calNavText, { color: C.primary }]}>‹</Text></TouchableOpacity>
              <Text style={[styles.calMonthText, { color: C.textPrimary }]}>{MONTHS[viewMonth]}</Text>
              <TouchableOpacity onPress={nextMonth} style={styles.calNavBtn}><Text style={[styles.calNavText, { color: C.primary }]}>›</Text></TouchableOpacity>
            </View>
            <View style={styles.calWeekRow}>
              {DAYS_OF_WEEK.map((d) => <Text key={d} style={[styles.calDayHeader, { color: C.textMuted }]}>{d}</Text>)}
            </View>
            <View style={styles.calGrid}>
              {cells.map((cell, i) => {
                if (cell === null) return <View key={`e${i}`} style={styles.calCell} />;
                const isSelected = !!(isCurrentMonth && cell === selectedDay);
                const isTodayCell = cell === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();
                return (
                  <TouchableOpacity key={`d${cell}`}
                    style={[styles.calCell, isTodayCell && [styles.calCellToday, { borderColor: C.primary }], isSelected && [styles.calCellSelected, { backgroundColor: C.primary }]]}
                    onPress={() => { onChange(`${viewYear}-${pad(viewMonth + 1)}-${pad(cell)}`); onClose(); }}
                  >
                    <Text style={[styles.calDayText, { color: isSelected ? '#fff' : isTodayCell ? C.primary : C.textPrimary }]}>{cell}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity style={[styles.calCancelBtn, { borderTopColor: C.border }]} onPress={onClose}>
              <Text style={[styles.calCancelText, { color: C.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Nationality picker ───────────────────────────────────
function NationalityPicker({ visible, value, onChange, onClose }: {
  visible: boolean; value: string; onChange: (v: string) => void; onClose: () => void;
}) {
  const C = useColors();
  const [search, setSearch] = useState('');
  const filtered = search.trim() ? NATIONALITIES.filter((n) => n.toLowerCase().includes(search.toLowerCase())) : NATIONALITIES;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.natOverlay, { backgroundColor: 'rgba(0,0,0,0.55)' }]}>
        <View style={[styles.natModal, { backgroundColor: C.surface }]}>
          <View style={[styles.natHeader, { borderBottomColor: C.border }]}>
            <Text style={[styles.natTitle, { color: C.textPrimary }]}>Select Nationality</Text>
            <TouchableOpacity onPress={onClose}><Text style={[styles.natDone, { color: C.primary }]}>Done</Text></TouchableOpacity>
          </View>
          <View style={[styles.natSearchWrap, { borderBottomColor: C.border }]}>
            <TextInput style={[styles.natSearch, { color: C.textPrimary, backgroundColor: C.surfaceAlt }]}
              placeholder="Search..." placeholderTextColor={C.textMuted} value={search} onChangeText={setSearch} autoFocus />
          </View>
          <FlatList
            data={filtered} keyExtractor={(item) => item} keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity style={[styles.natItem, { borderBottomColor: C.border }, value === item && { backgroundColor: 'rgba(59,130,246,0.08)' }]}
                onPress={() => { onChange(item); onClose(); }}>
                <Text style={[styles.natItemText, { color: value === item ? C.primary : C.textPrimary }]}>{item}</Text>
                {value === item && <Text style={{ color: C.primary, fontSize: 16 }}>✓</Text>}
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

// ─── Helper components ────────────────────────────────────
function SectionLabel({ title }: { title: string }) {
  const C = useColors();
  return <Text style={[styles.sectionLabel, { color: C.textMuted }]}>{title}</Text>;
}

function InfoRow({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  const C = useColors();
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>{icon}</View>
      <View style={styles.infoContent}>
        <Text style={[styles.infoLabel, { color: C.textMuted }]}>{label}</Text>
        <Text style={[styles.infoValue, { color: C.textPrimary }]} numberOfLines={2}>{value || '—'}</Text>
      </View>
    </View>
  );
}

function EditableField({ label, value, onChangeText, placeholder, keyboardType, multiline, icon }: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; keyboardType?: any; multiline?: boolean; icon: React.ReactNode;
}) {
  const C = useColors();
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: C.textSecondary }]}>{label}</Text>
      <View style={[styles.fieldInput, { borderColor: C.border, backgroundColor: C.surfaceAlt }, multiline && { height: 88, alignItems: 'flex-start', paddingTop: Spacing.sm }]}>
        <View style={styles.fieldIcon}>{icon}</View>
        <TextInput
          style={[styles.fieldText, { color: C.textPrimary }, multiline && styles.fieldTextMulti]}
          value={value} onChangeText={onChangeText}
          placeholder={placeholder ?? label} placeholderTextColor={C.textMuted}
          keyboardType={keyboardType} multiline={multiline}
          numberOfLines={multiline ? 3 : 1}
          autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
        />
      </View>
    </View>
  );
}

function ChipRow({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  const C = useColors();
  return (
    <View style={styles.chipRow}>
      {options.map((opt) => (
        <TouchableOpacity key={opt}
          style={[styles.chip, { backgroundColor: C.surface, borderColor: C.border }, value === opt && { backgroundColor: 'rgba(59,130,246,0.12)', borderColor: C.primary }]}
          onPress={() => onChange(opt)}>
          <Text style={[styles.chipText, { color: value === opt ? C.primary : C.textSecondary }]}>{opt}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────
export default function ProfileScreen() {
  const t = useThemedStyles();
  const { user, setUser }   = useAuthStore();
  const queryClient         = useQueryClient();
  const { edit: editParam } = useLocalSearchParams<{ edit?: string }>();
  const [editing,  setEditing]  = useState(editParam === 'true');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [showCal,  setShowCal]  = useState(false);
  const [showNat,  setShowNat]  = useState(false);

  const [form, setForm] = useState({
    full_name:          user?.full_name          ?? '',
    phone:              user?.phone              ?? '',
    gender:             user?.gender             ?? '',
    date_of_birth:      user?.date_of_birth ? user.date_of_birth.split('T')[0] : '',
    nationality:        user?.nationality        ?? '',
    emergency_contact:  user?.emergency_contact  ?? '',
    blood_group:        user?.blood_group        ?? '',
    medical_conditions: user?.medical_conditions ?? '',
    allergies:          user?.allergies          ?? '',
  });

  const setFullName          = (v: string) => setForm((p) => ({ ...p, full_name:          v }));
  const setPhone             = (v: string) => setForm((p) => ({ ...p, phone:              v }));
  const setGender            = (v: string) => setForm((p) => ({ ...p, gender:             v }));
  const setDateOfBirth       = (v: string) => setForm((p) => ({ ...p, date_of_birth:      v }));
  const setNationality       = (v: string) => setForm((p) => ({ ...p, nationality:        v }));
  const setEmergencyContact  = (v: string) => setForm((p) => ({ ...p, emergency_contact:  v }));
  const setBloodGroup        = (v: string) => setForm((p) => ({ ...p, blood_group:        v }));
  const setMedicalConditions = (v: string) => setForm((p) => ({ ...p, medical_conditions: v }));
  const setAllergies         = (v: string) => setForm((p) => ({ ...p, allergies:          v }));

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, string> = {};
      Object.entries(form).forEach(([k, v]) => { if (v.trim() !== '') payload[k] = v.trim(); });
      await authApi.updateProfile(payload as Partial<User>);
      return authApi.me();
    },
    onSuccess: (updatedUser) => {
      setUser(updatedUser);
      queryClient.setQueryData(['auth', 'me'], updatedUser);
      if (updatedUser.preferred_language) i18n.setLanguage(updatedUser.preferred_language);
      setEditing(false);
      Alert.alert('Saved', 'Profile updated successfully.');
    },
    onError: (err: any) => {
      const detail = err?.response?.data?.detail;
      Alert.alert('Save Failed', typeof detail === 'string' ? detail : `Error ${err?.response?.status ?? 'unknown'}`);
    },
  });

  const handlePickPhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission Required', 'Allow photo access to update your profile photo.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      const asset    = result.assets[0];
      const mimeType = asset.mimeType ?? 'image/jpeg';
      setPhotoUri(asset.uri);
      try {
        const upload = await mediaApi.requestUpload({ media_type: 'PROFILE_PHOTO', content_type: mimeType, file_size_bytes: asset.fileSize ?? 500_000 });
        const response = await fetch(asset.uri); const blob = await response.blob();
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest(); xhr.open('PUT', upload.upload_url);
          xhr.setRequestHeader('Content-Type', mimeType);
          xhr.onreadystatechange = () => { if (xhr.readyState !== 4) return; xhr.status === 200 ? resolve() : reject(new Error(`S3 ${xhr.status}`)); };
          xhr.onerror = () => reject(new Error('XHR error')); xhr.send(blob);
        });
        await mediaApi.confirmUpload(upload.s3_key, 'PROFILE_PHOTO');
        Alert.alert('Photo Updated', 'Profile photo saved.');
      } catch (err) {
        setPhotoUri(null); Alert.alert('Upload Failed', 'Could not upload photo. Please try again.');
      }
    }
  }, []);

  const handleCancel = () => {
    setForm({
      full_name: user?.full_name ?? '', phone: user?.phone ?? '', gender: user?.gender ?? '',
      date_of_birth: user?.date_of_birth ? user.date_of_birth.split('T')[0] : '',
      nationality: user?.nationality ?? '', emergency_contact: user?.emergency_contact ?? '',
      blood_group: user?.blood_group ?? '', medical_conditions: user?.medical_conditions ?? '', allergies: user?.allergies ?? '',
    });
    setEditing(false);
  };

  const langLabel: Record<UserLanguage, string> = { en: 'English', hi: 'हिंदी', kn: 'ಕನ್ನಡ', te: 'తెలుగు', ta: 'தமிழ்', ml: 'മലയാളം' };
  const verifiedSince = user?.created_at ? format(new Date(user.created_at), 'MMM yyyy') : null;

  return (
    <View style={[styles.root, t.bg]}>
      <Header title="My Profile" showBack
        rightEl={
          editing ? (
            <TouchableOpacity style={styles.saveHeaderBtn} onPress={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <ActivityIndicator size="small" color="#3B82F6" /> : <Text style={styles.saveHeaderBtnText}>Save</Text>}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.editHeaderBtn} onPress={() => setEditing(true)}>
              <Icon.Edit size={16} color="#3B82F6" />
            </TouchableOpacity>
          )
        }
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Avatar */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.avatarSection}>
          <TouchableOpacity style={styles.avatarWrap} onPress={editing ? handlePickPhoto : undefined} activeOpacity={editing ? 0.75 : 1}>
            {photoUri ? <Image source={{ uri: photoUri }} style={styles.avatarImage} />
              : <Avatar name={user?.full_name} size={88} />}
            {editing && <View style={styles.avatarOverlay}><Icon.Camera size={22} color="#fff" /></View>}
          </TouchableOpacity>
          <View style={styles.avatarMeta}>
            <Text style={[styles.avatarName, t.textPrimary]}>{user?.full_name ?? 'Tourist'}</Text>
            <Text style={[styles.avatarEmail, t.textMuted]}>{user?.email}</Text>
            <View style={styles.avatarBadges}>
              {user?.is_verified && <Badge label="Verified" variant="success" size="sm" dot />}
              <Badge label={user?.role ?? 'TOURIST'} variant="info" size="sm" />
              {verifiedSince && <Badge label={`Since ${verifiedSince}`} variant="muted" size="sm" />}
            </View>
          </View>
        </Animated.View>

        {/* Personal Info */}
        <Animated.View entering={FadeInDown.duration(400).delay(80)}>
          <SectionLabel title="Personal Information" />
          <Card>
            {editing ? (
              <>
                <EditableField label="Full Name" value={form.full_name} onChangeText={setFullName} placeholder="John Doe" icon={<Icon.User size={16} color={t.C.textMuted} />} />
                <View style={[styles.fieldDivider, { backgroundColor: t.C.border }]} />
                <EditableField label="Phone Number" value={form.phone} onChangeText={setPhone} placeholder="+91 98765 43210" keyboardType="phone-pad" icon={<Icon.Phone size={16} color={t.C.textMuted} />} />
                <View style={[styles.fieldDivider, { backgroundColor: t.C.border }]} />

                {/* DOB — Calendar */}
                <View style={styles.field}>
                  <Text style={[styles.fieldLabel, { color: t.C.textSecondary }]}>Date of Birth</Text>
                  <TouchableOpacity style={[styles.pickerBtn, { backgroundColor: t.C.surfaceAlt, borderColor: t.C.border }]} onPress={() => setShowCal(true)}>
                    <Icon.Clock size={16} color={t.C.textMuted} />
                    <Text style={[styles.pickerBtnText, { color: form.date_of_birth ? t.C.textPrimary : t.C.textMuted }]}>
                      {form.date_of_birth || 'Select date of birth'}
                    </Text>
                    <Text style={[styles.pickerArrow, { color: t.C.textMuted }]}>›</Text>
                  </TouchableOpacity>
                  <CalendarPicker visible={showCal} value={form.date_of_birth} onChange={(d) => { setDateOfBirth(d); setShowCal(false); }} onClose={() => setShowCal(false)} />
                </View>
                <View style={[styles.fieldDivider, { backgroundColor: t.C.border }]} />

                {/* Nationality — Dropdown */}
                <View style={styles.field}>
                  <Text style={[styles.fieldLabel, { color: t.C.textSecondary }]}>Nationality</Text>
                  <TouchableOpacity style={[styles.pickerBtn, { backgroundColor: t.C.surfaceAlt, borderColor: t.C.border }]} onPress={() => setShowNat(true)}>
                    <Icon.Globe size={16} color={t.C.textMuted} />
                    <Text style={[styles.pickerBtnText, { color: form.nationality ? t.C.textPrimary : t.C.textMuted }]}>
                      {form.nationality || 'Select nationality'}
                    </Text>
                    <Text style={[styles.pickerArrow, { color: t.C.textMuted }]}>›</Text>
                  </TouchableOpacity>
                  <NationalityPicker visible={showNat} value={form.nationality} onChange={(v) => { setNationality(v); setShowNat(false); }} onClose={() => setShowNat(false)} />
                </View>
                <View style={[styles.fieldDivider, { backgroundColor: t.C.border }]} />

                <View style={styles.field}>
                  <Text style={[styles.fieldLabel, { color: t.C.textSecondary }]}>Gender</Text>
                  <ChipRow options={GENDERS} value={form.gender} onChange={setGender} />
                </View>
              </>
            ) : (
              <>
                <InfoRow label="Full Name"    value={user?.full_name  ?? ''} icon={<Icon.User  size={16} color={t.C.textMuted} />} />
                <View style={[styles.fieldDivider, { backgroundColor: t.C.border }]} />
                <InfoRow label="Phone"        value={user?.phone      ?? ''} icon={<Icon.Phone size={16} color={t.C.textMuted} />} />
                <View style={[styles.fieldDivider, { backgroundColor: t.C.border }]} />
                <InfoRow label="Gender"       value={user?.gender     ?? ''} icon={<Icon.User  size={16} color={t.C.textMuted} />} />
                <View style={[styles.fieldDivider, { backgroundColor: t.C.border }]} />
                <InfoRow label="Date of Birth" value={user?.date_of_birth ? format(new Date(user.date_of_birth), 'MMM d, yyyy') : ''} icon={<Icon.Clock size={16} color={t.C.textMuted} />} />
                <View style={[styles.fieldDivider, { backgroundColor: t.C.border }]} />
                <InfoRow label="Nationality"  value={user?.nationality ?? ''} icon={<Icon.Globe size={16} color={t.C.textMuted} />} />
              </>
            )}
          </Card>
        </Animated.View>

        {/* Account */}
        <Animated.View entering={FadeInDown.duration(400).delay(140)}>
          <SectionLabel title="Account" />
          <Card>
            <InfoRow label="Email Address"      value={user?.email ?? ''} icon={<Icon.Lock size={16} color={t.C.textMuted} />} />
            <View style={[styles.fieldDivider, { backgroundColor: t.C.border }]} />
            <InfoRow label="Preferred Language" value={langLabel[(user?.preferred_language as UserLanguage) ?? 'en']} icon={<Icon.Globe size={16} color={t.C.textMuted} />} />
            <View style={[styles.fieldDivider, { backgroundColor: t.C.border }]} />
            <InfoRow label="Member Since" value={user?.created_at ? format(new Date(user.created_at), 'MMM d, yyyy') : ''} icon={<Icon.CheckCircle size={16} color="#10B981" />} />
          </Card>
        </Animated.View>

        {/* Medical */}
        <Animated.View entering={FadeInDown.duration(400).delay(200)}>
          <SectionLabel title="Medical & Emergency" />
          <Card>
            {editing ? (
              <>
                <EditableField label="Emergency Contact" value={form.emergency_contact} onChangeText={setEmergencyContact} placeholder="+91 98765 43210" keyboardType="phone-pad" icon={<Icon.Phone size={16} color="#EF4444" />} />
                <View style={[styles.fieldDivider, { backgroundColor: t.C.border }]} />
                <View style={styles.field}>
                  <Text style={[styles.fieldLabel, { color: t.C.textSecondary }]}>Blood Group</Text>
                  <ChipRow options={BLOOD_GROUPS} value={form.blood_group} onChange={setBloodGroup} />
                </View>
                <View style={[styles.fieldDivider, { backgroundColor: t.C.border }]} />
                <EditableField label="Medical Conditions" value={form.medical_conditions} onChangeText={setMedicalConditions} placeholder="e.g. Diabetes, Hypertension..." multiline icon={<Icon.Activity size={16} color={t.C.textMuted} />} />
                <View style={[styles.fieldDivider, { backgroundColor: t.C.border }]} />
                <EditableField label="Allergies" value={form.allergies} onChangeText={setAllergies} placeholder="e.g. Penicillin, Pollen..." multiline icon={<Icon.AlertTriangle size={16} color={t.C.textMuted} />} />
              </>
            ) : (
              <>
                <View style={styles.medicalAlert}>
                  <Icon.Shield size={14} color="#3B82F6" />
                  <Text style={[styles.medicalAlertText, t.textSecondary]}>Shared only with emergency responders during incidents</Text>
                </View>
                <View style={[styles.fieldDivider, { backgroundColor: t.C.border }]} />
                <InfoRow label="Emergency Contact"  value={user?.emergency_contact  ?? ''} icon={<Icon.Phone size={16} color="#EF4444" />} />
                <View style={[styles.fieldDivider, { backgroundColor: t.C.border }]} />
                <InfoRow label="Blood Group"        value={user?.blood_group        ?? ''} icon={<Icon.Activity size={16} color="#EF4444" />} />
                <View style={[styles.fieldDivider, { backgroundColor: t.C.border }]} />
                <InfoRow label="Medical Conditions" value={user?.medical_conditions ?? 'None specified'} icon={<Icon.Activity size={16} color={t.C.textMuted} />} />
                <View style={[styles.fieldDivider, { backgroundColor: t.C.border }]} />
                <InfoRow label="Allergies"          value={user?.allergies          ?? 'None specified'} icon={<Icon.AlertTriangle size={16} color={t.C.textMuted} />} />
              </>
            )}
          </Card>
        </Animated.View>

        {/* Edit actions */}
        {editing && (
          <Animated.View entering={FadeInDown.duration(300)} style={styles.editActions}>
            <TouchableOpacity style={[styles.cancelBtn, t.surface, t.border]} onPress={handleCancel}>
              <Icon.X size={16} color={t.C.textSecondary} />
              <Text style={[styles.cancelBtnText, t.textSecondary]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.saveBtn, saveMutation.isPending && styles.btnDisabled]} onPress={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <ActivityIndicator size="small" color="#fff" />
                : <><Icon.CheckCircle size={16} color="#fff" /><Text style={styles.saveBtnText}>Save Changes</Text></>}
            </TouchableOpacity>
          </Animated.View>
        )}

        {!editing && (
          <Animated.View entering={FadeInDown.duration(400).delay(260)}>
            <TouchableOpacity style={[styles.settingsLink, t.surface, t.border]} onPress={() => router.push('/settings')} activeOpacity={0.8}>
              <Icon.Settings size={18} color={t.C.textSecondary} />
              <Text style={[styles.settingsLinkText, t.textSecondary]}>Change password, language, or delete account</Text>
              <Icon.ChevronRight size={16} color={t.C.textMuted} />
            </TouchableOpacity>
          </Animated.View>
        )}

        <View style={{ height: Spacing['4xl'] }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:          { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.base, paddingBottom: Spacing['4xl'] },
  saveHeaderBtn: { paddingHorizontal: Spacing.sm, paddingVertical: 4, backgroundColor: 'rgba(59,130,246,0.12)', borderRadius: Radius.md, borderWidth: 1, borderColor: 'rgba(59,130,246,0.3)' },
  saveHeaderBtnText: { fontSize: Typography.sm, fontFamily: 'SpaceGrotesk_600SemiBold', color: '#3B82F6' },
  editHeaderBtn: { width: 36, height: 36, borderRadius: Radius.md, backgroundColor: 'rgba(59,130,246,0.08)', borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)', alignItems: 'center', justifyContent: 'center' },
  avatarSection: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.md },
  avatarWrap:    { position: 'relative' },
  avatarImage:   { width: 88, height: 88, borderRadius: 26, borderWidth: 2, borderColor: '#3B82F6' },
  avatarOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 26, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  avatarMeta:    { alignItems: 'center', gap: Spacing.xs },
  avatarName:    { fontSize: Typography['2xl'], fontFamily: 'SpaceGrotesk_700Bold' },
  avatarEmail:   { fontSize: Typography.sm,    fontFamily: 'Inter_400Regular' },
  avatarBadges:  { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: Spacing.xs, marginTop: 4 },
  sectionLabel:  { fontSize: Typography.xs, fontFamily: 'SpaceGrotesk_700Bold', letterSpacing: 0.8, textTransform: 'uppercase', marginTop: Spacing.base, marginBottom: Spacing.sm },
  infoRow:       { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, paddingVertical: Spacing.sm },
  infoIcon:      { width: 28, alignItems: 'center', paddingTop: 2 },
  infoContent:   { flex: 1 },
  infoLabel:     { fontSize: Typography.xs, fontFamily: 'Inter_400Regular', marginBottom: 2 },
  infoValue:     { fontSize: Typography.sm, fontFamily: 'Inter_500Medium', lineHeight: 20 },
  field:         { gap: Spacing.xs, paddingVertical: Spacing.sm },
  fieldLabel:    { fontSize: Typography.xs, fontFamily: 'Inter_500Medium', letterSpacing: 0.3 },
  fieldInput:    { flexDirection: 'row', alignItems: 'center', borderRadius: Radius.lg, borderWidth: 1, paddingHorizontal: Spacing.md, minHeight: 48, gap: Spacing.sm },
  fieldIcon:     { width: 20, alignItems: 'center' },
  fieldText:     { flex: 1, fontFamily: 'Inter_400Regular', fontSize: Typography.sm },
  fieldTextMulti:{ textAlignVertical: 'top', paddingVertical: Spacing.xs },
  fieldDivider:  { height: 1 },
  pickerBtn:     { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderRadius: Radius.lg, borderWidth: 1, paddingHorizontal: Spacing.md, height: 48 },
  pickerBtnText: { flex: 1, fontSize: Typography.sm, fontFamily: 'Inter_400Regular' },
  pickerArrow:   { fontSize: 18 },
  chipRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  chip:     { paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: Radius.full, borderWidth: 1.5 },
  chipText: { fontSize: Typography.xs, fontFamily: 'Inter_500Medium' },
  medicalAlert: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: 'rgba(59,130,246,0.06)', borderRadius: Radius.md, padding: Spacing.sm, borderWidth: 1, borderColor: 'rgba(59,130,246,0.15)', marginBottom: Spacing.xs },
  medicalAlertText: { flex: 1, fontSize: Typography.xs, fontFamily: 'Inter_400Regular' },
  editActions:  { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.base },
  cancelBtn:    { flex: 1, height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, borderRadius: Radius.lg, borderWidth: 1 },
  cancelBtnText:{ fontSize: Typography.sm, fontFamily: 'Inter_500Medium' },
  saveBtn:      { flex: 2, height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, borderRadius: Radius.lg, backgroundColor: '#3B82F6' },
  saveBtnText:  { fontSize: Typography.sm, fontFamily: 'SpaceGrotesk_600SemiBold', color: '#fff' },
  btnDisabled:  { opacity: 0.55 },
  settingsLink: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderRadius: Radius.xl, borderWidth: 1, padding: Spacing.md, marginTop: Spacing.base },
  settingsLinkText: { flex: 1, fontSize: Typography.sm, fontFamily: 'Inter_400Regular' },
  // Calendar
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  calModal:     { width: 320, borderRadius: Radius.xl, borderWidth: 1, overflow: 'hidden', paddingHorizontal: Spacing.base, paddingTop: Spacing.md },
  calNavRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.xs },
  calNavBtn:    { padding: Spacing.sm },
  calNavText:   { fontSize: 20, fontFamily: 'SpaceGrotesk_700Bold' },
  calYearText:  { fontSize: Typography.xl, fontFamily: 'SpaceGrotesk_700Bold' },
  calMonthText: { fontSize: Typography.md,  fontFamily: 'SpaceGrotesk_600SemiBold' },
  calWeekRow:   { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 4 },
  calDayHeader: { width: 36, textAlign: 'center', fontSize: Typography.xs, fontFamily: 'Inter_500Medium' },
  calGrid:      { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', paddingBottom: Spacing.sm },
  calCell:      { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, margin: 1 },
  calCellToday: { borderWidth: 1 },
  calCellSelected: {},
  calDayText:   { fontSize: Typography.sm, fontFamily: 'Inter_500Medium' },
  calCancelBtn: { borderTopWidth: 1, paddingVertical: Spacing.md, alignItems: 'center' },
  calCancelText:{ fontSize: Typography.sm, fontFamily: 'Inter_500Medium' },
  // Nationality
  natOverlay:   { flex: 1, justifyContent: 'flex-end' },
  natModal:     { height: '75%', borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, overflow: 'hidden' },
  natHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.base, paddingVertical: Spacing.md, borderBottomWidth: 1 },
  natTitle:     { fontSize: Typography.md, fontFamily: 'SpaceGrotesk_700Bold' },
  natDone:      { fontSize: Typography.base, fontFamily: 'Inter_500Medium' },
  natSearchWrap:{ paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm, borderBottomWidth: 1 },
  natSearch:    { height: 44, borderRadius: Radius.lg, paddingHorizontal: Spacing.md, fontFamily: 'Inter_400Regular', fontSize: Typography.sm },
  natItem:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.base, paddingVertical: Spacing.md, borderBottomWidth: 0.5 },
  natItemText:  { fontSize: Typography.base, fontFamily: 'Inter_400Regular' },
});
