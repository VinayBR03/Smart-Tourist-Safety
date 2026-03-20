// src/hooks/useNotifications.ts

import { useState, useCallback, useEffect } from 'react';

import {
  listNotifications,
  getUnreadCount,
  markAsRead,
} from '../api/notificationApi';

import type {
  NotificationSummary,
} from '../types/notification';

import { NotificationStatus } from '../types/enums';
import type { ApiError } from '../api/apiClient';
import { NOTIFICATION_POLL_INTERVAL_MS } from '../constants/config';

// ─────────────────────────────────────────────
// Notifications + unread count
// ─────────────────────────────────────────────

export function useNotifications() {
  const [notifications, setNotifications] = useState<NotificationSummary[]>([]);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [isLoading,     setIsLoading]     = useState(false);
  const [error,         setError]         = useState<string | null>(null);

  // ── Fetch list ──

  const fetchNotifications = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [notifs, countRes] = await Promise.all([
        listNotifications(),
        getUnreadCount(),
      ]);
      setNotifications(notifs);
      setUnreadCount(countRes.unread_count);
    } catch (err) {
      setError((err as ApiError).message ?? 'Failed to load notifications');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  // ── Polling fallback (when WS unavailable) ──

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const countRes = await getUnreadCount();
        setUnreadCount(countRes.unread_count);
      } catch {
        // Silent — polling is best-effort
      }
    }, NOTIFICATION_POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);

  // ── Mark as read ──

  const markRead = useCallback(async (notificationId: number): Promise<void> => {
    try {
      await markAsRead(notificationId);
      setNotifications((prev) =>
        prev.map((n): NotificationSummary =>
          n.id === notificationId
            ? { ...n, status: NotificationStatus.READ }
            : n
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('[useNotifications] markRead failed:', err);
    }
  }, []);

  // ── Push from WebSocket ──

  const pushNotification = useCallback((notif: NotificationSummary) => {
    setNotifications((prev) => {
      const exists = prev.some((n) => n.id === notif.id);
      if (exists) return prev;
      return [notif, ...prev];
    });
    setUnreadCount((prev) => prev + 1);
  }, []);

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    refetch:          fetchNotifications,
    markRead,
    pushNotification,
  };
}

// ─────────────────────────────────────────────
// Unread count only (lightweight — for Navbar badge)
// ─────────────────────────────────────────────

export function useUnreadCount() {
  const [count,     setCount]     = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getUnreadCount();
      setCount(res.unread_count);
    } catch {
      // Silent
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  useEffect(() => {
    const interval = setInterval(fetch, NOTIFICATION_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetch]);

  const increment = useCallback(() => setCount((c) => c + 1), []);
  const decrement = useCallback(() => setCount((c) => Math.max(0, c - 1)), []);
  const reset     = useCallback(() => setCount(0), []);

  return { count, isLoading, refetch: fetch, increment, decrement, reset };
}