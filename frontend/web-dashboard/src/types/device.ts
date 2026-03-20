// src/types/device.ts

import { DeviceType, DeviceStatus } from './enums';

export interface Device {
  id: number;
  device_id: string;
  device_type: DeviceType;
  status: DeviceStatus;
  is_verified: boolean;
  battery_percentage: number | null;
  battery_voltage: number | null;
  battery_updated_at: string | null;
  firmware_version: string | null;
  last_seen: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeviceSummary {
  device_id: string;
  device_type: DeviceType;
  status: DeviceStatus;
  battery_percentage: number | null;
  last_seen: string | null;
}

export interface DeviceRegisterRequest {
  device_id: string;
  device_type: DeviceType;
}

export interface DeviceRegisterResponse {
  device_id: string;
  device_type: DeviceType;
  api_key: string;
}

export interface DeviceStatusUpdateRequest {
  status: DeviceStatus;
}