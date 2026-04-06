import type { UserLanguage, UserRole } from './api';

// ─── Registration ─────────────────────────────────────────
export interface RegisterStep1 {
  email:           string;
  password:        string;
  confirmPassword: string;
}

export interface RegisterStep2 {
  full_name:    string;
  phone:        string;
  gender:       string;
  date_of_birth: string;
  nationality:  string;
}

export interface RegisterStep3 {
  emergency_contact:  string;
  blood_group:        string;
  medical_conditions: string;
  allergies:          string;
}

export interface FullRegisterPayload {
  email:              string;
  password:           string;
  role:               'TOURIST';
  full_name:          string;
  phone:              string;
  gender:             string;
  date_of_birth:      string;
  nationality:        string;
  emergency_contact:  string;
  blood_group:        string;
  medical_conditions: string;
  allergies:          string;
  preferred_language: UserLanguage;
}

// ─── Login ────────────────────────────────────────────────
export interface LoginPayload {
  email:       string;
  password:    string;
  device_info?: string;
}

// ─── Change password ──────────────────────────────────────
export interface ChangePasswordPayload {
  current_password: string;
  new_password:     string;
  confirm_password: string;
}

// ─── Token storage ────────────────────────────────────────
export interface StoredTokens {
  access_token:  string;
  refresh_token: string;
}

// ─── Auth state ───────────────────────────────────────────
export interface AuthState {
  isAuthenticated: boolean;
  isLoading:       boolean;
  role:            UserRole | null;
}