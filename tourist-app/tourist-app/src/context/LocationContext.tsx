import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Battery from 'expo-battery';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import apiClient from '../api/client';
import { STORAGE_KEYS } from '../constants/config';

const LOCATION_TASK_NAME = 'BACKGROUND_LOCATION_TASK';

type Mode = 'normal' | 'low_battery' | 'sos' | 'background';

type LocationType = {
  latitude: number;
  longitude: number;
  accuracy?: number;
};

interface LocationContextType {
  currentLocation: LocationType | null;
  isTracking: boolean;
  startTracking: () => Promise<void>;
  stopTracking: () => Promise<void>;
  setMode: (mode: Mode) => void;
  resetLocationState: () => Promise<void>;
}

const LocationContext = createContext<LocationContextType>({} as LocationContextType);

//
// ✅ BACKGROUND TASK (Only sends to backend)
//
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) return;

  const token = await AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  if (!token) return; // 🚨 Do nothing if logged out

  const { locations } = data as any;

  if (locations?.length > 0) {
    const loc = locations[0];

    try {
      await apiClient.post('/update', {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
    } catch {
      console.log('Background update failed');
    }
  }
});

export const LocationProvider = ({ children }: any) => {
  const [currentLocation, setCurrentLocation] = useState<LocationType | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [mode, setMode] = useState<Mode>('normal');

  const foregroundWatcher = useRef<Location.LocationSubscription | null>(null);

  //
  // 🔁 Dynamic interval
  //
  const getInterval = () => {
    switch (mode) {
      case 'sos':
        return 10000;       // 10 sec
      case 'low_battery':
        return 180000;      // 3 min
      case 'background':
        return 240000;      // 4 min
      default:
        return 60000;       // 1 min
    }
  };

  //
  // ✅ START TRACKING
  //
  const startTracking = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;

    // 🔹 FOREGROUND WATCHER (updates UI)
    foregroundWatcher.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: getInterval(),
        distanceInterval: 5,
      },
      async (loc) => {
        const coords = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          accuracy: loc.coords.accuracy ?? undefined,
        };

        // ✅ Update UI immediately
        setCurrentLocation(coords);

        // ✅ Send to backend only if logged in
        const token = await AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
        if (!token) return;

        try {
          await apiClient.post('/update', {
            latitude: coords.latitude,
            longitude: coords.longitude,
          });
        } catch {
          console.log('Foreground update failed');
        }
      }
    );

    // 🔹 BACKGROUND TASK (Dev build / APK only)
    const bg = await Location.requestBackgroundPermissionsAsync();
    if (bg.status === 'granted') {
      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.High,
        timeInterval: getInterval(),
        distanceInterval: 10,
        showsBackgroundLocationIndicator: true,
      });
    }

    setIsTracking(true);
  };

  //
  // 🛑 STOP TRACKING
  //
  const stopTracking = async () => {
    if (foregroundWatcher.current) {
      foregroundWatcher.current.remove();
      foregroundWatcher.current = null;
    }

    const started = await Location.hasStartedLocationUpdatesAsync(
      LOCATION_TASK_NAME
    );

    if (started) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    }

    setIsTracking(false);
  };

  //
  // 🔄 RESET (called on logout)
  //
  const resetLocationState = async () => {
    await stopTracking();
    setCurrentLocation(null);
    setMode('normal');
  };

  //
  // 🔋 Battery Listener
  //
  useEffect(() => {
    const sub = Battery.addBatteryLevelListener(({ batteryLevel }) => {
      if (batteryLevel < 0.2) {
        setMode('low_battery');
      }
    });

    return () => sub.remove();
  }, []);

  //
  // 🔁 Restart tracking when mode changes
  //
  useEffect(() => {
    if (isTracking) {
      stopTracking().then(() => startTracking());
    }
  }, [mode]);

  return (
    <LocationContext.Provider
      value={{
        currentLocation,
        isTracking,
        startTracking,
        stopTracking,
        setMode,
        resetLocationState,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = () => useContext(LocationContext);
