// src/types/zone.ts

import { RiskLevel } from './enums';

export interface Zone {
  id: number;
  name: string;
  zone_type: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ZoneStatus {
  zone_id: number;
  risk_score: number;
  risk_level: RiskLevel;
  model_version: string | null;
  updated_at: string;
}

export interface ZoneWithStatus extends Zone {
  risk_score: number | null;
  risk_level: RiskLevel | null;
  status_updated_at: string | null;
}

export interface ZoneRiskHistory {
  zone_id: number;
  risk_score: number;
  risk_level: RiskLevel;
  model_version: string | null;
  recorded_at: string;
}

export interface ZoneCreateCircularRequest {
  name: string;
  zone_type?: string;
  center_latitude: number;
  center_longitude: number;
  radius_meters: number;
}

export interface ZoneCreatePolygonRequest {
  name: string;
  zone_type?: string;
  coordinates: [number, number][];
}

export interface ZoneUpdateRequest {
  name?: string;
  zone_type?: string;
  is_active?: boolean;
}

export interface ZoneLivePresence {
  zone_id: number;
  tourist_count: number;
}