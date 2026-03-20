// src/utils/websocketEvents.ts

import { WSEventType } from '../types/realtime';

export const WS_EVENT_LABELS: Record<WSEventType, string> = {
  [WSEventType.DEVICE_TELEMETRY]:        'Device Telemetry',
  [WSEventType.DEVICE_STATUS_CHANGED]:   'Device Status',
  [WSEventType.TOURIST_LOCATION_UPDATE]: 'Location Update',
  [WSEventType.INCIDENT_CREATED]:        'New Incident',
  [WSEventType.INCIDENT_UPDATED]:        'Incident Updated',
  [WSEventType.HEALTH_ALERT]:            'Health Alert',
  [WSEventType.NOTIFICATION]:            'Notification',
  [WSEventType.ZONE_RISK_UPDATED]:       'Zone Risk Update',
  [WSEventType.PING]:                    'Ping',
  [WSEventType.PONG]:                    'Pong',
};

export function isCriticalEvent(event: WSEventType): boolean {
  return [
    WSEventType.HEALTH_ALERT,
    WSEventType.INCIDENT_CREATED,
  ].includes(event);
}