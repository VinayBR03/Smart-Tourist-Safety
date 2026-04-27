import { apiClient } from './client';
import type { CreateIncidentRequest, IncidentDetail, IncidentSummary, IncidentTimelineEntry, MediaResponse } from '@/types/api';

export const incidentsApi = {
  create: (data: CreateIncidentRequest) =>
    apiClient.post<IncidentDetail>('/incidents', data).then((r) => r.data),

  listMine: (params?: { limit?: number; offset?: number; status_filter?: string }) =>
    apiClient.get<IncidentSummary[]>('/incidents/me', { params }).then((r) => r.data),

  getById: (id: number) =>
    apiClient.get<IncidentDetail>(`/incidents/${id}`).then((r) => r.data),

  getTimeline: (id: number) =>
    apiClient.get<IncidentTimelineEntry[]>(`/incidents/${id}/timeline`).then((r) => r.data),

  getMedia: (id: number) =>
    apiClient.get<MediaResponse[]>(`/media/incident/${id}`).then((r) => r.data),
};