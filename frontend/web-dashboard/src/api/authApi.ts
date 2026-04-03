// src/api/authApi.ts

import { apiClient } from './apiClient';
import type {
  LoginRequest,
  TokenResponse,
  User,
} from '../types/user';

// ─────────────────────────────────────────────
// Login
// ─────────────────────────────────────────────

export async function login(payload: LoginRequest): Promise<TokenResponse> {
  return apiClient.postSkipAuth<TokenResponse>('/auth/login', payload);
}

// ─────────────────────────────────────────────
// Logout
// ─────────────────────────────────────────────

export async function logout(refreshToken: string): Promise<void> {
  return apiClient.post<void>('/auth/logout', {
    refresh_token: refreshToken,
  });
}

// ─────────────────────────────────────────────
// Refresh token
// ─────────────────────────────────────────────

export async function refreshToken(token: string): Promise<TokenResponse> {
  return apiClient.postSkipAuth<TokenResponse>('/auth/refresh', {
    refresh_token: token,
  });
}

// ─────────────────────────────────────────────
// Get current user (/auth/me)
// ─────────────────────────────────────────────

export async function getMe(): Promise<User> {
  return apiClient.get<User>('/auth/me');
}

// ─────────────────────────────────────────────
// Change password
// ─────────────────────────────────────────────

export interface ChangePasswordRequest {
  current_password:  string;
  new_password:      string;
  confirm_password:  string;
}

export async function changePassword(
  payload: ChangePasswordRequest,
): Promise<void> {
  return apiClient.post<void>('/auth/change-password', payload);
}