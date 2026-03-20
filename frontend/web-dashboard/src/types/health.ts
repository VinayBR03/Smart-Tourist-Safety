// src/types/health.ts

export interface HealthTelemetry {
  id: number;
  tourist_id: number;
  device_id: string | null;
  heart_rate: number | null;
  spo2: number | null;
  body_temperature: number | null;
  is_alert: boolean;
  alert_type: string | null;
  recorded_at: string;
  created_at: string;
  updated_at: string;
}

export interface HealthAlertSummary {
  tourist_id: number;
  alert_type: string;
  recorded_at: string;
}