import Constants from 'expo-constants';

const debuggerHost = Constants.expoConfig?.hostUri;
const currentHost = debuggerHost?.split(':').shift() || 'localhost';
export const Config = {
  API_BASE_URL: `http://${currentHost}:8000`,
  WS_BASE_URL:  `ws://${currentHost}:8000`,

  ACCESS_TOKEN_KEY:  'sentinel_access_token',
  REFRESH_TOKEN_KEY: 'sentinel_refresh_token',

  LOCATION_UPDATE_INTERVAL: 30_000,
  HEALTH_POLL_INTERVAL:     10_000,

  BLE_SERVICE_UUID:   '12345678-1234-1234-1234-123456789abc',
  BLE_CHAR_HEALTH_UUID:  '12345678-1234-1234-1234-123456789abd',
  BLE_CHAR_BATTERY_UUID: '12345678-1234-1234-1234-123456789abe',
  BLE_CHAR_SOS_UUID:     '12345678-1234-1234-1234-123456789abf',

  NOMINATIM_URL: 'https://nominatim.openstreetmap.org',
} as const;