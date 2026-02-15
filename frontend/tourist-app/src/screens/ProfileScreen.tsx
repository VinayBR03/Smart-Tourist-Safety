// src/screens/ProfileScreen.tsx
// Profile View + Inline Edit UX

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  StatusBar,
} from 'react-native';
import { PencilLine } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS } from '../constants/config';

type Props = NativeStackScreenProps<any, 'Profile'>;

export default function ProfileScreen({ navigation }: Props) {
  const { user, updateProfile, logout, isLoading } = useAuth();

  const [editField, setEditField] = useState<string | null>(null);
  const [form, setForm] = useState<any>({});

  useEffect(() => {
    if (user) {
      setForm({
        full_name: user.full_name || '',
        phone: user.phone || '',
        emergency_contact: user.emergency_contact || '',
        blood_group: user.blood_group || '',
        gender: user.gender || '',
        nationality: user.nationality || '',
        date_of_birth: user.date_of_birth || '',
        medical_conditions: user.medical_conditions || '',
        allergies: user.allergies || '',
      });
    }
  }, [user]);

  const handleSaveField = async (field: string) => {
    try {
      await updateProfile({ [field]: form[field] });
      setEditField(null);
      Alert.alert('Updated', 'Profile updated successfully');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Update failed');
    }
  };

  const renderField = (
    label: string,
    field: string,
    multiline: boolean = false
  ) => {
    const value = form[field] || 'Not provided';

    return (
      <View style={styles.fieldCard}>
        <Text style={styles.label}>{label}</Text>

        {editField === field ? (
          <>
            <TextInput
              style={[styles.input, multiline && { height: 80 }]}
              value={form[field]}
              multiline={multiline}
              onChangeText={(text) =>
                setForm((prev: any) => ({ ...prev, [field]: text }))
              }
            />

            <View style={styles.editActions}>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={() => handleSaveField(field)}
                disabled={isLoading}>
                {isLoading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.saveText}>Save</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setEditField(null)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View style={styles.valueRow}>
            <Text style={styles.value}>{value}</Text>
            <TouchableOpacity onPress={() => setEditField(field)}>
              <PencilLine size={18} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
      <ScrollView style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(user?.full_name || user?.email || 'U')
                .charAt(0)
                .toUpperCase()}
            </Text>
          </View>
          <Text style={styles.email}>{user?.email}</Text>
        </View>

        {/* Personal Info */}
        <Text style={styles.sectionTitle}>Personal Information</Text>

        {renderField('Full Name', 'full_name')}
        {renderField('Phone Number', 'phone')}
        {renderField('Emergency Contact', 'emergency_contact')}
        {renderField('Blood Group', 'blood_group')}
        {renderField('Gender', 'gender')}
        {renderField('Nationality', 'nationality')}
        {renderField('Date of Birth', 'date_of_birth')}

        <Text style={styles.sectionTitle}>Medical Information</Text>

        {renderField('Medical Conditions', 'medical_conditions', true)}
        {renderField('Allergies', 'allergies', true)}

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton} onPress={logout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <View style={{ height: 60 }} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  header: {
    backgroundColor: COLORS.primary,
    padding: SPACING.xl,
    alignItems: 'center',
  },

  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },

  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.primary,
  },

  email: {
    color: '#FFF',
    fontSize: TYPOGRAPHY.fontSize.lg,
  },

  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: 'bold',
    marginTop: SPACING.lg,
    marginHorizontal: SPACING.lg,
  },

  fieldCard: {
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
  },

  label: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },

  valueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  value: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text,
  },

  editIcon: {
    fontSize: 18,
  },

  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginTop: 6,
    fontSize: TYPOGRAPHY.fontSize.base,
  },

  editActions: {
    flexDirection: 'row',
    marginTop: SPACING.sm,
  },

  saveBtn: {
    backgroundColor: COLORS.primary,
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    marginRight: SPACING.sm,
  },

  saveText: {
    color: '#FFF',
  },

  cancelBtn: {
    padding: SPACING.sm,
  },

  cancelText: {
    color: COLORS.textSecondary,
  },

  logoutButton: {
    margin: SPACING.lg,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 2,
    borderColor: COLORS.error,
    alignItems: 'center',
  },

  logoutText: {
    color: COLORS.error,
    fontWeight: 'bold',
  },
});
