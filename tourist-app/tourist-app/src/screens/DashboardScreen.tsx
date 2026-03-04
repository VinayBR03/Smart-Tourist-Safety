// src/screens/DashboardScreen.tsx
// Professional Dashboard with Location Tracking + Map View

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
import MapView, { Marker } from 'react-native-maps';
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

  useEffect(() => {
    loadPendingIncidents();
    if (!isTracking) {
      startTracking().catch(console.error);
    }
  }, []);

  const loadPendingIncidents = async () => {
    try {
      const count = await incidentService.getMyIncidents();
      //setPendingIncidents(count);
      return count.filter(incident => incident.status === 'open').length;
    } catch (error) {
      console.error('Failed to load incidents:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadPendingIncidents();
    setRefreshing(false);
  };

  const handleLogout = () => {
    if (isTracking) stopTracking();
    logout();
  };

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }>

        {/* Welcome Header */}
        <View style={styles.welcomeCard}>
          <Text style={styles.greeting}>
            Hello, {user?.full_name || 'Tourist'}! 👋
          </Text>
          <Text style={styles.subGreeting}>Stay safe on your journey</Text>
        </View>

        {/* Map Preview */}
        <View style={styles.mapContainer}>
          {currentLocation ? (
            <MapView
              style={styles.map}
              initialRegion={{
                latitude: currentLocation.latitude,
                longitude: currentLocation.longitude,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
              }}
              showsUserLocation
              followsUserLocation>
              <Marker
                coordinate={{
                  latitude: currentLocation.latitude,
                  longitude: currentLocation.longitude,
                }}
                title="You are here"
              />
            </MapView>
          ) : (
            <View style={styles.mapLoading}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.mapLoadingText}>Loading map...</Text>
            </View>
          )}
        </View>

        {/* Location Status Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>📍 Location Status</Text>
            <View
              style={[
                styles.statusBadge,
                isTracking ? styles.statusActive : styles.statusInactive,
              ]}>
              <Text style={styles.statusText}>
                {isTracking ? 'Tracking' : 'Inactive'}
              </Text>
            </View>
          </View>

          {currentLocation ? (
            <View style={styles.locationInfo}>
              <Text style={styles.locationText}>
                Latitude: {currentLocation.latitude.toFixed(6)}
              </Text>
              <Text style={styles.locationText}>
                Longitude: {currentLocation.longitude.toFixed(6)}
              </Text>
              {currentLocation.accuracy && (
                <Text style={styles.accuracyText}>
                  Accuracy: ±{currentLocation.accuracy.toFixed(0)} m
                </Text>
              )}
            </View>
          ) : (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={styles.loadingText}>Getting your location...</Text>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.smallButton,
              isTracking && styles.smallButtonSecondary,
            ]}
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
          onPress={() => navigation.navigate('SOS')}>
          <Text style={styles.sosTitle}>🚨 Emergency SOS</Text>
          <Text style={styles.sosSubtitle}>
            Send instant alert to authorities
          </Text>
        </TouchableOpacity>

        {/* Action Grid */}
        <View style={styles.actionsGrid}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('Profile')}>
            <Text style={styles.actionIcon}>👤</Text>
            <Text style={styles.actionTitle}>My Profile</Text>
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
          </TouchableOpacity>
        </View>

        {/* Info */}
        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            Your location is securely tracked and shared only during emergencies.
          </Text>
        </View>


        <View style={{ height: SPACING['2xl'] }} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  welcomeCard: {
    backgroundColor: COLORS.primary,
    padding: SPACING.lg,
    paddingBottom: SPACING.xl,
  },

  greeting: {
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#FFF',
  },

  subGreeting: {
    color: '#FFF',
    opacity: 0.9,
    marginTop: 4,
  },

  mapContainer: {
    height: 200,
    margin: SPACING.md,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },

  map: {
    flex: 1,
  },

  mapLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
  },

  mapLoadingText: {
    marginTop: SPACING.sm,
    color: COLORS.textSecondary,
  },

  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    margin: SPACING.md,
  },

  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },

  cardTitle: {
    fontWeight: 'bold',
    fontSize: TYPOGRAPHY.fontSize.lg,
  },

  statusBadge: {
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.full,
  },

  statusActive: { backgroundColor: '#D1FAE5' },
  statusInactive: { backgroundColor: '#FEE2E2' },

  statusText: { fontSize: 12 },

  locationInfo: { marginBottom: SPACING.md },

  locationText: { color: COLORS.textSecondary },

  accuracyText: { fontSize: 12, fontStyle: 'italic' },

  loadingRow: { flexDirection: 'row', alignItems: 'center' },

  loadingText: { marginLeft: SPACING.sm },

  smallButton: {
    backgroundColor: COLORS.primary,
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },

  smallButtonSecondary: {
    backgroundColor: COLORS.textSecondary,
  },

  smallButtonText: { color: '#FFF' },

  sectionTitle: {
    marginLeft: SPACING.md,
    fontWeight: 'bold',
    fontSize: TYPOGRAPHY.fontSize.lg,
  },

  sosCard: {
    backgroundColor: COLORS.sos,
    margin: SPACING.md,
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
  },

  sosTitle: { color: '#FFF', fontWeight: 'bold', fontSize: 18 },
  sosSubtitle: { color: '#FFF', opacity: 0.9 },

  actionsGrid: {
    flexDirection: 'row',
    marginHorizontal: SPACING.md,
    gap: SPACING.md,
  },

  actionCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
  },

  actionIcon: { fontSize: 28 },
  actionTitle: { marginTop: 4 },

  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: COLORS.error,
    borderRadius: 10,
    paddingHorizontal: 6,
  },

  badgeText: { color: '#FFF', fontSize: 10 },

  infoCard: {
    backgroundColor: '#EFF6FF',
    margin: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
  },

  infoText: { fontSize: 13 },

});
