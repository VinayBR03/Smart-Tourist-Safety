// src/api/locationApi.ts

import { apiClient } from './apiClient';
import type {
  LocationResponse,
  ZoneLivePresence,
  LocationUpdateRequest,
} from '../types/location';

// ─────────────────────────────────────────────
// Get live locations (Authority / Admin)
// GET /locations/live
// ─────────────────────────────────────────────

export async function getLiveLocations(): Promise<LocationResponse[]> {
  return apiClient.get<LocationResponse[]>('/locations/live');
}

// ─────────────────────────────────────────────
// Get zone presence summary
// GET /locations/zone-presence
// ─────────────────────────────────────────────

export async function getZonePresence(): Promise<ZoneLivePresence[]> {
  return apiClient.get<ZoneLivePresence[]>('/locations/zone-presence');
}

// ─────────────────────────────────────────────
// Update my location (Tourist)
// POST /locations/me
// ─────────────────────────────────────────────

export async function updateMyLocation(
  payload: LocationUpdateRequest
): Promise<LocationResponse> {
  return apiClient.post<LocationResponse>('/locations/me', payload);
}

// ─────────────────────────────────────────────
// Get my latest location (Tourist)
// GET /locations/me
// ─────────────────────────────────────────────

export async function getMyLocation(): Promise<LocationResponse> {
  return apiClient.get<LocationResponse>('/locations/me');
}