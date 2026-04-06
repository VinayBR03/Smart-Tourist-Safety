# app/services/tourist_service.py

from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Optional

from sqlalchemy.orm import Session
from sqlalchemy import func, select

from app.models.user import User
from app.models.location_event import LocationEvent
from app.models.media import Media

from app.core.enums import (
    AuditAction,
    EntityType,
    UserRole,
    MediaType,
    UserLanguage,
)

from app.core.exceptions import (
    NotFoundError,
    ValidationError,
    ForbiddenError,
)

from app.services.audit_service import create_audit_log
from app.services.outbox_service import create_outbox_event
from app.core.logging_config import get_correlation_id
from app.core.config import settings
from app.utils.logger import get_logger


logger = get_logger(__name__)

MAX_FIELD_LENGTH = 500

# ── ALL fields a tourist is allowed to update ─────────────
# Added: preferred_language, gender, date_of_birth, emergency_contact
ALLOWED_PROFILE_FIELDS = {
    "full_name",
    "phone",
    "nationality",
    "blood_group",
    "medical_conditions",
    "allergies",
    "preferred_language",   
    "gender",               
    "date_of_birth",        
    "emergency_contact",    
}

# Fields that store enum values — validated against allowed set
LANGUAGE_VALUES = {lang.value for lang in UserLanguage}


# =========================================================
# Helpers
# =========================================================

def _validate_tourist_id(tourist_id: int) -> None:
    if not isinstance(tourist_id, int) or tourist_id <= 0:
        raise ValidationError("Invalid tourist_id")


def _calculate_activity_status(last_seen: Optional[datetime]) -> str:
    if not last_seen:
        return "offline"
    if last_seen.tzinfo is None:
        last_seen = last_seen.replace(tzinfo=timezone.utc)
    now = datetime.now(timezone.utc)
    if last_seen > now:
        return "active"
    diff = now - last_seen
    if diff <= timedelta(minutes=5):
        return "active"
    if diff <= timedelta(minutes=15):
        return "delayed"
    return "offline"


def _get_tourist(db: Session, *, tourist_id: int, lock: bool = False) -> User:
    stmt = select(User).where(
        User.id == tourist_id,
        User.role == UserRole.TOURIST.value,
        User.deleted_at.is_(None),
        User.is_active.is_(True),
        User.is_pending_deletion.is_(False),
    )
    if lock:
        stmt = stmt.with_for_update()
    tourist = db.execute(stmt).scalar_one_or_none()
    if not tourist:
        raise NotFoundError("Tourist")
    return tourist


def _serialize_tourist(user: User) -> Dict[str, Any]:
    # Normalise preferred_language to lowercase string for frontend
    lang = user.preferred_language
    if hasattr(lang, 'value'):
        lang_str = lang.value          # e.g. UserLanguage.EN → "en"
    elif isinstance(lang, str):
        lang_str = lang.lower()        # "EN" → "en"
    else:
        lang_str = "en"

    return {
        "id":                 user.id,
        "email":              user.email,
        "role":               user.role,
        "is_active":          user.is_active,
        "is_verified":        user.is_verified,
        "full_name":          user.full_name,
        "phone":              user.phone,
        "nationality":        user.nationality,
        "blood_group":        user.blood_group,
        "medical_conditions": user.medical_conditions,
        "allergies":          user.allergies,
        "preferred_language": lang_str,
        "gender":             user.gender,
        "date_of_birth":      str(user.date_of_birth) if user.date_of_birth else None,
        "emergency_contact":  user.emergency_contact,
        "last_login":         user.last_login,
        "created_at":         user.created_at,
        "updated_at":         user.updated_at,
    }


# =========================================================
# Public Fetch
# =========================================================

def get_tourist_by_id(db: Session, *, tourist_id: int) -> Dict[str, Any]:
    _validate_tourist_id(tourist_id)
    tourist = _get_tourist(db, tourist_id=tourist_id)
    last_seen = (
        db.query(func.max(LocationEvent.timestamp))
        .filter(LocationEvent.tourist_id == tourist_id)
        .scalar()
    )
    return {
        "user":            _serialize_tourist(tourist),
        "activity_status": _calculate_activity_status(last_seen),
    }


# =========================================================
# Update Profile  ← KEY FIX — validates + commits all fields
# =========================================================

