// src/screens/DashboardScreen.tsx
// Professional Dashboard with Location Tracking

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import MapView from 'react-native-maps';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { useLocation } from '../context/LocationContext';
import incidentService from '../services/incidentService';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS } from '../constants/config';

type Props = NativeStackScreenProps<any, 'Dashboard'>;

export default function DashboardScreen({ navigation }: Props) {
  const { user, logout } = useAuth();
  const { currentLocation, isTracking, startTracking, stopTracking } = useLocation();
  const [pendingIncidents, setPendingIncidents] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingIncidents, setLoadingIncidents] = useState(false);

  useEffect(() => {
    loadPendingIncidents();
    // Auto-start location tracking
    if (!isTracking) {
      startTracking().catch((err) => console.error('Failed to start tracking:', err));
    }
  }, []);

  const loadPendingIncidents = async () => {
    try {
      setLoadingIncidents(true);
      const count = await incidentService.getPendingIncidentsCount();
      setPendingIncidents(count);
    } catch (error) {
      console.error('Failed to load incidents:', error);
    } finally {
      setLoadingIncidents(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadPendingIncidents();
    setRefreshing(false);
  };

  const handleLogout = () => {
    if (isTracking) {
      stopTracking();
    }
    logout();
  };

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
        
        {/* Welcome Header */}
        <View style={styles.welcomeCard}>
          <Text style={styles.greeting}>Hello, {user?.full_name || 'Tourist'}! 👋</Text>
          <Text style={styles.subGreeting}>Stay safe on your journey</Text>
        </View>

        {/* Location Status Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>📍 Location Status</Text>
            <View style={[styles.statusBadge, isTracking ? styles.statusActive : styles.statusInactive]}>
              <Text style={styles.statusText}>{isTracking ? 'Tracking' : 'Inactive'}</Text>
            </View>
          </View>
          
          {currentLocation ? (
            <View style={styles.locationInfo}>
              <Text style={styles.locationLabel}>Current Location:</Text>
              <Text style={styles.locationText}>
                Lat: {currentLocation.latitude.toFixed(6)}
              </Text>
              <Text style={styles.locationText}>
                Lng: {currentLocation.longitude.toFixed(6)}
              </Text>
              {currentLocation.accuracy && (
                <Text style={styles.accuracyText}>
                  Accuracy: ±{currentLocation.accuracy.toFixed(0)}m
                </Text>
              )}
            </View>
          ) : (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={styles.loadingText}>Getting your location...</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.smallButton, isTracking && styles.smallButtonSecondary]}
            onPress={isTracking ? stopTracking : () => startTracking()}>
            <Text style={styles.smallButtonText}>
              {isTracking ? 'Stop Tracking' : 'Start Tracking'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>

        {/* SOS Button */}
        <TouchableOpacity
          style={styles.sosCard}
          onPress={() => navigation.navigate('SOS')}
          activeOpacity={0.9}>
          <View style={styles.sosIcon}>
            <Text style={styles.sosIconText}>🚨</Text>
          </View>
          <View style={styles.sosContent}>
            <Text style={styles.sosTitle}>Emergency SOS</Text>
            <Text style={styles.sosSubtitle}>Send instant alert to authorities</Text>
          </View>
        </TouchableOpacity>

        {/* Other Actions */}
        <View style={styles.actionsGrid}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('Profile')}>
            <Text style={styles.actionIcon}>👤</Text>
            <Text style={styles.actionTitle}>My Profile</Text>
            <Text style={styles.actionSubtitle}>Update info</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('MyReports')}>
            <Text style={styles.actionIcon}>📋</Text>
            <Text style={styles.actionTitle}>My Reports</Text>
            {pendingIncidents > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{pendingIncidents}</Text>
              </View>
            )}
            <Text style={styles.actionSubtitle}>View incidents</Text>
          </TouchableOpacity>
        </View>

        {/* Info Cards */}
        <View style={styles.infoCard}>
          <Text style={styles.infoIcon}>ℹ️</Text>
          <Text style={styles.infoText}>
            Your location is being tracked for your safety. Data is encrypted and only shared with authorities in emergencies.
          </Text>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>

        <View style={{ height: SPACING['2xl'] }} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  welcomeCard: { backgroundColor: COLORS.primary, padding: SPACING.lg, paddingTop: SPACING.xl, paddingBottom: SPACING.xl },
  greeting: { fontSize: TYPOGRAPHY.fontSize['2xl'], fontWeight: TYPOGRAPHY.fontWeight.bold, color: '#FFFFFF' },
  subGreeting: { fontSize: TYPOGRAPHY.fontSize.base, color: '#FFFFFF', opacity: 0.9, marginTop: SPACING.xs },
  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.lg, margin: SPACING.md, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  cardTitle: { fontSize: TYPOGRAPHY.fontSize.lg, fontWeight: TYPOGRAPHY.fontWeight.bold, color: COLORS.text },
  statusBadge: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, borderRadius: RADIUS.full },
  statusActive: { backgroundColor: '#D1FAE5' },
  statusInactive: { backgroundColor: '#FEE2E2' },
  statusText: { fontSize: TYPOGRAPHY.fontSize.xs, fontWeight: TYPOGRAPHY.fontWeight.semibold },
  locationInfo: { marginBottom: SPACING.md },
  locationLabel: { fontSize: TYPOGRAPHY.fontSize.sm, fontWeight: TYPOGRAPHY.fontWeight.semibold, color: COLORS.text, marginBottom: SPACING.xs },
  locationText: { fontSize: TYPOGRAPHY.fontSize.sm, color: COLORS.textSecondary, marginTop: 2 },
  accuracyText: { fontSize: TYPOGRAPHY.fontSize.xs, color: COLORS.textSecondary, marginTop: SPACING.xs, fontStyle: 'italic' },
  loadingContainer: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md },
  loadingText: { marginLeft: SPACING.md, color: COLORS.textSecondary },
  smallButton: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, padding: SPACING.sm, alignItems: 'center' },
  smallButtonSecondary: { backgroundColor: COLORS.textSecondary },
  smallButtonText: { color: '#FFFFFF', fontSize: TYPOGRAPHY.fontSize.sm, fontWeight: TYPOGRAPHY.fontWeight.semibold },
  sectionTitle: { fontSize: TYPOGRAPHY.fontSize.lg, fontWeight: TYPOGRAPHY.fontWeight.bold, color: COLORS.text, marginHorizontal: SPACING.md, marginTop: SPACING.md, marginBottom: SPACING.sm },
  sosCard: { backgroundColor: COLORS.sos, borderRadius: RADIUS.lg, padding: SPACING.lg, margin: SPACING.md, flexDirection: 'row', alignItems: 'center', shadowColor: COLORS.sos, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  sosIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginRight: SPACING.md },
  sosIconText: { fontSize: 28 },
  sosContent: { flex: 1 },
  sosTitle: { fontSize: TYPOGRAPHY.fontSize.xl, fontWeight: TYPOGRAPHY.fontWeight.bold, color: '#FFFFFF' },
  sosSubtitle: { fontSize: TYPOGRAPHY.fontSize.sm, color: '#FFFFFF', opacity: 0.9, marginTop: 2 },
  actionsGrid: { flexDirection: 'row', marginHorizontal: SPACING.md, gap: SPACING.md },
  actionCard: { flex: 1, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.md, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  actionIcon: { fontSize: 32, marginBottom: SPACING.sm },
  actionTitle: { fontSize: TYPOGRAPHY.fontSize.base, fontWeight: TYPOGRAPHY.fontWeight.semibold, color: COLORS.text, textAlign: 'center' },
  actionSubtitle: { fontSize: TYPOGRAPHY.fontSize.xs, color: COLORS.textSecondary, marginTop: 2, textAlign: 'center' },
  badge: { position: 'absolute', top: SPACING.sm, right: SPACING.sm, backgroundColor: COLORS.error, borderRadius: RADIUS.full, width: 20, height: 20, justifyContent: 'center', alignItems: 'center' },
  badgeText: { color: '#FFFFFF', fontSize: TYPOGRAPHY.fontSize.xs, fontWeight: TYPOGRAPHY.fontWeight.bold },
  infoCard: { backgroundColor: '#EFF6FF', borderRadius: RADIUS.lg, padding: SPACING.md, margin: SPACING.md, marginTop: SPACING.lg, flexDirection: 'row', alignItems: 'flex-start' },
  infoIcon: { fontSize: 20, marginRight: SPACING.sm },
  infoText: { flex: 1, fontSize: TYPOGRAPHY.fontSize.sm, color: COLORS.text, lineHeight: 20 },
  logoutButton: { backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: COLORS.error, borderRadius: RADIUS.md, padding: SPACING.md, margin: SPACING.md, marginTop: SPACING.lg, alignItems: 'center' },
  logoutButtonText: { color: COLORS.error, fontSize: TYPOGRAPHY.fontSize.base, fontWeight: TYPOGRAPHY.fontWeight.semibold },
});