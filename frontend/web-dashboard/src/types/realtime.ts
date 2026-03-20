// src/types/realtime.ts

export enum WSEventType {
  // Device
  DEVICE_TELEMETRY       = 'device_telemetry',
  DEVICE_STATUS_CHANGED  = 'device_status_changed',

  // Location
  TOURIST_LOCATION_UPDATE = 'tourist_location_update',

  // Incident
  INCIDENT_CREATED       = 'incident_created',
  INCIDENT_UPDATED       = 'incident_updated',

  // Health
  HEALTH_ALERT           = 'health_alert',

  // Notification
  NOTIFICATION           = 'notification',

  // Zone
  ZONE_RISK_UPDATED      = 'zone_risk_updated',

  // Connection
  PING                   = 'ping',
  PONG                   = 'pong',
}

export interface WSMessage<T = unknown> {
  event: WSEventType;
  data: T;
  timestamp: string;
}

export interface DeviceTelemetryPayload {
  device_id: string;
  battery_percentage: number | null;
  firmware_version: string | null;
  last_seen: string;
}

export interface TouristLocationPayload {
  tourist_id: number;
  latitude: number;
  longitude: number;
  updated_at: string;
}

export interface HealthAlertPayload {
  tourist_id: number;
  device_id: string | null;
  alert_type: string;
  heart_rate: number | null;
  spo2: number | null;
  body_temperature: number | null;
  recorded_at: string;
}

export interface ZoneRiskPayload {
  zone_id: number;
  risk_level: string;
  risk_score: number;
  updated_at: string;
}