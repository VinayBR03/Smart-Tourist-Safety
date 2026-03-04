from datetime import datetime, timedelta, timezone
from typing import List
import uuid

from sqlalchemy.orm import Session
from sqlalchemy import select

from app.models.user import User
from app.models.refresh_token import RefreshToken
from app.models.media import Media
from app.models.device_assignment import DeviceAssignment
from app.models.incident import Incident

from app.core.exceptions import NotFoundError, ValidationError
from app.core.enums import (
    AuditAction,
    EntityType,
    IncidentStatus,
)

from app.services.audit_service import create_audit_log
from app.services.outbox_service import create_outbox_event
from app.core.config import settings
from app.core.logging_config import get_correlation_id
from app.utils.logger import get_logger


logger = get_logger(__name__)


# =========================================================
# Permanently Delete Expired Accounts (FIXED)
# =========================================================

def permanently_delete_expired_accounts(db: Session) -> int:

    if settings.ACCOUNT_DELETION_GRACE_DAYS <= 0:
        raise ValidationError("Invalid ACCOUNT_DELETION_GRACE_DAYS")

    now = datetime.now(timezone.utc)

    # ✅ Correct production-safe threshold approach
    threshold = now - timedelta(days=settings.ACCOUNT_DELETION_GRACE_DAYS)

    stmt = (
        select(User)
        .where(
            User.is_pending_deletion.is_(True),
            User.deleted_at.is_(None),
            User.deletion_requested_at.isnot(None),
            User.deletion_requested_at <= threshold,  # ✅ FIXED
        )
        .limit(settings.ACCOUNT_DELETION_BATCH_SIZE)
        .with_for_update()
    )

    users: List[User] = db.execute(stmt).scalars().all()

    deleted_count = 0

    for user in users:
        _hard_delete_user(db=db, user=user)
        deleted_count += 1

    return deleted_count


# =========================================================
# HARD DELETE USER
# =========================================================

def _hard_delete_user(db: Session, *, user: User) -> None:

    if user.deleted_at is not None:
        return

    now = datetime.now(timezone.utc)
    correlation_id = get_correlation_id()

    # 1️⃣ Invalidate JWTs
    user.token_version += 1

    # 2️⃣ Revoke refresh tokens
    db.query(RefreshToken).filter(
        RefreshToken.user_id == user.id,
        RefreshToken.is_revoked.is_(False),
    ).update(
        {
            "is_revoked": True,
            "revoked_at": now,
        },
        synchronize_session=False,
    )

    # 3️⃣ Unassign active devices
    db.query(DeviceAssignment).filter(
        DeviceAssignment.tourist_id == user.id,
        DeviceAssignment.unassigned_at.is_(None),
    ).update(
        {"unassigned_at": now},
        synchronize_session=False,
    )

    # 4️⃣ Close active incidents
    db.query(Incident).filter(
        Incident.tourist_id == user.id,
        Incident.status.in_(
            [
                IncidentStatus.OPEN,
                IncidentStatus.IN_PROGRESS,
            ]
        ),
    ).update(
        {
            "status": IncidentStatus.CLOSED,
            "resolved_at": now,
            "updated_at": now,
        },
        synchronize_session=False,
    )

    # 5️⃣ Soft-delete media
    media_list = (
        db.query(Media)
        .filter(
            Media.user_id == user.id,
            Media.is_deleted.is_(False),
        )
        .all()
    )

    for media in media_list:
        media.is_deleted = True
        media.deleted_at = now

        create_outbox_event(
            db=db,
            topic="media.delete_s3",
            payload={"s3_key": media.s3_key},
            correlation_id=correlation_id,
        )

    # 6️⃣ Scrub PII
    user.email = f"deleted_{user.id}_{uuid.uuid4().hex}@deleted.local"
    user.password_hash = uuid.uuid4().hex
    user.full_name = None
    user.phone = None
    user.emergency_contact = None
    user.medical_conditions = None
    user.allergies = None

    # 7️⃣ Soft-delete flags
    user.deletion_requested_at = None
    user.deleted_at = now
    user.is_deleted = True
    user.is_active = False
    user.is_pending_deletion = False

    # 8️⃣ Audit
    create_audit_log(
        db=db,
        user_id=user.id,
        action=AuditAction.DELETE_ACCOUNT,
        entity_type=EntityType.USER,
        entity_id=user.id,
    )

    # 9️⃣ Outbox
    create_outbox_event(
        db=db,
        topic="user.deleted",
        payload={
            "user_id": user.id,
            "deleted_at": now.isoformat(),
        },
        correlation_id=correlation_id,
    )


# =========================================================
# Admin Force Delete
# =========================================================

def admin_force_delete_user(
    db: Session,
    *,
    user_id: int,
    performed_by: int,
) -> None:

    stmt = (
        select(User)
        .where(User.id == user_id)
        .with_for_update()
    )

    user = db.execute(stmt).scalar_one_or_none()

    if not user:
        raise NotFoundError("User")

    _hard_delete_user(db=db, user=user)

    create_audit_log(
        db=db,
        user_id=performed_by,
        action=AuditAction.DELETE_ACCOUNT,
        entity_type=EntityType.USER,
        entity_id=user_id,
    )