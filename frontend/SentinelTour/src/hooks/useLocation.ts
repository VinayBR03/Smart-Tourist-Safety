import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { locationApi } from '@/api/location';
import { locationService } from '@/services/locationService';
import { useAuthStore } from '@/store/authStore';
import { useDeviceStore } from '@/store/deviceStore';
import type { LocationUpdateRequest } from '@/types/api';

// ─── Fetch my latest stored location ─────────────────────
export function useMyLocation() {
  return useQuery({
    queryKey: ['location', 'me'],
    queryFn:  locationApi.getMyLocation,
    staleTime: 30_000,
    retry: (failureCount, error: any) =>
      error?.response?.status !== 404 && failureCount < 2,
  });
}

// ─── Send location update to backend ─────────────────────
export function useUpdateLocation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: LocationUpdateRequest) =>
      locationApi.update(payload),
    onSuccess: (data) => {
      // Update cached location immediately so map reflects it
      queryClient.setQueryData(['location', 'me'], data);
    },
    onError: (err: any) => {
      // Silent — location updates are best-effort
      console.warn('[Location] Update failed:', err?.response?.status, err?.message);
    },
  });
}

// ─── Start / stop background location tracking ───────────
// Call this once from the Home screen or root layout.
// Automatically pauses when app goes to background and resumes on foreground.
export function useLocationTracking() {
  const { isAuthenticated }   = useAuthStore();
  const { device }            = useDeviceStore();
  const appState              = useRef<AppStateStatus>(AppState.currentState);
  const trackingStarted       = useRef(false);

  const getBattery = useCallback(
    () => device?.batteryPercentage ?? undefined,
    [device?.batteryPercentage]
  );

  const start = useCallback(async () => {
    if (trackingStarted.current) return;
    const granted = await locationService.requestPermissions();
    if (!granted) {
      console.warn('[Location] Permission denied — tracking disabled');
      return;
    }
    locationService.startTracking(getBattery);
    trackingStarted.current = true;
  }, [getBattery]);

  const stop = useCallback(() => {
    locationService.stopTracking();
    trackingStarted.current = false;
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    // Start immediately
    start();

    // Pause tracking when app goes to background, resume on foreground
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (appState.current === 'active' && nextState !== 'active') {
        // Going to background — stop to save battery
        stop();
      } else if (appState.current !== 'active' && nextState === 'active') {
        // Coming to foreground — resume
        start();
      }
      appState.current = nextState;
    });

    return () => {
      stop();
      subscription.remove();
    };
  }, [isAuthenticated, start, stop]);

  return { start, stop };
}

// ─── One-shot location fetch without tracking ─────────────
// Useful for SOS and incident creation to grab current position.
export function useCurrentPosition() {
  return useCallback(async (): Promise<{ latitude: number; longitude: number; accuracy: number | null } | null> => {
    try {
      const granted = await locationService.requestPermissions();
      if (!granted) return null;
      return await locationService.getCurrentPosition();
    } catch (err) {
      console.warn('[Location] getCurrentPosition failed:', err);
      return null;
    }
  }, []);
}