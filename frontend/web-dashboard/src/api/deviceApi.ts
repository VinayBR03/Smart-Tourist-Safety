// src/api/deviceApi.ts

import { apiClient } from './apiClient';
import type {
  Device,
  DeviceSummary,
  DeviceRegisterRequest,
  DeviceRegisterResponse,
  DeviceStatusUpdateRequest,
} from '../types/device';

// ─────────────────────────────────────────────
// List devices (Admin / Authority)
// GET /devices
// ─────────────────────────────────────────────

export async function listDevices(): Promise<DeviceSummary[]> {
  return apiClient.get<DeviceSummary[]>('/devices');
}

// ─────────────────────────────────────────────
// Get device by ID
// GET /devices/:id
// ─────────────────────────────────────────────

export async function getDevice(deviceId: string): Promise<Device> {
  return apiClient.get<Device>(`/devices/${deviceId}`);
}

// ─────────────────────────────────────────────
// Register device (Admin)
// POST /devices
// ─────────────────────────────────────────────

export async function registerDevice(
  payload: DeviceRegisterRequest
): Promise<DeviceRegisterResponse> {
  return apiClient.post<DeviceRegisterResponse>('/devices', payload);
}

// ─────────────────────────────────────────────
// Update device status (Admin)
// PATCH /devices/:id/status
// ─────────────────────────────────────────────

export async function updateDeviceStatus(
  deviceId: string,
  payload: DeviceStatusUpdateRequest
): Promise<Device> {
  return apiClient.patch<Device>(`/devices/${deviceId}/status`, payload);
}

// ─────────────────────────────────────────────
// Assign device to tourist (Admin)
// POST /devices/:id/assign/:touristId
// ─────────────────────────────────────────────

export async function assignDevice(
  deviceId: string,
  touristId: number
): Promise<void> {
  return apiClient.post<void>(`/devices/${deviceId}/assign/${touristId}`);
}

// ─────────────────────────────────────────────
// Unassign device (Admin)
// POST /devices/:id/unassign
// ─────────────────────────────────────────────

export async function unassignDevice(deviceId: string): Promise<void> {
  return apiClient.post<void>(`/devices/${deviceId}/unassign`);
}