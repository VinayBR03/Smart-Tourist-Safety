import { apiClient } from './client';
import type { LocationResponse, LocationUpdateRequest } from '@/types/api';

export const locationApi = {
  update: (payload: LocationUpdateRequest) =>
    apiClient.post<LocationResponse>('/locations/me', payload).then((r) => r.data),

  getMyLocation: () =>
    apiClient.get<LocationResponse>('/locations/me').then((r) => r.data),
};