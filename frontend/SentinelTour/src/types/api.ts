// ─── Auth ─────────────────────────────────────────────────
export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: 'bearer';
  expires_in: number;
}

export type UserRole = 'TOURIST' | 'AUTHORITY' | 'ADMIN';
export type UserLanguage = 'en' | 'hi' | 'kn' | 'te' | 'ta' | 'ml';

export interface User {
  id: number;
  email: string;
  role: UserRole;
  is_active: boolean;
  is_verified: boolean;
  full_name: string | null;
  phone: string | null;
  preferred_language: UserLanguage | null;
  last_login: string | null;
  created_at: string;
  updated_at: string;
  // Extended profile
  emergency_contact?: string | null;
  blood_group?: string | null;
  medical_conditions?: string | null;
  allergies?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  nationality?: string | null;
}

export interface RegisterRequest {
  email: string;
  password: string;
  role: 'TOURIST';
  full_name?: string;
  phone?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  device_info?: string;
}

// ─── Health ───────────────────────────────────────────────
export interface HealthTelemetry {
  id: number;
  tourist_id: number;
  heart_rate: number | null;
  spo2: number | null;
  body_temperature: number | null;
  ambient_temperature: number | null;
  systolic_bp: number | null;
  diastolic_bp: number | null;
  battery_percentage: number | null;
  is_alert: boolean;
  alert_type: string | null;
  recorded_at: string;
}

// ─── Location ─────────────────────────────────────────────
export interface LocationResponse {
  tourist_id: number;
  latitude: number;
  longitude: number;
  accuracy_meters: number | null;
  battery_percentage: number | null;
  updated_at: string;
}

export interface LocationUpdateRequest {
  latitude: number;
  longitude: number;
  accuracy_meters?: number;
  battery_percentage?: number;
}

// ─── Incidents ────────────────────────────────────────────
export type IncidentStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'ESCALATED'
  | 'RESOLVED'
  | 'CLOSED'
  | 'CANCELLED'
  | 'REJECTED';

export type IncidentSource = 'MOBILE' | 'IOT' | 'SYSTEM' | 'ML' | 'HEALTH';

export interface IncidentSummary {
  id: number;
  tourist_id: number;
  description: string | null;
  status: IncidentStatus;
  source: IncidentSource;
  latitude: number | null;
  longitude: number | null;
  zone_id: number | null;
  is_auto_generated: boolean;
  created_at: string;
  updated_at: string;
}

export interface IncidentDetail extends IncidentSummary {
  resolution_note: string | null;
  resolved_at: string | null;
}

export interface IncidentTimelineEntry {
  id: number;
  incident_id: number;
  status: IncidentStatus;
  created_by: number;
  created_at: string;
  changed_by: number | null;
  note?: string | null;
  changed_at: string;
}

export interface CreateIncidentRequest {
  description?: string;
  source: IncidentSource;
  latitude?: number;
  longitude?: number;
  zone_id?: number;
  is_auto_generated?: boolean;
}

// ─── Notifications ────────────────────────────────────────
export type NotificationSeverity = 'INFO' | 'WARNING' | 'HIGH' | 'CRITICAL';
export type NotificationStatus = 'PENDING' | 'SENT' | 'FAILED' | 'CANCELLED' | 'READ';

export interface NotificationSummary {
  id: number;
  user_id: number;
  title: string;
  body: string;
  severity: NotificationSeverity;
  status: NotificationStatus;
  created_at: string;
  read_at: string | null;
}

export interface UnreadCountResponse {
  unread_count: number;
}

// ─── Zones ────────────────────────────────────────────────
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface Zone {
  id: number;
  name: string;
  zone_type: string;
  center_latitude: number | null;
  center_longitude: number | null;
  radius_meters: number | null;
  geometry: Array<[number, number]> | null;
  is_active: boolean;
  created_at: string;
}

export interface ZoneStatus {
  zone_id: number;
  risk_level: RiskLevel;
  tourist_count: number;
  updated_at: string;
}

export interface ZoneWithStatus extends Zone {
  status: ZoneStatus | null;
}

// ─── Devices ──────────────────────────────────────────────
export type DeviceStatus =
  | 'ACTIVE'
  | 'INACTIVE'
  | 'SUSPENDED'
  | 'DECOMMISSIONED'
  | 'MAINTENANCE'
  | 'LOST';

export interface DeviceSummary {
  id: string;
  device_type: 'WRISTBAND' | 'NODE' | 'GATEWAY';
  status: DeviceStatus;
  serial_number: string;
  assigned_tourist_id: number | null;
  last_seen: string | null;
  battery_percentage: number | null;
}

// ─── Media ────────────────────────────────────────────────
export type MediaType =
  | 'PROFILE_PHOTO'
  | 'INCIDENT_EVIDENCE_PHOTO'
  | 'INCIDENT_EVIDENCE_VIDEO'
  | 'INCIDENT_RESOLUTION_PHOTO'
  | 'INCIDENT_RESOLUTION_VIDEO';

export interface MediaUploadRequest {
  media_type: MediaType;
  content_type: string;
  file_size_bytes: number;
  incident_id?: number;
}

export interface MediaUploadResponse {
  upload_url: string;
  s3_key: string;
  expires_in: number;
}

export interface MediaResponse {
  id: number;
  s3_key: string;
  media_type: MediaType;
  uploaded_by: number;
  incident_id: number | null;
  created_at: string;
}

// ─── WS Events ────────────────────────────────────────────
export interface WSNotificationEvent {
  type: 'notification';
  data: NotificationSummary;
}

export interface WSHeartbeatEvent {
  type: 'heartbeat';
}