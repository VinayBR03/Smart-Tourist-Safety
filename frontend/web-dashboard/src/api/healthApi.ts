// src/api/healthApi.ts

import { apiClient } from './apiClient';
import type {
  HealthTelemetry,
  HealthAlertSummary,
} from '../types/health';

// ─────────────────────────────────────────────
// List health telemetry for a tourist
// GET /tourists/:id/health  (proxied via tourist router)
// We hit the IoT-ingested data via the health endpoint if exposed,
// otherwise we use the analytics or tourist endpoint.
// Based on backend, health data lives under iot ingestion.
// For the dashboard we use the tourist endpoint.
// ─────────────────────────────────────────────

export async function getTouristHealthHistory(
  touristId: number
): Promise<HealthTelemetry[]> {
  return apiClient.get<HealthTelemetry[]>(`/tourists/${touristId}/health`);
}

// ─────────────────────────────────────────────
// List active health alerts (Authority / Admin)
// GET /health/alerts
// ─────────────────────────────────────────────

export async function listHealthAlerts(): Promise<HealthAlertSummary[]> {
  return apiClient.get<HealthAlertSummary[]>('/health/alerts');
}

// ─────────────────────────────────────────────
// Get latest telemetry for all active tourists
// GET /health/live
// ─────────────────────────────────────────────

export async function getLiveHealthTelemetry(): Promise<HealthTelemetry[]> {
  return apiClient.get<HealthTelemetry[]>('/health/live');
}