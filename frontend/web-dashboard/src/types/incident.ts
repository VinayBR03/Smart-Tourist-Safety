// src/types/incident.ts

import { IncidentStatus, IncidentSource } from './enums';

export interface Incident {
  id: number;
  tourist_id: number | null;
  zone_id: number | null;
  description: string;
  status: IncidentStatus;
  source: IncidentSource;
  is_auto_generated: boolean;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export interface IncidentSummary {
  id: number;
  status: IncidentStatus;
  zone_id: number | null;
  is_auto_generated: boolean;
  created_at: string;
  source: IncidentSource;
}

export interface IncidentTimelineEntry {
  status: IncidentStatus;
  changed_at: string;
  changed_by: number | null;
}

export interface IncidentCreateRequest {
  description: string;
  latitude?: number;
  longitude?: number;
  zone_id?: number;
  source: IncidentSource;
  is_auto_generated?: boolean;
}

export interface IncidentStatusUpdateRequest {
  status: IncidentStatus;
}

export interface IncidentResolveRequest {
  resolution_note?: string;
}