// ─── Health telemetry from wristband / backend ────────────
export interface HealthTelemetry {
  id:                  number;
  tourist_id:          number;
  heart_rate:          number | null;
  spo2:                number | null;
  body_temperature:    number | null;
  ambient_temperature: number | null;
  systolic_bp:         number | null;
  diastolic_bp:        number | null;
  battery_percentage:  number | null;
  is_alert:            boolean;
  alert_type:          string | null;
  recorded_at:         string;
}

// ─── Alert thresholds (mirrors backend config) ────────────
export const HEALTH_THRESHOLDS = {
  HEART_RATE_HIGH: 130,
  HEART_RATE_LOW:   40,
  SPO2_LOW:         92,
  TEMP_HIGH:        38.5,
} as const;

// ─── Alert type keys ──────────────────────────────────────
export type HealthAlertType =
  | 'HEART_RATE'
  | 'SPO2'
  | 'TEMPERATURE'
  | 'BATTERY';

// ─── BLE packet from wristband ────────────────────────────
// ESP32-C3 sends this as JSON over BLE characteristic
export interface WristbandHealthPacket {
  hr?:   number;   // heart rate bpm
  spo2?: number;   // SpO2 %
  temp?: number;   // body temperature °C
  bat?:  number;   // battery %
  ts?:   number;   // unix timestamp ms
}

// ─── Session stats computed from history ─────────────────
export interface HealthSessionStats {
  totalReadings: number;
  avgHeartRate:  number | null;
  minSpO2:       number | null;
  alertCount:    number;
  sessionStart:  string | null;
}

export function computeSessionStats(
  history: HealthTelemetry[]
): HealthSessionStats {
  if (!history.length) {
    return {
      totalReadings: 0,
      avgHeartRate:  null,
      minSpO2:       null,
      alertCount:    0,
      sessionStart:  null,
    };
  }

  const hrValues   = history.map((h) => h.heart_rate).filter((v): v is number => v !== null);
  const spo2Values = history.map((h) => h.spo2).filter((v): v is number => v !== null);

  return {
    totalReadings: history.length,
    avgHeartRate:  hrValues.length
      ? Math.round(hrValues.reduce((a, b) => a + b, 0) / hrValues.length)
      : null,
    minSpO2:  spo2Values.length ? Math.min(...spo2Values) : null,
    alertCount: history.filter((h) => h.is_alert).length,
    sessionStart: history[history.length - 1]?.recorded_at ?? null,
  };
}