import { apiClient } from './client';
import type { HealthTelemetry } from '@/types/api';

export const healthApi = {
  getLatest: async (): Promise<HealthTelemetry | null> => {
    try {
      const res = await apiClient.get<HealthTelemetry>('/health/me');
      return res.data;
    } catch (err: any) {
      // 404 means no telemetry yet — not a real error
      if (err?.response?.status === 404) return null;
      throw err;
    }
  },

  getHistory: (touristId: number, limit = 50) =>
    apiClient
      .get<HealthTelemetry[]>(`/tourists/${touristId}/health`, { params: { limit } })
      .then((r) => r.data)
      .catch((err) => {
        if (err?.response?.status === 404) return [] as HealthTelemetry[];
        throw err;
      }),
};