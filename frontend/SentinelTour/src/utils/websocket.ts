import { Config } from '@/constants/config';
import { SecureStorage } from './storage';
import { useNotificationStore } from '@/store/notificationStore';

type WSMessageHandler = (data: unknown) => void;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private handlers: Map<string, WSMessageHandler[]> = new Map();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
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
        const handlers = this.handlers.get(data.type) ?? [];
        handlers.forEach((h) => h(data));

        // Auto-increment notification badge
        if (data.type === 'notification') {
          useNotificationStore.getState().increment();
        }
      } catch (e) {
        console.warn('[WS] Parse error', e);
      }
    };

    this.ws.onclose = () => {
      console.log('[WS] Disconnected');
      if (this.shouldReconnect) {
        this.reconnectTimer = setTimeout(() => this.connect(), 5000);
      }
    };

    this.ws.onerror = (e) => {
      console.warn('[WS] Error', e);
    };
  }

  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'heartbeat' }));
      }
    }, 30_000);
  }

  on(eventType: string, handler: WSMessageHandler) {
    const existing = this.handlers.get(eventType) ?? [];
    this.handlers.set(eventType, [...existing, handler]);
  }

  off(eventType: string, handler: WSMessageHandler) {
    const existing = this.handlers.get(eventType) ?? [];
    this.handlers.set(
      eventType,
      existing.filter((h) => h !== handler)
    );
  }

  disconnect() {
    this.shouldReconnect = false;
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }
}

export const wsClient = new WebSocketClient();