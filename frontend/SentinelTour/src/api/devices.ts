import { apiClient } from './client';
import type { DeviceSummary } from '@/types/api';

export const devicesApi = {
  // Tourist's own assigned device(s)
  listMine: () =>
    apiClient
      .get<DeviceSummary[]>('/devices/mine')
      .then((r) => r.data)
      .catch((err) => {
        // 404 = no device assigned — not an error
        if (err?.response?.status === 404) return [] as DeviceSummary[];
        throw err;
      }),

  getById: (deviceId: string) =>
    apiClient.get<DeviceSummary>(`/devices/${deviceId}`).then((r) => r.data),

  assignToMe: (deviceId: string, touristId: number) =>
    apiClient
      .post(`/devices/${deviceId}/assign/${touristId}`)
      .then((r) => r.data)
      .catch((err) => {
        if (err?.response?.status === 204) return null;
        if (err?.response?.status === 409) return null; // already assigned
        throw err;
      }),

  unassign: (deviceId: string) =>
    apiClient
      .post(`/devices/${deviceId}/unassign`)
      .then((r) => r.data)
      .catch((err) => {
        if (err?.response?.status === 204) return null;
        throw err;
      }),
};