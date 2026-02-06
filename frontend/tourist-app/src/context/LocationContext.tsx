// src/context/LocationContext.tsx
// Professional Location Context with real-time tracking

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import locationService from '../services/locationService';
import { LocationData, LocationContextType } from '../types';
import { SUCCESS_MESSAGES } from '../constants/config';

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Clean up tracking on unmount
   */
  useEffect(() => {
    return () => {
      if (isTracking) {
        locationService.stopTracking();
      }
    };
  }, [isTracking]);

  /**
   * Start location tracking
   */
  const startTracking = useCallback(async (): Promise<void> => {
    try {
      setError(null);

      // Check permissions
      const hasPermission = await locationService.hasPermissions();
      if (!hasPermission) {
        await locationService.requestPermissions();
      }

      // Get initial location
      const initialLocation = await locationService.getCurrentLocation();
      setCurrentLocation(initialLocation);

      // Start watching location
      await locationService.startTracking(
        (location) => {
          setCurrentLocation(location);
        },
        (err) => {
          setError(err.message);
        }
      );

      setIsTracking(true);
      console.log('Location tracking started');
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to start location tracking';
      setError(errorMessage);
      throw err;
    }
  }, []);

  /**
   * Stop location tracking
   */
  const stopTracking = useCallback((): void => {
    try {
      locationService.stopTracking();
      setIsTracking(false);
      console.log('Location tracking stopped');
    } catch (err: any) {
      console.error('Stop tracking error:', err);
    }
  }, []);

  /**
   * Update location once
   */
  const updateLocation = useCallback(async (): Promise<void> => {
    try {
      setError(null);

      const location = await locationService.getCurrentLocation();
      setCurrentLocation(location);

      // Send to server
      await locationService.updateLocationOnServer(location);
      
      console.log(SUCCESS_MESSAGES.LOCATION_UPDATED_SUCCESS);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to update location';
      setError(errorMessage);
      throw err;
    }
  }, []);

  /**
   * Clear error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value: LocationContextType = {
    currentLocation,
    isTracking,
    error,
    startTracking,
    stopTracking,
    updateLocation,
    clearError,
  };

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
};

/**
 * Custom hook to use Location context
 */
export const useLocation = (): LocationContextType => {
  const context = useContext(LocationContext);
  
  if (!context) {
    throw new Error('useLocation must be used within LocationProvider');
  }
  
  return context;
};

export default LocationContext;