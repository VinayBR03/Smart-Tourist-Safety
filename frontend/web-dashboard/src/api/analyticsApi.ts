// src/api/analyticsApi.ts

import { apiClient } from './apiClient';

// ─────────────────────────────────────────────
// Response types
// ─────────────────────────────────────────────

export interface IncidentTrendPoint {
  date:  string; // guaranteed "YYYY-MM-DD" from backend to_char()
  count: number;
}

// Frontend canonical shape — always { data: [...] } after normalisation below.
export interface IncidentTrendResponse {
  data: IncidentTrendPoint[];
}

export interface IncidentStatusCounts {
  OPEN:        number;
  IN_PROGRESS: number;
  ESCALATED:   number;
  RESOLVED:    number;
  CLOSED:      number;
  CANCELLED:   number;
  REJECTED:    number;
}

export interface IncidentStatusResponse {
  status_counts: IncidentStatusCounts;
}

export interface ZoneRiskCounts {
  LOW:    number;
  MEDIUM: number;
  HIGH:   number;
}

export interface ZoneRiskResponse {
  risk_counts: ZoneRiskCounts;
}

export interface DeviceStatusCounts {
  ACTIVE:         number;
  INACTIVE:       number;
  MAINTENANCE:    number;
  SUSPENDED:      number;
  DECOMMISSIONED: number;
  LOST:           number;
}

export interface DeviceHealthResponse {
  status_counts: DeviceStatusCounts;
}

export interface BatteryDistributionPoint {
  range: string;
  count: number;
}

export interface DeviceBatteryDistributionResponse {
  data: BatteryDistributionPoint[];
}

// ─────────────────────────────────────────────
// GET /analytics/incidents/trend
//
// The backend returns a PLAIN ARRAY:
//   [{"date": "YYYY-MM-DD", "count": N}, ...]
// (see analytics_service.py → get_incident_trend which returns a list directly).
//
// We normalise it here into { data: [...] } so the chart and the rest
// of the app always work with a consistent shape.
// ─────────────────────────────────────────────

export async function getIncidentTrend(): Promise<IncidentTrendResponse> {
  const raw = await apiClient.get<IncidentTrendPoint[] | IncidentTrendResponse>(
    '/analytics/incidents/trend'
  );

  // Backend returns a plain array → wrap it
  if (Array.isArray(raw)) {
    return { data: raw };
  }

  // Already wrapped (future-proofing if backend changes)
  if (raw && typeof raw === 'object' && Array.isArray((raw as IncidentTrendResponse).data)) {
    return raw as IncidentTrendResponse;
  }

  // Unexpected shape — return empty so chart shows "no data" gracefully
  return { data: [] };
}

// ─────────────────────────────────────────────
// GET /analytics/incidents/status
// ─────────────────────────────────────────────

export async function getIncidentStatusCounts(): Promise<IncidentStatusResponse> {
  return apiClient.get<IncidentStatusResponse>('/analytics/incidents/status');
}

// ─────────────────────────────────────────────
// GET /analytics/zones/risk
// ─────────────────────────────────────────────

export async function getZoneRiskCounts(): Promise<ZoneRiskResponse> {
  return apiClient.get<ZoneRiskResponse>('/analytics/zones/risk');
}

// ─────────────────────────────────────────────
// GET /analytics/devices/health
// ─────────────────────────────────────────────

export async function getDeviceHealthCounts(): Promise<DeviceHealthResponse> {
  return apiClient.get<DeviceHealthResponse>('/analytics/devices/health');
}

// ─────────────────────────────────────────────
// GET /analytics/devices/battery
// ─────────────────────────────────────────────

export async function getDeviceBatteryDistribution(): Promise<DeviceBatteryDistributionResponse> {
  return apiClient.get<DeviceBatteryDistributionResponse>('/analytics/devices/battery');
}