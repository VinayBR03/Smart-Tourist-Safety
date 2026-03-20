// src/types/enums.ts

export enum UserRole {
  TOURIST   = 'TOURIST',
  AUTHORITY = 'AUTHORITY',
  ADMIN     = 'ADMIN',
}

export enum UserLanguage {
  EN = 'EN',
  HI = 'HI',
  KN = 'KN',
  TE = 'TE',
  TA = 'TA',
  ML = 'ML',
}

export enum IncidentStatus {
  OPEN        = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  ESCALATED   = 'ESCALATED',
  RESOLVED    = 'RESOLVED',
  CLOSED      = 'CLOSED',
  CANCELLED   = 'CANCELLED',
  REJECTED    = 'REJECTED',
}

export enum IncidentSource {
  MOBILE = 'MOBILE',
  IOT    = 'IOT',
  SYSTEM = 'SYSTEM',
  ML     = 'ML',
  HEALTH = 'HEALTH',
}

export enum DeviceType {
  WRISTBAND = 'WRISTBAND',
  NODE      = 'NODE',
  GATEWAY   = 'GATEWAY',
}

export enum DeviceStatus {
  ACTIVE        = 'ACTIVE',
  INACTIVE      = 'INACTIVE',
  SUSPENDED     = 'SUSPENDED',
  DECOMMISSIONED= 'DECOMMISSIONED',
  MAINTENANCE   = 'MAINTENANCE',
  LOST          = 'LOST',
}

export enum RiskLevel {
  LOW    = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH   = 'HIGH',
}

export enum NotificationChannel {
  IN_APP = 'IN_APP',
  EMAIL  = 'EMAIL',
  PUSH   = 'PUSH',
  SMS    = 'SMS',
}

export enum NotificationSeverity {
  INFO     = 'INFO',
  WARNING  = 'WARNING',
  CRITICAL = 'CRITICAL',
}

export enum NotificationStatus {
  PENDING   = 'PENDING',
  SENT      = 'SENT',
  FAILED    = 'FAILED',
  CANCELLED = 'CANCELLED',
  READ      = 'READ',
}

export enum MediaType {
  PROFILE_PHOTO               = 'PROFILE_PHOTO',
  INCIDENT_RESOLUTION_PHOTO   = 'INCIDENT_RESOLUTION_PHOTO',
  INCIDENT_RESOLUTION_VIDEO   = 'INCIDENT_RESOLUTION_VIDEO',
  INCIDENT_EVIDENCE_PHOTO     = 'INCIDENT_EVIDENCE_PHOTO',
  INCIDENT_EVIDENCE_VIDEO     = 'INCIDENT_EVIDENCE_VIDEO',
}

export enum EventSource {
  MOBILE = 'MOBILE',
  IOT    = 'IOT',
  NODE   = 'NODE',
  SYSTEM = 'SYSTEM',
}