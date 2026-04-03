import { apiClient } from './client';
import type { NotificationSummary, UnreadCountResponse } from '@/types/api';

export const notificationsApi = {
  list: () =>
    apiClient.get<NotificationSummary[]>('/notifications').then((r) => r.data),

  unreadCount: () =>
    apiClient.get<UnreadCountResponse>('/notifications/unread-count').then((r) => r.data),

  markRead: (id: number) =>
    apiClient.post<NotificationSummary>(`/notifications/${id}/read`, {}).then((r) => r.data),

  getById: (id: number) =>
    apiClient.get<NotificationSummary>(`/notifications/${id}`).then((r) => r.data),
};