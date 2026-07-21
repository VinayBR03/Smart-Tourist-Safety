// src/constants/config.ts
const host=window.location.host;
const protocol=window.location.protocol;
const wsProtocol=protocol === 'https:' ? 'wss:' : 'ws:';

export const API_BASE_URL =
  `${protocol}//${host}/api`;

export const WS_BASE_URL =
  `${wsProtocol}//${host}/ws`;

export const APP_NAME = 'SafeTrack Dashboard';
export const APP_VERSION = '1.0.0';

export const TOKEN_REFRESH_INTERVAL_MS = 4 * 60 * 1000; // 4 minutes
export const WS_RECONNECT_DELAY_MS = 3000;
export const WS_MAX_RECONNECT_ATTEMPTS = 10;

export const MAP_DEFAULT_CENTER: [number, number] = [20.5937, 78.9629]; // India
export const MAP_DEFAULT_ZOOM = 5;

export const NOTIFICATION_POLL_INTERVAL_MS = 30_000;
export const LIVE_LOCATION_STALE_MINUTES = 10;

export const PAGINATION_PAGE_SIZE = 20;