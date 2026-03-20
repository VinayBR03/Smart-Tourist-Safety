// src/api/incidentApi.ts

import { apiClient } from './apiClient';
import type {
  Incident,
  IncidentSummary,
  IncidentTimelineEntry,
  IncidentCreateRequest,
  IncidentStatusUpdateRequest,
  IncidentResolveRequest,
} from '../types/incident';

// ─────────────────────────────────────────────
// List all incidents (Admin / Authority)
// GET /incidents
// ─────────────────────────────────────────────

export async function listIncidents(): Promise<IncidentSummary[]> {
  return apiClient.get<IncidentSummary[]>('/incidents');
}

// ─────────────────────────────────────────────
// Get incident by ID
// GET /incidents/:id
// ─────────────────────────────────────────────

export async function getIncident(incidentId: number): Promise<Incident> {
  return apiClient.get<Incident>(`/incidents/${incidentId}`);
}

// ─────────────────────────────────────────────
// Create incident
// POST /incidents
// ─────────────────────────────────────────────

export async function createIncident(payload: IncidentCreateRequest): Promise<Incident> {
  return apiClient.post<Incident>('/incidents', payload);
}

// ─────────────────────────────────────────────
// Update incident status (non-terminal)
// PATCH /incidents/:id/status
// ─────────────────────────────────────────────

export async function updateIncidentStatus(
  incidentId: number,
  payload: IncidentStatusUpdateRequest
): Promise<Incident> {
  return apiClient.patch<Incident>(`/incidents/${incidentId}/status`, payload);
}

// ─────────────────────────────────────────────
// Resolve incident (terminal)
// POST /incidents/:id/resolve
// ─────────────────────────────────────────────

export async function resolveIncident(
  incidentId: number,
  payload: IncidentResolveRequest
): Promise<Incident> {
  return apiClient.post<Incident>(`/incidents/${incidentId}/resolve`, payload);
}

// ─────────────────────────────────────────────
// Get incident timeline
// GET /incidents/:id/timeline
// ─────────────────────────────────────────────

export async function getIncidentTimeline(
  incidentId: number
): Promise<IncidentTimelineEntry[]> {
  return apiClient.get<IncidentTimelineEntry[]>(`/incidents/${incidentId}/timeline`);
}