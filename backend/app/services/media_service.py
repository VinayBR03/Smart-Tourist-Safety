from datetime import datetime, timezone
from typing import Optional, List
import uuid
import re

from sqlalchemy.orm import Session
from sqlalchemy import select, func

from app.models.media import Media
from app.models.user import User
from app.models.incident import Incident

from app.core.enums import (
    MediaType,
    IncidentStatus,
    UserRole,
    AuditAction,
    EntityType,
)

from app.core.exceptions import (
    ValidationError,
    NotFoundError,
    ForbiddenError,
    ConflictError,
)

from app.core.s3_client import S3Client
s3_client = S3Client()
from app.services.audit_service import create_audit_log
from app.services.outbox_service import create_outbox_event
from app.core.rate_limiter import RateLimiter


rate_limiter = RateLimiter()

MAX_PROFILE_PHOTO_BYTES = 5 * 1024 * 1024
MAX_INCIDENT_MEDIA_BYTES = 50 * 1024 * 1024
MAX_MEDIA_PER_INCIDENT = 20

ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "video/mp4",
}

S3_KEY_REGEX = re.compile(r"^[a-zA-Z0-9/_\-.]+$")


def _now():
    return datetime.now(timezone.utc)


# =========================================================
# Generate Presigned Upload
# =========================================================

def generate_presigned_upload(
    db: Session,
    *,
    user_id: int,
    user_role: UserRole,
    media_type: MediaType,
    content_type: str,
    file_size_bytes: int,
    incident_id: Optional[int],
):

    rate_limiter.enforce(
        prefix="media_upload",
        identifier=str(user_id),
        limit=20,
        window_seconds=60,
    )

    if content_type not in ALLOWED_CONTENT_TYPES:
        raise ValidationError("Unsupported content type")

    if file_size_bytes <= 0:
        raise ValidationError("Invalid file size")

    user = db.query(User).filter(
        User.id == user_id,
        User.deleted_at.is_(None),
        User.is_active.is_(True),
    ).first()

    if not user:
        raise NotFoundError("User")

    if media_type == MediaType.PROFILE_PHOTO:

        if incident_id is not None:
            raise ValidationError("Profile photo cannot have incident_id")

        if not content_type.startswith("image/"):
            raise ValidationError("Profile photo must be image")

        if file_size_bytes > MAX_PROFILE_PHOTO_BYTES:
            raise ValidationError("Profile photo too large")

    else:

        if not isinstance(incident_id, int):
            raise ValidationError("Incident required")

        incident = db.query(Incident).filter(
            Incident.id == incident_id,
            Incident.deleted_at.is_(None),
        ).first()

        if not incident:
            raise NotFoundError("Incident")

        if media_type in {
            MediaType.INCIDENT_EVIDENCE_PHOTO,
            MediaType.INCIDENT_EVIDENCE_VIDEO,
        }:

            if user_role != UserRole.TOURIST:
                raise ForbiddenError("Only tourist can upload evidence")

            if incident.tourist_id != user_id:
                raise ForbiddenError("Incident access denied")

            if incident.status == IncidentStatus.CLOSED.value:
                raise ForbiddenError("Incident closed")

        elif media_type in {
            MediaType.INCIDENT_RESOLUTION_PHOTO,
            MediaType.INCIDENT_RESOLUTION_VIDEO,
        }:

            if user_role not in {UserRole.AUTHORITY, UserRole.ADMIN}:
                raise ForbiddenError("Only authority can upload resolution media")

            if incident.status not in {
                IncidentStatus.IN_PROGRESS.value,
                IncidentStatus.RESOLVED.value,
            }:
                raise ForbiddenError("Invalid incident state")

        else:
            raise ValidationError("Invalid media type")

        if file_size_bytes > MAX_INCIDENT_MEDIA_BYTES:
            raise ValidationError("Incident media too large")

    key = _generate_s3_key(
        user_id=user_id,
        media_type=media_type,
        incident_id=incident_id,
    )

    upload_url = s3_client.generate_presigned_upload_url(
        key=key,
        content_type=content_type,
    )

    return {
        "upload_url": upload_url,
        "s3_key": key,
    }


# =========================================================
# Confirm Upload
# =========================================================

def confirm_media_upload(
    db: Session,
    *,
    user_id: int,
    media_type: MediaType,
    s3_key: str,
    incident_id: Optional[int],
):

    if not S3_KEY_REGEX.match(s3_key) or ".." in s3_key:
        raise ValidationError("Invalid S3 key")

    existing = db.query(Media).filter(
        Media.s3_key == s3_key,
        Media.is_deleted.is_(False),
    ).with_for_update().first()

    if existing:
        return existing

    metadata = s3_client.get_object_metadata(s3_key)
    if not isinstance(metadata, dict):
        raise ValidationError("Invalid S3 metadata")

    size = metadata.get("size")
    content_type = metadata.get("content_type")

    if content_type not in ALLOWED_CONTENT_TYPES:
        raise ValidationError("Invalid uploaded content type")

    if size > MAX_INCIDENT_MEDIA_BYTES:
        raise ValidationError("File too large")

    if media_type != MediaType.PROFILE_PHOTO:

        count = db.query(func.count(Media.id)).filter(
            Media.incident_id == incident_id,
            Media.is_deleted.is_(False),
        ).scalar()

        if count >= MAX_MEDIA_PER_INCIDENT:
            raise ConflictError("Incident media limit reached")

    now = _now()

    media = Media(
        user_id=user_id if media_type == MediaType.PROFILE_PHOTO else None,
        incident_id=incident_id if media_type != MediaType.PROFILE_PHOTO else None,
        uploaded_by=user_id,
        media_type=media_type,
        s3_key=s3_key,
        content_type=content_type,
        file_size_bytes=size,
        uploaded_at=now,
    )

    db.add(media)
    db.flush()

    create_audit_log(
        db=db,
        user_id=user_id,
        action=AuditAction.UPLOAD_MEDIA,
        entity_type=EntityType.MEDIA,
        entity_id=media.id,
    )

    create_outbox_event(
        db=db,
        topic="media.uploaded",
        payload={"media_id": media.id},
    )

    return media


# =========================================================
# Read Functions
# =========================================================

def get_media_by_id(db: Session, *, media_id: int) -> Media:

    media = db.query(Media).filter(
        Media.id == media_id,
        Media.is_deleted.is_(False),
    ).first()

    if not media:
        raise NotFoundError("Media")

    return media


def list_media_for_user(db: Session, *, user_id: int) -> List[Media]:

    return db.query(Media).filter(
        Media.uploaded_by == user_id,
        Media.is_deleted.is_(False),
    ).order_by(Media.uploaded_at.desc()).all()


def list_media_for_incident(db: Session, *, incident_id: int) -> List[Media]:

    return db.query(Media).filter(
        Media.incident_id == incident_id,
        Media.is_deleted.is_(False),
    ).order_by(Media.uploaded_at.desc()).all()


# =========================================================
# Helpers
# =========================================================

def _generate_s3_key(
    *,
    user_id: int,
    media_type: MediaType,
    incident_id: Optional[int],
) -> str:

    unique = uuid.uuid4().hex

    if media_type == MediaType.PROFILE_PHOTO:
        return f"profile/{user_id}/{unique}"

    if media_type in {
        MediaType.INCIDENT_EVIDENCE_PHOTO,
        MediaType.INCIDENT_EVIDENCE_VIDEO,
    }:
        return f"incident/{incident_id}/evidence/{unique}"

    return f"incident/{incident_id}/resolution/{unique}"