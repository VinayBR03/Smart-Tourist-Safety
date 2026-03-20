// src/hooks/useHealthTelemetry.ts

import { useState, useCallback, useEffect } from 'react';

import {
  getLiveHealthTelemetry,
  listHealthAlerts,
  getTouristHealthHistory,
} from '../api/healthApi';

import type { HealthTelemetry, HealthAlertSummary } from '../types/health';
import type { ApiError } from '../api/apiClient';

// ─────────────────────────────────────────────
// Live telemetry (all active tourists)
// ─────────────────────────────────────────────

export function useLiveHealthTelemetry() {
  const [telemetry, setTelemetry] = useState<HealthTelemetry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getLiveHealthTelemetry();
      setTelemetry(data);
    } catch (err) {
      setError((err as ApiError).message ?? 'Failed to load health telemetry');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  // Accept real-time push from WS health alerts
  const pushTelemetry = useCallback((entry: HealthTelemetry) => {
    setTelemetry((prev) => {
      const exists = prev.some(
        (t) => t.tourist_id === entry.tourist_id && t.id === entry.id
      );
      if (exists) return prev;
      // Replace existing entry for same tourist (keep latest)
      const filtered = prev.filter((t) => t.tourist_id !== entry.tourist_id);
      return [entry, ...filtered];
    });
  }, []);

  return { telemetry, isLoading, error, refetch: fetch, pushTelemetry };
}

// ─────────────────────────────────────────────
// Active health alerts
// ─────────────────────────────────────────────

export function useHealthAlerts() {
  const [alerts,    setAlerts]    = useState<HealthAlertSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await listHealthAlerts();
      setAlerts(data);
    } catch (err) {
      setError((err as ApiError).message ?? 'Failed to load health alerts');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const pushAlert = useCallback((alert: HealthAlertSummary) => {
    setAlerts((prev) => [alert, ...prev].slice(0, 100));
  }, []);

  return { alerts, isLoading, error, refetch: fetch, pushAlert };
}

// ─────────────────────────────────────────────
// Tourist-specific health history
// ─────────────────────────────────────────────

export function useTouristHealthHistory(touristId: number | null) {
  const [history,   setHistory]   = useState<HealthTelemetry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!touristId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getTouristHealthHistory(touristId);
      setHistory(data);
    } catch (err) {
      setError((err as ApiError).message ?? 'Failed to load health history');
    } finally {
      setIsLoading(false);
    }
  }, [touristId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { history, isLoading, error, refetch: fetch };
}