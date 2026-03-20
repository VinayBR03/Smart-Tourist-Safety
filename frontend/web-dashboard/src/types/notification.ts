// src/types/notification.ts

import {
  NotificationChannel,
  NotificationSeverity,
  NotificationStatus,
  UserLanguage,
} from './enums';

export interface Notification {
  id: number;
  user_id: number | null;
  event_type: string;
  channel: NotificationChannel;
  severity: NotificationSeverity;
  status: NotificationStatus;
  payload: Record<string, unknown>;
  template_version: string;
  language: UserLanguage;
  retry_count: number;
  next_retry_at: string | null;
  sent_at: string | null;
  last_error: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface NotificationSummary {
  id: number;
  event_type: string;
  severity: NotificationSeverity;
  status: NotificationStatus;
  created_at: string;
}

export interface NotificationUnreadCount {
  unread_count: number;
}