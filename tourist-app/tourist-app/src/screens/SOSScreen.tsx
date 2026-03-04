// src/screens/SOSScreen.tsx
// Professional SOS Screen with Real Location (Header removed + Scroll enabled)

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Animated,
  Vibration,
  ScrollView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useLocation } from '../context/LocationContext';
import incidentService from '../services/incidentService';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS, SUCCESS_MESSAGES } from '../constants/config';

type Props = NativeStackScreenProps<any, 'SOS'>;

export default function SOSScreen({ navigation }: Props) {
  const { currentLocation, updateLocation } = useLocation();
  const [sending, setSending] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [pulseAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    ).start();

    updateLocation().catch(console.error);
  }, []);

  useEffect(() => {
    if (countdown === null) return;

    if (countdown === 0) {
      sendSOS();
      return;
    }

    const timer = setTimeout(() => {
      setCountdown(countdown - 1);
      Vibration.vibrate(100);
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown]);

  const handleSOSPress = () => {
    Alert.alert(
      '🚨 Emergency SOS',
      'This will immediately alert authorities with your location. Are you in an emergency?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send SOS Now',
          style: 'destructive',
          onPress: () => setCountdown(3),
        },
      ]
    );
  };

  const sendSOS = async () => {
    if (!currentLocation) {
      Alert.alert('Error', 'Unable to get your location. Please try again.');
      setCountdown(null);
      return;
    }

    setSending(true);
    try {
      await incidentService.sendSOS(
        currentLocation.latitude,
        currentLocation.longitude,
        'Sent from mobile app'
      );

      Vibration.vibrate([0, 200, 100, 200]);

      Alert.alert(
        '✅ SOS Sent Successfully',
        SUCCESS_MESSAGES.SOS_SENT_SUCCESS,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error: any) {
      Alert.alert(
        'Failed to Send SOS',
        error.message || 'Please try again or contact emergency services directly.'
      );
    } finally {
      setSending(false);
      setCountdown(null);
    }
  };

  const cancelCountdown = () => {
    setCountdown(null);
    Vibration.cancel();
  };

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Location Status */}
      <View style={styles.locationCard}>
        <Text style={styles.locationTitle}>📍 Your Location</Text>
        {currentLocation ? (
          <>
            <Text style={styles.locationText}>
              Lat: {currentLocation.latitude.toFixed(6)}
            </Text>
            <Text style={styles.locationText}>
              Lng: {currentLocation.longitude.toFixed(6)}
            </Text>
            <Text style={styles.locationSuccess}>✅ Location acquired</Text>
          </>
        ) : (
          <View style={styles.locationLoading}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.locationLoadingText}>Getting your location...</Text>
          </View>
        )}
      </View>

      {/* SOS Button */}
      <View style={styles.sosContainer}>
        {countdown !== null ? (
          <View style={styles.countdownContainer}>
            <Text style={styles.countdownText}>{countdown}</Text>
            <Text style={styles.countdownLabel}>Sending SOS in...</Text>
            <TouchableOpacity style={styles.cancelButton} onPress={cancelCountdown}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <TouchableOpacity
              style={[
                styles.sosButton,
                (sending || !currentLocation) && styles.sosButtonDisabled,
              ]}
              onPress={handleSOSPress}
              disabled={sending || !currentLocation}
              activeOpacity={0.8}
            >
              {sending ? (
                <ActivityIndicator size="large" color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.sosButtonText}>SOS</Text>
                  <Text style={styles.sosButtonSubtext}>Press for Emergency</Text>
                </>
              )}
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>

      {/* Instructions */}
      <View style={styles.instructionsCard}>
        <Text style={styles.instructionsTitle}>When to use SOS:</Text>
        <Text style={styles.instructionItem}>• Medical emergency</Text>
        <Text style={styles.instructionItem}>• Threat to personal safety</Text>
        <Text style={styles.instructionItem}>• Witnessing a crime</Text>
        <Text style={styles.instructionItem}>• Lost in unfamiliar area</Text>
        <Text style={styles.instructionItem}>• Any life-threatening situation</Text>
      </View>

      {/* Emergency Contacts */}
      <View style={styles.emergencyCard}>
        <Text style={styles.emergencyTitle}>Emergency Contacts:</Text>
        <Text style={styles.emergencyText}>Police: 100 | Ambulance: 108</Text>
        <Text style={styles.emergencyText}>Fire: 101 | Women Helpline: 1091</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    padding: SPACING.lg,
    paddingBottom: 40,
    backgroundColor: COLORS.background,
  },

  locationCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
    elevation: 3,
  },

  locationTitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginBottom: SPACING.md,
  },

  locationText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.textSecondary,
  },

  locationSuccess: {
    marginTop: SPACING.sm,
    color: COLORS.success,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },

  locationLoading: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  locationLoadingText: {
    marginLeft: SPACING.md,
    color: COLORS.textSecondary,
  },

  sosContainer: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },

  sosButton: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: COLORS.sos,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 10,
  },

  sosButtonDisabled: {
    opacity: 0.5,
  },

  sosButtonText: {
    fontSize: 48,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#FFF',
  },

  sosButtonSubtext: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: '#FFF',
    marginTop: SPACING.sm,
  },

  countdownContainer: {
    alignItems: 'center',
  },

  countdownText: {
    fontSize: 80,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.sos,
  },

  countdownLabel: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    marginTop: SPACING.md,
  },

  cancelButton: {
    backgroundColor: COLORS.textSecondary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.md,
    marginTop: SPACING.lg,
  },

  cancelButtonText: {
    color: '#FFF',
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },

  instructionsCard: {
    backgroundColor: '#FFF7ED',
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },

  instructionsTitle: {
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    marginBottom: SPACING.sm,
  },

  instructionItem: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: 20,
  },

  emergencyCard: {
    backgroundColor: '#DBEAFE',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
  },

  emergencyTitle: {
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    marginBottom: SPACING.xs,
  },

  emergencyText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
});
