// src/api/zoneApi.ts

import { apiClient } from './apiClient';
import type {
  Zone,
  ZoneWithStatus,
  ZoneStatus,
  ZoneRiskHistory,
  ZoneCreateCircularRequest,
  ZoneCreatePolygonRequest,
  ZoneUpdateRequest,
} from '../types/zone';

// ─────────────────────────────────────────────
// List all zones (basic, no risk data)
// GET /zones
// ─────────────────────────────────────────────

export async function listZones(): Promise<Zone[]> {
  return apiClient.get<Zone[]>('/zones');
}

// ─────────────────────────────────────────────
// List all zones with risk status
// GET /zones/with-status
// ─────────────────────────────────────────────

export async function listZonesWithStatus(): Promise<ZoneWithStatus[]> {
  return apiClient.get<ZoneWithStatus[]>('/zones/with-status');
}

// ─────────────────────────────────────────────
// Get zone by ID (with status)
// GET /zones/:id
// ─────────────────────────────────────────────

export async function getZone(zoneId: number): Promise<ZoneWithStatus> {
  return apiClient.get<ZoneWithStatus>(`/zones/${zoneId}`);
}

// ─────────────────────────────────────────────
// Get zone risk status
// GET /zones/:id/status
// ─────────────────────────────────────────────

export async function getZoneStatus(zoneId: number): Promise<ZoneStatus> {
  return apiClient.get<ZoneStatus>(`/zones/${zoneId}/status`);
}

// ─────────────────────────────────────────────
// Get zone risk history
// GET /zones/:id/risk-history
// ─────────────────────────────────────────────

export async function getZoneRiskHistory(zoneId: number): Promise<ZoneRiskHistory[]> {
  return apiClient.get<ZoneRiskHistory[]>(`/zones/${zoneId}/risk-history`);
}

// ─────────────────────────────────────────────
// Create circular zone (Admin)
// POST /zones/circular
// ─────────────────────────────────────────────

export async function createCircularZone(payload: ZoneCreateCircularRequest): Promise<Zone> {
  return apiClient.post<Zone>('/zones/circular', payload);
}

// ─────────────────────────────────────────────
// Create polygon zone (Admin)
// POST /zones/polygon
// ─────────────────────────────────────────────

export async function createPolygonZone(payload: ZoneCreatePolygonRequest): Promise<Zone> {
  return apiClient.post<Zone>('/zones/polygon', payload);
}

// ─────────────────────────────────────────────
// Update zone (Admin)
// PATCH /zones/:id
// ─────────────────────────────────────────────

export async function updateZone(zoneId: number, payload: ZoneUpdateRequest): Promise<Zone> {
  return apiClient.patch<Zone>(`/zones/${zoneId}`, payload);
}