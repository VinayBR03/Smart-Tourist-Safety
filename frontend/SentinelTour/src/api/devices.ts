import { apiClient } from './client';
import type { DeviceSummary } from '@/types/api';

export const devicesApi = {
  // Tourist's own assigned device(s) (admin list endpoint, kept for completeness)
  listMine: () =>
    apiClient
      .get<DeviceSummary[]>('/devices/mine')
      .then((r) => r.data)
      .catch((err) => {
        if (err?.response?.status === 404) return [] as DeviceSummary[];
        throw err;
      }),

  getById: (deviceId: string) =>
    apiClient.get<DeviceSummary>(`/devices/${deviceId}`).then((r) => r.data),

  // ─────────────────────────────────────────────
  // Self-pair: called automatically on BLE connect.
  // Sends the firmware device_id (e.g. "WB001") read from BLE_CHAR_DEVICE_ID_UUID.
  // Backend links it to the authenticated tourist's account.
  //   - 204: success
  //   - 409: wristband already assigned to a different tourist
  // POST /devices/{device_id}/pair  (TOURIST JWT)
  // ─────────────────────────────────────────────
  pairDevice: (deviceId: string) =>
    apiClient
      .post(`/devices/${deviceId}/pair`)
      .then((r) => r.data)
      .catch((err) => {
        if (err?.response?.status === 204) return null;
        if (err?.response?.status === 409) return null; // already assigned to this tourist
        throw err;
      }),

  // ─────────────────────────────────────────────
  // Self-unpair: called automatically on BLE disconnect or manual Remove.
  // No device_id needed — backend resolves from JWT.
  //   - 204: success (idempotent — also succeeds if already unassigned)
  // POST /devices/mine/unpair  (TOURIST JWT)
  // ─────────────────────────────────────────────
  unpairDevice: () =>
    apiClient
      .post('/devices/mine/unpair')
      .then((r) => r.data)
      .catch((err) => {
        if (err?.response?.status === 204) return null;
        throw err;
      }),
};