// src/hooks/useLocations.ts

import { useState, useCallback, useEffect, useMemo } from 'react';

import {
  getLiveLocations,
  getZonePresence,
} from '../api/locationApi';

import type { LocationResponse, ZoneLivePresence } from '../types/location';
import type { ApiError } from '../api/apiClient';
import { LIVE_LOCATION_STALE_MINUTES } from '../constants/config';

// ─────────────────────────────────────────────
// Live tourist locations (Authority / Admin)
// ─────────────────────────────────────────────

export function useLiveLocations() {
  const [locations, setLocations] = useState<LocationResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getLiveLocations();
      setLocations(data);
      setLastFetch(new Date());
    } catch (err) {
      setError((err as ApiError).message ?? 'Failed to load live locations');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // FIX: Isolated execution wrapper for fetching
  useEffect(() => {
    const triggerFetch = async () => {
      await fetch();
    };
    triggerFetch();
  }, [fetch]);

  // Accept real-time WS location updates
  const updateLocation = useCallback(
    (touristId: number, lat: number, lng: number, updatedAt: string) => {
      setLocations((prev) => {
        const exists = prev.some((l) => l.tourist_id === touristId);
        if (exists) {
          return prev.map((l) =>
            l.tourist_id === touristId
              ? { ...l, latitude: lat, longitude: lng, updated_at: updatedAt }
              : l
          );
        }
        return [
          ...prev,
          {
            tourist_id:        touristId,
            latitude:          lat,
            longitude:         lng,
            accuracy_meters:   null,
            battery_percentage: null,
            updated_at:        updatedAt,
          },
        ];
      });
    },
    []
  );

  const activeLocations = useMemo(() => {
    // eslint-disable-next-line react-hooks/purity
    const nowTimestamp = Date.now();
    return locations.filter((loc) => {
      const updatedAt = new Date(loc.updated_at).getTime();
      const ageMinutes = (nowTimestamp - updatedAt) / 60_000;
      return ageMinutes <= LIVE_LOCATION_STALE_MINUTES;
    });
  }, [locations]);

  return {
    locations,
    activeLocations,
    isLoading,
    error,
    lastFetch,
    refetch: fetch,
    updateLocation,
  };
}

// ─────────────────────────────────────────────
// Zone presence summary
// ─────────────────────────────────────────────

export function useZonePresence() {
  const [presence,  setPresence]  = useState<ZoneLivePresence[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getZonePresence();
      setPresence(data);
    } catch (err) {
      setError((err as ApiError).message ?? 'Failed to load zone presence');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // FIX: Isolated execution wrapper for fetching
  useEffect(() => {
    const triggerFetch = async () => {
      await fetch();
    };
    triggerFetch();
  }, [fetch]);

  const getTouristCount = useCallback(
    (zoneId: number): number =>
      presence.find((p) => p.zone_id === zoneId)?.tourist_count ?? 0,
    [presence]
  );

  return { presence, isLoading, error, refetch: fetch, getTouristCount };
}
