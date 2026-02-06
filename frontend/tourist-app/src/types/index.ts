// src/types/index.ts
// Professional TypeScript types for the entire application

// ==================== USER & AUTH TYPES ====================
export interface User {
  id: number;
  email: string;
  role: 'tourist' | 'authority';
  full_name?: string;
  phone?: string;
  emergency_contact?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AuthTokens {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  role: 'tourist' | 'authority';
}

// ==================== LOCATION TYPES ====================
export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface LocationData extends Coordinates {
  accuracy?: number;
  altitude?: number;
  heading?: number;
  speed?: number;
  timestamp: number;
}

export interface LocationUpdate {
  latitude: number;
  longitude: number;
  timestamp?: number;
}

// ==================== INCIDENT TYPES ====================
export type IncidentStatus = 'pending' | 'investigating' | 'resolved';

export interface Incident {
  id: number;
  description: string;
  latitude: number;
  longitude: number;
  tourist_id: number;
  status: IncidentStatus;
  created_at: string;
  updated_at?: string;
}

export interface CreateIncidentData {
  description: string;
  latitude: number;
  longitude: number;
}

export interface UpdateIncidentStatus {
  status: IncidentStatus;
}

// ==================== PROFILE TYPES ====================
export interface TouristProfile {
  id: number;
  email: string;
  full_name: string | null;
  phone: string | null;
  emergency_contact: string | null;
}

export interface UpdateProfileData {
  full_name?: string;
  phone?: string;
  emergency_contact?: string;
}

// ==================== API RESPONSE TYPES ====================
export interface ApiResponse<T = any> {
  data: T;
  message?: string;
  success: boolean;
}

export interface ApiError {
  detail?: string;
  message?: string;
  errors?: Record<string, string[]>;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// ==================== NAVIGATION TYPES ====================
export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Dashboard: undefined;
  Profile: undefined;
  SOS: undefined;
  IncidentList: undefined;
  IncidentDetail: { incidentId: number };
  LocationTracking: undefined;
  Settings: undefined;
};

// ==================== STATE TYPES ====================
export interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface LocationState {
  currentLocation: LocationData | null;
  isTracking: boolean;
  error: string | null;
}

export interface IncidentState {
  incidents: Incident[];
  isLoading: boolean;
  error: string | null;
}

// ==================== FORM TYPES ====================
export interface LoginForm {
  email: string;
  password: string;
}

export interface RegisterForm {
  email: string;
  password: string;
  confirmPassword: string;
}

export interface ProfileForm {
  full_name: string;
  phone: string;
  emergency_contact: string;
}

// ==================== HOOK TYPES ====================
export interface UseAsyncReturn<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  execute: (...args: any[]) => Promise<void>;
  reset: () => void;
}

// ==================== CONTEXT TYPES ====================
export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: UpdateProfileData) => Promise<void>;
  clearError: () => void;
}

export interface LocationContextType {
  currentLocation: LocationData | null;
  isTracking: boolean;
  error: string | null;
  startTracking: () => Promise<void>;
  stopTracking: () => void;
  updateLocation: () => Promise<void>;
  clearError: () => void;
}

// ==================== UTILITY TYPES ====================
export type LoadingState = 'idle' | 'pending' | 'success' | 'error';

export interface AsyncState<T> {
  data: T | null;
  status: LoadingState;
  error: string | null;
}