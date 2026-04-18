import * as Location from 'expo-location';
import { locationApi } from '@/api/location';
import { logoutFlag } from '@/api/logoutFlag';
import { Config } from '@/constants/config';

let locationInterval: ReturnType<typeof setInterval> | null = null;

export const locationService = {
  async requestPermissions(): Promise<boolean> {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  },

  async getCurrentPosition(): Promise<{ latitude: number; longitude: number; accuracy: number | null }> {
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      accuracy: loc.coords.accuracy,
    };
  },

  async sendLocation(battery?: number): Promise<void> {
    if (logoutFlag.isLoggingOut) return;
    try {
      const pos = await locationService.getCurrentPosition();
      await locationApi.update({
        latitude: pos.latitude,
        longitude: pos.longitude,
        accuracy_meters: pos.accuracy ?? undefined,
        battery_percentage: battery ?? undefined,
      });
    } catch (e) {
      console.warn('[LocationService] Failed to send location:', e);
    }
  },

  startTracking(getBattery?: () => number | undefined): void {
    locationService.sendLocation(getBattery?.());
    locationInterval = setInterval(() => {
      locationService.sendLocation(getBattery?.());
    }, Config.LOCATION_UPDATE_INTERVAL);
  },

  stopTracking(): void {
    if (locationInterval) {
      clearInterval(locationInterval);
      locationInterval = null;
    }
  },
};