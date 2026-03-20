// src/api/userApi.ts

import { apiClient } from './apiClient';
import type { User, UserAdminResponse, CreateAuthorityRequest } from '../types/user';

// ─────────────────────────────────────────────
// List all users (Admin)
// GET /users
// ─────────────────────────────────────────────

export async function listUsers(): Promise<UserAdminResponse[]> {
  return apiClient.get<UserAdminResponse[]>('/users');
}

// ─────────────────────────────────────────────
// Get user by ID (Admin)
// GET /users/:id
// ─────────────────────────────────────────────

export async function getUserById(userId: number): Promise<UserAdminResponse> {
  return apiClient.get<UserAdminResponse>(`/users/${userId}`);
}

// ─────────────────────────────────────────────
// Create authority user (Admin)
// POST /users/authority
// ─────────────────────────────────────────────

export async function createAuthority(
  payload: CreateAuthorityRequest
): Promise<UserAdminResponse> {
  return apiClient.post<UserAdminResponse>('/users/authority', payload);
}

// ─────────────────────────────────────────────
// Update user active status (Admin)
// PATCH /users/:id/status
// ─────────────────────────────────────────────

export async function updateUserStatus(
  userId: number,
  isActive: boolean
): Promise<{ updated: boolean; user_id: number }> {
  return apiClient.patch<{ updated: boolean; user_id: number }>(
    `/users/${userId}/status`,
    { is_active: isActive }
  );
}

// ─────────────────────────────────────────────
// Get tourist by ID (Admin / Authority)
// GET /tourists/:id
// ─────────────────────────────────────────────

export async function getTouristById(touristId: number): Promise<User> {
  return apiClient.get<User>(`/tourists/${touristId}`);
}