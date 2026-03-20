// src/types/user.ts

import { UserRole, UserLanguage } from './enums';

export interface User {
  id: number;
  email: string;
  role: UserRole;
  is_active: boolean;
  is_verified: boolean;
  preferred_language: UserLanguage;
  full_name: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserAdminResponse extends User {
  token_version: number;
  last_login: string | null;
  last_activity: string | null;
  password_changed_at: string | null;
  is_pending_deletion: boolean;
  deletion_requested_at: string | null;
}

export interface LoginRequest {
  email: string;
  password: string;
  device_info?: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface CreateAuthorityRequest {
  email: string;
  password: string;
  name: string;
}