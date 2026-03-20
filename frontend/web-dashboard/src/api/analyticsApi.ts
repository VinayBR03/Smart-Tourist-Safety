// src/api/analyticsApi.ts

import { apiClient } from './apiClient';

// ─────────────────────────────────────────────
// Response types (aligned with backend analytics_schema.py)
// ─────────────────────────────────────────────

export interface IncidentTrendPoint {
  date: string;
  count: number;
}

export interface IncidentTrendResponse {
  data: IncidentTrendPoint[];
}

export interface IncidentStatusCounts {
  OPEN: number;
  IN_PROGRESS: number;
  ESCALATED: number;
  RESOLVED: number;
  CLOSED: number;
  CANCELLED: number;
  REJECTED: number;
}

export interface IncidentStatusResponse {
  status_counts: IncidentStatusCounts;
}

export interface ZoneRiskCounts {
  LOW: number;
  MEDIUM: number;
  HIGH: number;
}

export interface ZoneRiskResponse {
  risk_counts: ZoneRiskCounts;
}

export interface DeviceStatusCounts {
  ACTIVE: number;
  INACTIVE: number;
  MAINTENANCE: number;
  SUSPENDED: number;
  DECOMMISSIONED: number;
  LOST: number;
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
// ─────────────────────────────────────────────

export async function getIncidentTrend(): Promise<IncidentTrendResponse> {
  return apiClient.get<IncidentTrendResponse>('/analytics/incidents/trend');
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