// src/types/location.ts

export interface LocationResponse {
  tourist_id: number;
  latitude: number;
  longitude: number;
  accuracy_meters: number | null;
  battery_percentage: number | null;
  updated_at: string;
}

export interface ZoneLivePresence {
  zone_id: number;
  tourist_count: number;
}

export interface LocationUpdateRequest {
  latitude: number;
  longitude: number;
  accuracy_meters?: number;
  battery_percentage?: number;
}