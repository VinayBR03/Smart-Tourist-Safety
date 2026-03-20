// src/services/websocketService.ts

import { WS_BASE_URL, WS_RECONNECT_DELAY_MS, WS_MAX_RECONNECT_ATTEMPTS } from '../constants/config';
import { STORAGE_KEYS } from '../constants/storage';
import { WSEventType } from '../types/realtime';
import type { WSMessage } from '../types/realtime';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type WSHandler<T = unknown> = (data: T, raw: WSMessage<T>) => void;
type UnsubscribeFn = () => void;

type WSEndpoint = 'notifications' | 'authority/live';

interface WSSubscription {
  event: WSEventType;
  handler: WSHandler<unknown>;
}

interface WSConnectionState {
  socket: WebSocket | null;
  isConnected: boolean;
  reconnectAttempts: number;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  subscriptions: Map<string, WSSubscription>;
  endpoint: WSEndpoint;
  manualClose: boolean;
  heartbeatInterval: ReturnType<typeof setInterval> | null;
}

// ─────────────────────────────────────────────
// WebSocket Service Class
// ─────────────────────────────────────────────

class WebSocketService {
  private connections: Map<WSEndpoint, WSConnectionState> = new Map();
  private globalHandlers: Map<string, Set<WSHandler<unknown>>> = new Map();

  // ───────────────────────────────────────────
  // Connect to a WebSocket endpoint
  // ───────────────────────────────────────────

  connect(endpoint: WSEndpoint): void {
    if (this.connections.has(endpoint)) {
      const state = this.connections.get(endpoint)!;
      if (
        state.isConnected ||
        state.socket?.readyState === WebSocket.CONNECTING
      ) {
        return;
      }
    }

    this._createConnection(endpoint);
  }

  // ───────────────────────────────────────────
  // Disconnect from a WebSocket endpoint
  // ───────────────────────────────────────────

  disconnect(endpoint: WSEndpoint): void {
    const state = this.connections.get(endpoint);
    if (!state) return;

    state.manualClose = true;

    if (state.reconnectTimer) {
      clearTimeout(state.reconnectTimer);
      state.reconnectTimer = null;
    }

    if (state.socket) {
      state.socket.close(1000, 'Manual disconnect');
      state.socket = null;
    }

    this.connections.delete(endpoint);
  }

  // ───────────────────────────────────────────
  // Disconnect all
  // ───────────────────────────────────────────

  disconnectAll(): void {
    for (const endpoint of this.connections.keys()) {
      this.disconnect(endpoint);
    }
  }

  // ───────────────────────────────────────────
  // Subscribe to a specific event type
  // ───────────────────────────────────────────

  subscribe<T>(
    endpoint: WSEndpoint,
    event: WSEventType,
    handler: WSHandler<T>
  ): UnsubscribeFn {
    const key = `${endpoint}::${event}::${Math.random().toString(36).slice(2)}`;

    if (!this.connections.has(endpoint)) {
      this._initState(endpoint);
    }

    const state = this.connections.get(endpoint)!;
    state.subscriptions.set(key, {
      event,
      handler: handler as WSHandler<unknown>,
    });

    return () => {
      const s = this.connections.get(endpoint);
      if (s) s.subscriptions.delete(key);
    };
  }

  // ───────────────────────────────────────────
  // Subscribe to ALL events (global listener)
  // ───────────────────────────────────────────

  onAny(endpoint: WSEndpoint, handler: WSHandler<unknown>): UnsubscribeFn {
    const key = `${endpoint}::*`;

    if (!this.globalHandlers.has(key)) {
      this.globalHandlers.set(key, new Set());
    }
    this.globalHandlers.get(key)!.add(handler);

    return () => {
      this.globalHandlers.get(key)?.delete(handler);
    };
  }

  // ───────────────────────────────────────────
  // Check connection status
  // ───────────────────────────────────────────

  isConnected(endpoint: WSEndpoint): boolean {
    return this.connections.get(endpoint)?.isConnected ?? false;
  }

  getReconnectAttempts(endpoint: WSEndpoint): number {
    return this.connections.get(endpoint)?.reconnectAttempts ?? 0;
  }

  // ───────────────────────────────────────────
  // Internal: initialize state object
  // ───────────────────────────────────────────

  private _initState(endpoint: WSEndpoint): WSConnectionState {
    const state: WSConnectionState = {
      socket: null,
      isConnected: false,
      reconnectAttempts: 0,
      reconnectTimer: null,
      subscriptions: new Map(),
      endpoint,
      manualClose: false,
      heartbeatInterval: null,
    };
    this.connections.set(endpoint, state);
    return state;
  }

  // ───────────────────────────────────────────
  // Internal: create WebSocket connection
  // ───────────────────────────────────────────

