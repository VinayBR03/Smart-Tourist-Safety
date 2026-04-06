# app/core/enums.py

from enum import Enum


# =========================================================
# USER ROLES
# =========================================================

class UserRole(str, Enum):
    TOURIST   = "TOURIST"
    AUTHORITY = "AUTHORITY"
    ADMIN     = "ADMIN"


# =========================================================
# INCIDENT
# =========================================================

class IncidentStatus(str, Enum):
    OPEN        = "OPEN"
    IN_PROGRESS = "IN_PROGRESS"
    ESCALATED   = "ESCALATED"
    RESOLVED    = "RESOLVED"
    CLOSED      = "CLOSED"
    CANCELLED   = "CANCELLED"
    REJECTED    = "REJECTED"


class IncidentSource(str, Enum):
    MOBILE = "MOBILE"
    IOT    = "IOT"
    SYSTEM = "SYSTEM"
    ML     = "ML"
    HEALTH = "HEALTH"


# =========================================================
# DEVICE
# =========================================================

class DeviceType(str, Enum):
    WRISTBAND = "WRISTBAND"
    NODE      = "NODE"
    GATEWAY   = "GATEWAY"


class DeviceStatus(str, Enum):
    ACTIVE         = "ACTIVE"
    INACTIVE       = "INACTIVE"
    SUSPENDED      = "SUSPENDED"
    DECOMMISSIONED = "DECOMMISSIONED"
    MAINTENANCE    = "MAINTENANCE"
    LOST           = "LOST"


# =========================================================
# LOCATION
# =========================================================

class EventSource(str, Enum):
    MOBILE = "MOBILE"
    IOT    = "IOT"
    NODE   = "NODE"
    SYSTEM = "SYSTEM"


# =========================================================
# ZONE RISK
# =========================================================

class RiskLevel(str, Enum):
    LOW    = "LOW"
    MEDIUM = "MEDIUM"
    HIGH   = "HIGH"


# =========================================================
# NOTIFICATION
# =========================================================

class NotificationChannel(str, Enum):
    IN_APP = "IN_APP"
    EMAIL  = "EMAIL"
    PUSH   = "PUSH"
    SMS    = "SMS"


class NotificationSeverity(str, Enum):
    INFO     = "INFO"
    WARNING  = "WARNING"
    HIGH     = "HIGH"      # ← added: used by crowd anomaly alerts
    CRITICAL = "CRITICAL"


class NotificationStatus(str, Enum):
    PENDING   = "PENDING"
    SENT      = "SENT"
    FAILED    = "FAILED"
    CANCELLED = "CANCELLED"
    READ      = "READ"


# =========================================================
# MEDIA
# =========================================================

class MediaType(str, Enum):
    PROFILE_PHOTO              = "PROFILE_PHOTO"
    INCIDENT_RESOLUTION_PHOTO  = "INCIDENT_RESOLUTION_PHOTO"
    INCIDENT_RESOLUTION_VIDEO  = "INCIDENT_RESOLUTION_VIDEO"
    INCIDENT_EVIDENCE_PHOTO    = "INCIDENT_EVIDENCE_PHOTO"
    INCIDENT_EVIDENCE_VIDEO    = "INCIDENT_EVIDENCE_VIDEO"


# =========================================================
# AUDIT
# =========================================================

class AuditAction(str, Enum):

    # Authentication
    REGISTER_USER            = "REGISTER_USER"
    LOGIN_SUCCESS            = "LOGIN_SUCCESS"
    LOGIN_FAILED             = "LOGIN_FAILED"
    LOGOUT                   = "LOGOUT"
    TOKEN_REFRESHED          = "TOKEN_REFRESHED"
    PASSWORD_CHANGED         = "PASSWORD_CHANGED"

    # User
    UPDATE_PROFILE           = "UPDATE_PROFILE"
    REQUEST_ACCOUNT_DELETION = "REQUEST_ACCOUNT_DELETION"
    DELETE_ACCOUNT           = "DELETE_ACCOUNT"
    CREATE_USER              = "CREATE_USER"
    CANCEL_ACCOUNT_DELETION  = "CANCEL_ACCOUNT_DELETION"

    # Incident
    CREATE_INCIDENT          = "CREATE_INCIDENT"
    UPDATE_INCIDENT_STATUS   = "UPDATE_INCIDENT_STATUS"
    ASSIGN_INCIDENT          = "ASSIGN_INCIDENT"
    REASSIGN_INCIDENT        = "REASSIGN_INCIDENT"
    UNASSIGN_INCIDENT        = "UNASSIGN_INCIDENT"

    # Device
    CREATE_DEVICE            = "CREATE_DEVICE"
    UPDATE_DEVICE            = "UPDATE_DEVICE"
    UPDATE_DEVICE_STATUS     = "UPDATE_DEVICE_STATUS"
    ASSIGN_DEVICE            = "ASSIGN_DEVICE"    # ← added: wristband pairing
    UNASSIGN_DEVICE          = "UNASSIGN_DEVICE"  # ← added: wristband return

    # Location & Health
    UPDATE_LOCATION          = "UPDATE_LOCATION"
    HEALTH_ALERT_TRIGGERED   = "HEALTH_ALERT_TRIGGERED"

    # Zone
    CREATE_ZONE              = "CREATE_ZONE"
    UPDATE_ZONE              = "UPDATE_ZONE"

    # Media
    UPLOAD_MEDIA             = "UPLOAD_MEDIA"
    DELETE_MEDIA             = "DELETE_MEDIA"

    # Notification
    CREATE_NOTIFICATION      = "CREATE_NOTIFICATION"
    UPDATE_NOTIFICATION      = "UPDATE_NOTIFICATION"

    # System
    ACCESS_DENIED            = "ACCESS_DENIED"
    SYSTEM_MAINTENANCE       = "SYSTEM_MAINTENANCE"
    OUTBOX_PUBLISHED         = "OUTBOX_PUBLISHED"


# =========================================================
# ENTITY TYPES
# =========================================================

class EntityType(str, Enum):
    USER                    = "USER"
    INCIDENT                = "INCIDENT"
    INCIDENT_STATUS_HISTORY = "INCIDENT_STATUS_HISTORY"
    ZONE                    = "ZONE"
    ZONE_STATUS             = "ZONE_STATUS"
    ZONE_RISK_HISTORY       = "ZONE_RISK_HISTORY"
    DEVICE                  = "DEVICE"
    DEVICE_ASSIGNMENT       = "DEVICE_ASSIGNMENT"
    HEALTH_TELEMETRY        = "HEALTH_TELEMETRY"
    LOCATION                = "LOCATION"
    LOCATION_EVENT          = "LOCATION_EVENT"
    NOTIFICATION            = "NOTIFICATION"
    MEDIA                   = "MEDIA"
    OUTBOX_EVENT            = "OUTBOX_EVENT"
    SYSTEM                  = "SYSTEM"
    ASSIGNMENT              = "ASSIGNMENT"


# =========================================================
# LANGUAGES
#
# Values are lowercase to match LOCALES dict keys in
# email_template.py ("en", "hi", "kn", "te", "ta", "ml").
# Uppercase values caused language resolution to always
# fall back to English regardless of user preference.
# =========================================================

class UserLanguage(str, Enum):
    EN = "EN"
    HI = "HI"
    KN = "KN"
    TE = "TE"
    TA = "TA"
    ML = "ML"