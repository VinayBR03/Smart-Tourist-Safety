// src/hooks/useWebSocket.ts

import { useEffect, useCallback, useRef, useState } from 'react';
import { websocketService } from '../services/websocketService';
import { notificationSoundService } from '../services/notificationSoundService';
import type { WSEndpoint, WSHandler } from '../services/websocketService';
import type { WSMessage } from '../types/realtime';
import { WSEventType } from '../types/realtime';
import { NotificationSeverity } from '../types/enums';

// ─────────────────────────────────────────────
// Connection status hook
// ─────────────────────────────────────────────

export function useWSConnectionStatus(endpoint: WSEndpoint) {
  const [isConnected, setIsConnected] = useState(() =>
    websocketService.isConnected(endpoint)
  );
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  useEffect(() => {
    const unsub = websocketService.onAny(endpoint, (_data, raw) => {
      // Detect synthetic connection events
      const msg = raw as WSMessage<{ status?: string }>;
      if (msg.event === WSEventType.PONG && msg.data?.status) {
        const status = msg.data.status;
        setIsConnected(status === 'connected');
        setReconnectAttempts(websocketService.getReconnectAttempts(endpoint));
      }
    });

    // Poll actual readyState as fallback
    const interval = setInterval(() => {
      setIsConnected(websocketService.isConnected(endpoint));
    }, 3000);

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [endpoint]);

  return { isConnected, reconnectAttempts };
}

// ─────────────────────────────────────────────
// Subscribe to a specific WS event
// ─────────────────────────────────────────────

export function useWSEvent<T>(
  endpoint: WSEndpoint,
  event: WSEventType,
  handler: WSHandler<T>,
  enabled = true
): void {
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    if (!enabled) return;

    const stable: WSHandler<T> = (data, raw) => handlerRef.current(data, raw);
    const unsub = websocketService.subscribe<T>(endpoint, event, stable);
    return unsub;
  }, [endpoint, event, enabled]);
}

// ─────────────────────────────────────────────
// Subscribe to multiple WS events
// ─────────────────────────────────────────────

export function useWSEvents(
  endpoint: WSEndpoint,
  handlers: Partial<Record<WSEventType, WSHandler<unknown>>>,
  enabled = true
): void {
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    if (!enabled) return;

    const unsubs = Object.entries(handlersRef.current).map(
      ([event, handler]) => {
        if (!handler) return () => {};
        return websocketService.subscribe(
          endpoint,
          event as WSEventType,
          (data, raw) => handlersRef.current[event as WSEventType]?.(data, raw)
        );
      }
    );

    return () => unsubs.forEach((u) => u());
  }, [endpoint, enabled]);
}

// ─────────────────────────────────────────────
// Live data accumulator hook
// Maintains a rolling buffer of the last N messages
// ─────────────────────────────────────────────

export function useWSBuffer<T>(
  endpoint: WSEndpoint,
  event: WSEventType,
  maxSize = 50,
  enabled = true
): T[] {
  const [buffer, setBuffer] = useState<T[]>([]);

  useWSEvent<T>(
    endpoint,
    event,
    useCallback((data: T) => {
      setBuffer((prev) => {
        const next = [data, ...prev];
        return next.length > maxSize ? next.slice(0, maxSize) : next;
      });
    }, [maxSize]),
    enabled
  );

  return buffer;
}

// ─────────────────────────────────────────────
// Latest value hook
// Always holds the most recent value for an event
// ─────────────────────────────────────────────

export function useWSLatest<T>(
  endpoint: WSEndpoint,
  event: WSEventType,
  enabled = true
): T | null {
  const [latest, setLatest] = useState<T | null>(null);

  useWSEvent<T>(
    endpoint,
    event,
    useCallback((data: T) => setLatest(data), []),
    enabled
  );

  return latest;
}

// ─────────────────────────────────────────────
// Notification WebSocket hook
// Handles incoming notifications + sound
// ─────────────────────────────────────────────

interface NotificationWSPayload {
  id:         number;
  event_type: string;
  severity:   NotificationSeverity;
  status:     string;
  created_at: string;
}

export function useNotificationWS(
  onNewNotification?: (payload: NotificationWSPayload) => void
) {
  const { isConnected } = useWSConnectionStatus('notifications');

  useWSEvent<NotificationWSPayload>(
    'notifications',
    WSEventType.NOTIFICATION,
    useCallback(
      (data: NotificationWSPayload) => {
        // Play sound based on severity
        notificationSoundService.playForSeverity(
          data.severity ?? NotificationSeverity.INFO
        );
        onNewNotification?.(data);
      },
      [onNewNotification]
    )
  );

  return { isConnected };
}

// ─────────────────────────────────────────────
// Authority live dashboard WS hook
// Manages all authority/live event subscriptions
// ─────────────────────────────────────────────

import type {
  TouristLocationPayload,
  HealthAlertPayload,
  ZoneRiskPayload,
  DeviceTelemetryPayload,
} from '../types/realtime';
import type { IncidentSummary } from '../types/incident';

interface AuthorityLiveHandlers {
  onLocationUpdate?:   (data: TouristLocationPayload)  => void;
  onHealthAlert?:      (data: HealthAlertPayload)       => void;
  onZoneRiskUpdate?:   (data: ZoneRiskPayload)          => void;
  onIncidentCreated?:  (data: IncidentSummary)          => void;
  onIncidentUpdated?:  (data: IncidentSummary)          => void;
  onDeviceTelemetry?:  (data: DeviceTelemetryPayload)   => void;
}

export function useAuthorityLiveWS(
  handlers: AuthorityLiveHandlers,
  enabled = true
) {
  const { isConnected, reconnectAttempts } =
    useWSConnectionStatus('authority/live');

  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useWSEvents(
    'authority/live',
    {
      [WSEventType.TOURIST_LOCATION_UPDATE]: (data) =>
        handlersRef.current.onLocationUpdate?.(data as TouristLocationPayload),

      [WSEventType.HEALTH_ALERT]: (data) => {
        notificationSoundService.playForSeverity(NotificationSeverity.CRITICAL);
        handlersRef.current.onHealthAlert?.(data as HealthAlertPayload);
      },

      [WSEventType.ZONE_RISK_UPDATED]: (data) =>
        handlersRef.current.onZoneRiskUpdate?.(data as ZoneRiskPayload),

      [WSEventType.INCIDENT_CREATED]: (data) => {
        notificationSoundService.playForSeverity(NotificationSeverity.WARNING);
        handlersRef.current.onIncidentCreated?.(data as IncidentSummary);
      },

      [WSEventType.INCIDENT_UPDATED]: (data) =>
        handlersRef.current.onIncidentUpdated?.(data as IncidentSummary),

      [WSEventType.DEVICE_TELEMETRY]: (data) =>
        handlersRef.current.onDeviceTelemetry?.(data as DeviceTelemetryPayload),
    },
    enabled
  );

  return { isConnected, reconnectAttempts };
}