def update_tourist_profile(
    db: Session,
    *,
    tourist_id: int,
    updates: Dict[str, Any],
) -> User:

    _validate_tourist_id(tourist_id)
    tourist = _get_tourist(db, tourist_id=tourist_id, lock=True)

    if not isinstance(updates, dict):
        raise ValidationError("Invalid update payload")

    changed_fields: Dict[str, Any] = {}
    old_data: Dict[str, Any] = {}

    for key, value in updates.items():

        if key not in ALLOWED_PROFILE_FIELDS:
            continue

        if key == "preferred_language":
            if not isinstance(value, str):
                raise ValidationError("preferred_language must be a string")
            value_lower = value.strip().lower()

            # Map incoming lowercase string to enum member
            # Enum: EN="en", HI="hi"... so UserLanguage(value_lower) works
            try:
                lang_enum = UserLanguage(value_lower)
            except ValueError:
                # Also try uppercase key lookup for backward compat
                try:
                    lang_enum = UserLanguage[value_lower.upper()]
                except KeyError:
                    raise ValidationError(
                        f"Invalid language: '{value_lower}'. "
                        f"Valid options: en, hi, kn, te, ta, ml"
                    )

            # Store the enum member — SQLAlchemy maps it to the correct DB value
            current = getattr(tourist, key)
            # normalise current for comparison
            current_val = current.value if hasattr(current, 'value') else str(current).lower()
            if current_val == value_lower:
                continue

            old_data[key]       = str(current)
            changed_fields[key] = lang_enum   # ← store enum member, not raw string
            continue                          # ← skip the string-only path below

        # All other string fields
        if not isinstance(value, str):
            raise ValidationError(f"Invalid type for {key}")
        value = value.strip()
        if not value or len(value) > MAX_FIELD_LENGTH:
            continue
        current_value = getattr(tourist, key)
        if current_value == value:
            continue
        old_data[key]       = current_value
        changed_fields[key] = value

    if not changed_fields:
        return tourist

    for field, value in changed_fields.items():
        setattr(tourist, field, value)

    tourist.updated_at = datetime.now(timezone.utc)

    # ── COMMIT — was missing ──────────────────────────────
    db.flush()   # write to transaction buffer
    db.commit()  # persist to DB
    db.refresh(tourist)

    create_audit_log(
        db=db,
        user_id=tourist.id,
        action=AuditAction.UPDATE_PROFILE,
        entity_type=EntityType.USER,
        entity_id=tourist.id,
        old_value={k: str(v) for k, v in old_data.items()},
        new_value={k: str(v) for k, v in changed_fields.items()},
    )

    logger.info(
        "Tourist profile updated",
        extra={
            "tourist_id":     tourist.id,
            "changed_fields": list(changed_fields.keys()),
        },
    )

    return tourist


# =========================================================
# Profile Photo
# =========================================================

def get_profile_photo_key(db: Session, *, tourist_id: int) -> Optional[str]:
    _validate_tourist_id(tourist_id)
    _get_tourist(db, tourist_id=tourist_id)
    stmt = (
        select(Media.s3_key)
        .where(
            Media.user_id == tourist_id,
            Media.media_type == MediaType.PROFILE_PHOTO.value,
            Media.is_deleted.is_(False),
        )
        .order_by(Media.uploaded_at.desc())
        .limit(1)
    )
    return db.execute(stmt).scalar_one_or_none()


# =========================================================
# Request Account Deletion
# =========================================================

def request_account_deletion(db: Session, *, tourist_id: int) -> None:
    _validate_tourist_id(tourist_id)
    tourist = _get_tourist(db, tourist_id=tourist_id, lock=True)

    if tourist.deleted_at:
        raise ForbiddenError("Account already deleted")
    if tourist.is_pending_deletion:
        return

    now = datetime.now(timezone.utc)
    grace_days = getattr(settings, "ACCOUNT_DELETION_GRACE_DAYS", 7)

    tourist.is_pending_deletion    = True
    tourist.deletion_requested_at  = now
    tourist.updated_at             = now

    db.flush()
    db.commit()

    create_audit_log(
        db=db,
        user_id=tourist.id,
        action=AuditAction.DELETE_ACCOUNT,
        entity_type=EntityType.USER,
        entity_id=tourist.id,
        new_value={"deletion_requested_at": now.isoformat()},
    )

    logger.info("Tourist requested account deletion", extra={"tourist_id": tourist.id})