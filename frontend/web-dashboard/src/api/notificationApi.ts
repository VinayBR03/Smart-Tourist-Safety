// src/api/notificationApi.ts

import { apiClient } from './apiClient';
import type {
  Notification,
  NotificationSummary,
  NotificationUnreadCount,
} from '../types/notification';

// ─────────────────────────────────────────────
// List my notifications
// GET /notifications
// ─────────────────────────────────────────────

export async function listNotifications(): Promise<NotificationSummary[]> {
  return apiClient.get<NotificationSummary[]>('/notifications');
}

// ─────────────────────────────────────────────
// Get unread count
// GET /notifications/unread-count
// ─────────────────────────────────────────────

export async function getUnreadCount(): Promise<NotificationUnreadCount> {
  return apiClient.get<NotificationUnreadCount>('/notifications/unread-count');
}

// ─────────────────────────────────────────────
// Get notification detail
// GET /notifications/:id
// ─────────────────────────────────────────────

export async function getNotification(notificationId: number): Promise<Notification> {
  return apiClient.get<Notification>(`/notifications/${notificationId}`);
}

// ─────────────────────────────────────────────
// Mark notification as read
// POST /notifications/:id/read
// ─────────────────────────────────────────────

export async function markAsRead(notificationId: number): Promise<Notification> {
  return apiClient.post<Notification>(`/notifications/${notificationId}/read`, {});
}

// ─────────────────────────────────────────────
// Admin: list system notifications
// GET /notifications/admin/system
// ─────────────────────────────────────────────

export async function listSystemNotifications(): Promise<NotificationSummary[]> {
  return apiClient.get<NotificationSummary[]>('/notifications/admin/system');
}