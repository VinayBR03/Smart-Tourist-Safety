// src/utils/websocket.ts
import { Config } from '@/constants/config';
import { SecureStorage } from './storage';
import { useNotificationStore } from '@/store/notificationStore';
import { queryClient } from './queryClientSingleton';

type WSMessageHandler = (data: unknown) => void;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private handlers: Map<string, WSMessageHandler[]> = new Map();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private shouldReconnect = true;

  async connect(): Promise<void> {
    const token = await SecureStorage.get(Config.ACCESS_TOKEN_KEY);
    if (!token) return;

    const url = `${Config.WS_BASE_URL}/ws/notifications?token=${token}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('[WS] Connected');
      this.startHeartbeat();
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const type: string = data.type ?? '';

        // ── Dispatch to registered handlers ──────────────
        const handlers = this.handlers.get(type) ?? [];
        handlers.forEach((h) => h(data));

        // ── Handle notification events ────────────────────
        // The backend may send either 'notification' or 'new_notification'
        // depending on version. Handle both.
        if (type === 'notification' || type === 'new_notification') {
          // 1. Bump the badge count immediately
          useNotificationStore.getState().increment();

          // 2. Invalidate React Query cache so the notifications list
          //    and unread-count refetch automatically.
          //    This is what makes the notification actually appear in the
          //    notifications tab without the user having to pull-to-refresh.
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
          queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
        }

        // ── Handle incident status change push ────────────
        // Some backend versions push 'incident_update' or embed the
        // notification inside a 'notification' event with event_type.
        if (type === 'incident_update' || data?.payload?.event_type === 'INCIDENT_STATUS_CHANGED') {
          queryClient.invalidateQueries({ queryKey: ['incidents', 'me'] });
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
          queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
          useNotificationStore.getState().increment();
        }

        // ── Handle zone risk change ───────────────────────
        if (type === 'zone_update' || type === 'zone_risk_change') {
          queryClient.invalidateQueries({ queryKey: ['zones'] });
        }

        // ── Handle health alert ───────────────────────────
        if (type === 'health_alert') {
          queryClient.invalidateQueries({ queryKey: ['health', 'latest'] });
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
          useNotificationStore.getState().increment();
        }

      } catch (e) {
        console.warn('[WS] Parse error', e);
      }
    };

    this.ws.onclose = (ev) => {
      console.log('[WS] Disconnected', ev.code, ev.reason);
      this.clearHeartbeat();
      if (this.shouldReconnect) {
        this.reconnectTimer = setTimeout(() => this.connect(), 5000);
      }
    };

    this.ws.onerror = (e) => {
      console.warn('[WS] Error', e);
    };
  }

  private startHeartbeat() {
    this.clearHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'heartbeat' }));
      }
    }, 30_000);
  }

  private clearHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  on(eventType: string, handler: WSMessageHandler) {
    const existing = this.handlers.get(eventType) ?? [];
    this.handlers.set(eventType, [...existing, handler]);
  }

  off(eventType: string, handler: WSMessageHandler) {
    const existing = this.handlers.get(eventType) ?? [];
    this.handlers.set(eventType, existing.filter((h) => h !== handler));
  }

  disconnect() {
    this.shouldReconnect = false;
    this.clearHeartbeat();
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    this.ws?.close();
    this.ws = null;
  }
}

export const wsClient = new WebSocketClient();