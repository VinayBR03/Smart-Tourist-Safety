import { apiClient } from './client';
import type { ZoneWithStatus } from '@/types/api';

export const zonesApi = {
  list: () =>
    apiClient.get<ZoneWithStatus[]>('/zones').then((r) => r.data),

  getById: (id: number) =>
    apiClient.get<ZoneWithStatus>(`/zones/${id}`).then((r) => r.data),
};