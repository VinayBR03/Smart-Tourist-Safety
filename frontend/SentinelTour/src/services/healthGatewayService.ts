// src/services/healthGatewayService.ts
//
// BLE gateway: phone receives health/SOS from wristband over BLE
// and forwards it to the backend using tourist JWT auth.
//
// Endpoints used:
//   POST /iot/gateway/health   — tourist JWT, device resolved from active assignment
//   POST /iot/gateway/location — tourist JWT, for SOS with GPS

import NetInfo from '@react-native-community/netinfo';
import * as Location from 'expo-location';
import { apiClient } from '@/api/client';

// ─────────────────────────────────────────────
// BLE health payload shape from wristband firmware
// JSON: {"hr":<f>,"spo2":<f>,"temp":<f>,"bat":<u8>}
// ─────────────────────────────────────────────
export interface BleHealthPayload {
  hr:   number | null;
  spo2: number | null;
  temp: number | null;
  bat:  number | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Consecutive alert streak tracker (app-side mirror of backend tracker)
//
// Tracks how many consecutive BLE payloads exceeded a threshold.
// After STREAK_SOS_THRESHOLD consecutive alerts the phone triggers an
// explicit SOS POST so the backend creates an incident immediately —
// even if there is no GPS and the backend auto-incident would be skipped.
// Resets on any normal (within-range) reading.
//
// Thresholds mirror backend config.py:
//   HEART_RATE_HIGH = 130   HEART_RATE_LOW = 40   SPO2_LOW = 92
// ─────────────────────────────────────────────────────────────────────────────
const ALERT_STREAK_SOS_THRESHOLD = 5;  // 5 × ~30 s = ~2.5 minutes sustained

// Ranges — must match backend config.py
const HR_HIGH  = 130;
const HR_LOW   = 40;
const SPO2_LOW = 92;

let _alertStreak   = 0;
let _lastSosAt: number | null = null;
const SOS_COOLDOWN_MS = 5 * 60 * 1000; // 5 min between auto-SOS

function _isAlertReading(data: BleHealthPayload): boolean {
  if (data.hr   != null && data.hr > 0 && (data.hr > HR_HIGH || data.hr < HR_LOW)) return true;
  if (data.spo2 != null && data.spo2 > 0 && data.spo2 < SPO2_LOW)                  return true;
  return false;
}

function _updateStreak(data: BleHealthPayload): number {
  if (_isAlertReading(data)) {
    _alertStreak += 1;
  } else {
    _alertStreak = 0;
  }
  return _alertStreak;
}

// ─────────────────────────────────────────────
// Check internet connectivity
// ─────────────────────────────────────────────
export async function hasInternetConnection(): Promise<boolean> {
  const state = await NetInfo.fetch();
  const isOnline = !!(state.isConnected && state.isInternetReachable);
  console.log(`[GW Heartbeat Check] Phone is ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
  return isOnline;
}

// ─────────────────────────────────────────────
// Get current GPS position (optional)
// ─────────────────────────────────────────────
async function _getGps(): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const perm = await Location.getForegroundPermissionsAsync();
    if (!perm.granted) return null;
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Upload health data received over BLE
//
// Called every time the wristband sends a HEALTH notification (~30 s).
// Uses tourist Bearer JWT — no IoT API key needed.
//
// Also:
//   - Tracks consecutive out-of-range readings
//   - Auto-triggers SOS POST after ALERT_STREAK_SOS_THRESHOLD consecutive alerts
// ─────────────────────────────────────────────────────────────────────────────
export async function uploadHealthFromBle(data: BleHealthPayload): Promise<void> {
  console.log('[GW] Received BLE health payload from wristband:', data);

  const online = await hasInternetConnection();
  if (!online) return;

  // Track alert streak BEFORE filtering — even a partial-metric reading counts
  const streak = _updateStreak(data);

  // Build body — only include metrics that have valid non-zero values
  const body: Record<string, unknown> = {
    recorded_at: new Date().toISOString(),
  };

  if (data.hr   != null && data.hr   > 0) body.heart_rate       = data.hr;
  if (data.spo2 != null && data.spo2 > 0) body.spo2             = data.spo2;
  if (data.temp != null && data.temp > 0) body.body_temperature = data.temp;

  // Backend requires at least one health metric
  if (!body.heart_rate && !body.spo2 && !body.body_temperature) {
    console.warn('[GW] Discarding health payload - all metrics are 0 or null');
    return;
  }

  // Attach GPS if available
  const gps = await _getGps();
  if (gps) {
    body.latitude  = gps.latitude;
    body.longitude = gps.longitude;
  }

  try {
    const response = await apiClient.post('/iot/gateway/health', body);
    console.log('[GW] Successfully uploaded health data to backend:', response.data);
  } catch (error) {
    console.error('[GW] Failed to upload health data to backend:', error);
  }

  // ── Auto-SOS escalation after sustained alerts ──────────────────────────
  if (streak >= ALERT_STREAK_SOS_THRESHOLD) {
    const now = Date.now();
    const cooldownOk = _lastSosAt == null || (now - _lastSosAt) > SOS_COOLDOWN_MS;

    if (cooldownOk) {
      _lastSosAt   = now;
      _alertStreak = 0;  // reset streak after escalation

      console.warn(`[GW] AUTO-SOS — ${streak} consecutive alert readings — triggering SOS`);

      try {
        await uploadSosFromBle();
      } catch (err) {
        console.error('[GW] Auto-SOS upload failed:', err);
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Upload SOS received over BLE (also called by auto-SOS escalation)
// ─────────────────────────────────────────────────────────────────────────────
export async function uploadSosFromBle(): Promise<void> {
  const online = await hasInternetConnection();
  if (!online) return;

  const gps = await _getGps();

  const body: Record<string, unknown> = {
    sos_flag:    true,
    recorded_at: new Date().toISOString(),
  };

  if (gps) {
    body.latitude  = gps.latitude;
    body.longitude = gps.longitude;
  } else {
    console.warn('[GW] SOS: no GPS — wristband LoRa retransmit will cover');
    return;
  }

  await apiClient.post('/iot/gateway/location', body);
}