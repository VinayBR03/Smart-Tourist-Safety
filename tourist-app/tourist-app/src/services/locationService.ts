// src/services/locationService.ts
// Professional location service with real-time tracking and geofencing

import * as Location from 'expo-location';
import apiClient from '../api/client';
import { LocationData, LocationUpdate, Coordinates } from '../types';
import { LOCATION_CONFIG, ERROR_MESSAGES } from '../constants/config';

class LocationService {
  private watchSubscription: Location.LocationSubscription | null = null;
  private lastUpdateTime: number = 0;
  private isTracking: boolean = false;

  /**
   * Request location permissions
   */
  async requestPermissions(): Promise<boolean> {
    try {
      const { status: foregroundStatus } = 
        await Location.requestForegroundPermissionsAsync();

      if (foregroundStatus !== 'granted') {
        throw new Error(ERROR_MESSAGES.LOCATION_PERMISSION_DENIED);
      }

      // Request background permissions (optional)
      const { status: backgroundStatus } = 
        await Location.requestBackgroundPermissionsAsync();

      if (backgroundStatus !== 'granted') {
        console.warn('Background location permission not granted');
      }

      return true;
    } catch (error) {
      console.error('Permission request error:', error);
      throw error;
    }
  }

  /**
   * Check if location permissions are granted
   */
  async hasPermissions(): Promise<boolean> {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Permission check error:', error);
      return false;
    }
  }

  /**
   * Get current location once
   */
  async getCurrentLocation(): Promise<LocationData> {
    try {
      // Check permissions
      const hasPermission = await this.hasPermissions();
      if (!hasPermission) {
        await this.requestPermissions();
      }

      // Get current position
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const locationData: LocationData = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy || undefined,
        altitude: location.coords.altitude || undefined,
        heading: location.coords.heading || undefined,
        speed: location.coords.speed || undefined,
        timestamp: location.timestamp,
      };

      return locationData;
    } catch (error) {
      console.error('Get current location error:', error);
      throw new Error(ERROR_MESSAGES.LOCATION_UNAVAILABLE);
    }
  }

  /**
   * Start watching location updates
   */
  async startTracking(
    onLocationUpdate: (location: LocationData) => void,
    onError?: (error: Error) => void
  ): Promise<void> {
    try {
      // Check if already tracking
      if (this.isTracking) {
        console.warn('Location tracking already started');
        return;
      }

      // Check permissions
      const hasPermission = await this.hasPermissions();
      if (!hasPermission) {
        await this.requestPermissions();
      }

      // Start watching position
      this.watchSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: LOCATION_CONFIG.UPDATE_INTERVAL,
          distanceInterval: LOCATION_CONFIG.DISTANCE_FILTER,
        },
        (location) => {
          const locationData: LocationData = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy || undefined,
            altitude: location.coords.altitude || undefined,
            heading: location.coords.heading || undefined,
            speed: location.coords.speed || undefined,
            timestamp: location.timestamp,
          };

          onLocationUpdate(locationData);

          // Automatically send to server every interval
          this.updateLocationOnServer(locationData).catch((error) => {
            console.error('Auto location update error:', error);
            onError?.(error);
          });
        }
      );

      this.isTracking = true;
      console.log('Location tracking started');
    } catch (error) {
      console.error('Start tracking error:', error);
      onError?.(error as Error);
      throw error;
    }
  }

  /**
   * Stop watching location updates
   */
  async stopTracking(): Promise<void> {
    try {
      if (this.watchSubscription) {
        this.watchSubscription.remove();
        this.watchSubscription = null;
        this.isTracking = false;
        console.log('Location tracking stopped');
      }
    } catch (error) {
      console.error('Stop tracking error:', error);
    }
  }

  /**
   * Check if currently tracking
   */
  isCurrentlyTracking(): boolean {
    return this.isTracking;
  }

  /**
   * Update location on server
   */
  async updateLocationOnServer(location: LocationData | Coordinates): Promise<void> {
    try {
      // Throttle updates to prevent too many requests
      const now = Date.now();
      if (now - this.lastUpdateTime < LOCATION_CONFIG.UPDATE_INTERVAL) {
        return;
      }

      const updateData: LocationUpdate = {
        latitude: location.latitude,
        longitude: location.longitude,
        timestamp: 'timestamp' in location ? location.timestamp : now,
      };

      await apiClient.post('/update', updateData);
      
      this.lastUpdateTime = now;
      console.log('Location updated on server:', updateData);
    } catch (error) {
      console.error('Update location on server error:', error);
      throw error;
    }
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  calculateDistance(coord1: Coordinates, coord2: Coordinates): number {
    const R = 6371e3; // Earth radius in meters
    const φ1 = (coord1.latitude * Math.PI) / 180;
    const φ2 = (coord2.latitude * Math.PI) / 180;
    const Δφ = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
    const Δλ = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }

  /**
   * Check if user is within geofence radius
   */
  isWithinGeofence(
    userLocation: Coordinates,
    center: Coordinates,
    radiusInMeters: number = LOCATION_CONFIG.GEOFENCE_RADIUS
  ): boolean {
    const distance = this.calculateDistance(userLocation, center);
    return distance <= radiusInMeters;
  }

  /**
   * Get address from coordinates (reverse geocoding)
   */
  async getAddressFromCoordinates(coordinates: Coordinates): Promise<string> {
    try {
      const [address] = await Location.reverseGeocodeAsync({
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
      });

      if (address) {
        const parts = [
          address.street,
          address.city,
          address.region,
          address.country,
        ].filter(Boolean);

        return parts.join(', ');
      }

      return 'Unknown location';
    } catch (error) {
      console.error('Reverse geocode error:', error);
      return 'Unknown location';
    }
  }

  /**
   * Get coordinates from address (geocoding)
   */
  async getCoordinatesFromAddress(address: string): Promise<Coordinates | null> {
    try {
      const [result] = await Location.geocodeAsync(address);

      if (result) {
        return {
          latitude: result.latitude,
          longitude: result.longitude,
        };
      }

      return null;
    } catch (error) {
      console.error('Geocode error:', error);
      return null;
    }
  }

  /**
   * Format coordinates for display
   */
  formatCoordinates(coordinates: Coordinates): string {
    return `${coordinates.latitude.toFixed(6)}°, ${coordinates.longitude.toFixed(6)}°`;
  }

  /**
   * Check if location services are enabled
   */
  async isLocationEnabled(): Promise<boolean> {
    try {
      return await Location.hasServicesEnabledAsync();
    } catch (error) {
      console.error('Check location enabled error:', error);
      return false;
    }
  }
}

// Export singleton instance
export const locationService = new LocationService();
export default locationService;