  private _createConnection(endpoint: WSEndpoint): void {
    const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    if (!token) {
      console.warn(`[WS] No token available for endpoint: ${endpoint}`);
      return;
    }

    const state = this.connections.get(endpoint) ?? this._initState(endpoint);
    state.manualClose = false;

    const url = `${WS_BASE_URL}/ws/${endpoint}?token=${encodeURIComponent(token)}`;

    let socket: WebSocket;
    try {
      socket = new WebSocket(url);
    } catch (err) {
      console.error(`[WS] Failed to create socket for ${endpoint}:`, err);
      this._scheduleReconnect(endpoint);
      return;
    }

    state.socket = socket;

    // ── Open ──

    socket.onopen = () => {
      console.info(`[WS] Connected: /ws/${endpoint}`);
      state.isConnected = true;
      state.reconnectAttempts = 0;
      this._dispatchConnectionEvent(endpoint, 'connected');
      state.heartbeatInterval = setInterval(() => {
        if (state.socket?.readyState === WebSocket.OPEN) {
          state.socket.send(JSON.stringify({ type: 'heartbeat' }));
        }
      }, 30_000);
    };

    // ── Message ──

    socket.onmessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data as string) as WSMessage<unknown>;
        this._dispatch(endpoint, message);
      } catch (err) {
        console.warn(`[WS] Failed to parse message on ${endpoint}:`, err);
      }
    };

    // ── Close ──

    socket.onclose = (event: CloseEvent) => {
      console.info(
        `[WS] Closed: /ws/${endpoint} — code=${event.code} reason=${event.reason}`
      );
      state.isConnected = false;
      state.socket = null;
      if (state.heartbeatInterval) {
        clearInterval(state.heartbeatInterval);
        state.heartbeatInterval = null;
      }
      this._dispatchConnectionEvent(endpoint, 'disconnected');

      if (!state.manualClose) {
        this._scheduleReconnect(endpoint);
      }
    };

    // ── Error ──

    socket.onerror = (event: Event) => {
      console.error(`[WS] Error on /ws/${endpoint}:`, event);
      this._dispatchConnectionEvent(endpoint, 'error');
    };
  }

  // ───────────────────────────────────────────
  // Internal: dispatch message to subscribers
  // ───────────────────────────────────────────

  private _dispatch(endpoint: WSEndpoint, message: WSMessage<unknown>): void {
    const state = this.connections.get(endpoint);
    if (!state) return;

    // Handle ping/pong
    if (message.event === WSEventType.PING) {
      this._sendPong(endpoint);
      return;
    }

    // Event-specific subscribers
    for (const sub of state.subscriptions.values()) {
      if (sub.event === message.event) {
        try {
          sub.handler(message.data, message);
        } catch (err) {
          console.error(`[WS] Handler error for event ${message.event}:`, err);
        }
      }
    }

    // Global listeners
    const globalKey = `${endpoint}::*`;
    const globalSet = this.globalHandlers.get(globalKey);
    if (globalSet) {
      for (const handler of globalSet) {
        try {
          handler(message.data, message);
        } catch (err) {
          console.error(`[WS] Global handler error:`, err);
        }
      }
    }
  }

  // ───────────────────────────────────────────
  // Internal: send pong
  // ───────────────────────────────────────────

  private _sendPong(endpoint: WSEndpoint): void {
    const state = this.connections.get(endpoint);
    if (state?.socket?.readyState === WebSocket.OPEN) {
      state.socket.send(
        JSON.stringify({
          event: WSEventType.PONG,
          data: {},
          timestamp: new Date().toISOString(),
        })
      );
    }
  }

  // ───────────────────────────────────────────
  // Internal: schedule reconnect with backoff
  // ───────────────────────────────────────────

  private _scheduleReconnect(endpoint: WSEndpoint): void {
    const state = this.connections.get(endpoint);
    if (!state) return;

    if (state.reconnectAttempts >= WS_MAX_RECONNECT_ATTEMPTS) {
      console.warn(
        `[WS] Max reconnect attempts reached for /ws/${endpoint}. Giving up.`
      );
      this._dispatchConnectionEvent(endpoint, 'max_retries');
      return;
    }

    state.reconnectAttempts++;

    // Exponential backoff: 3s, 6s, 12s … capped at 30s
    const delay = Math.min(
      WS_RECONNECT_DELAY_MS * Math.pow(1.5, state.reconnectAttempts - 1),
      30_000
    );

    console.info(
      `[WS] Reconnecting /ws/${endpoint} in ${(delay / 1000).toFixed(1)}s ` +
        `(attempt ${state.reconnectAttempts}/${WS_MAX_RECONNECT_ATTEMPTS})`
    );

    state.reconnectTimer = setTimeout(() => {
      state.reconnectTimer = null;
      const current = this.connections.get(endpoint);
      if (current && !current.manualClose) {
        this._createConnection(endpoint);
      }
    }, delay);
  }

  // ───────────────────────────────────────────
  // Internal: dispatch synthetic connection events
  // ───────────────────────────────────────────

  private _dispatchConnectionEvent(
    endpoint: WSEndpoint,
    status: 'connected' | 'disconnected' | 'error' | 'max_retries'
  ): void {
    const syntheticMsg: WSMessage<{ endpoint: string; status: string }> = {
      event: WSEventType.PONG, // use as a neutral carrier
      data: { endpoint, status },
      timestamp: new Date().toISOString(),
    };

    const globalKey = `${endpoint}::*`;
    const globalSet = this.globalHandlers.get(globalKey);
    if (globalSet) {
      for (const handler of globalSet) {
        try {
          handler(syntheticMsg.data, syntheticMsg as WSMessage<unknown>);
        } catch {
          // noop
        }
      }
    }
  }
}

// ─────────────────────────────────────────────
// Singleton export
// ─────────────────────────────────────────────

export const websocketService = new WebSocketService();

// ─────────────────────────────────────────────
// Re-export types for convenience
// ─────────────────────────────────────────────

export type { WSEndpoint, WSHandler, UnsubscribeFn };