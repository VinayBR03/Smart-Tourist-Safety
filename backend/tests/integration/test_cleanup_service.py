import pytest
from datetime import datetime, timedelta, timezone
import uuid

from app.services.cleanup_service import (
    permanently_delete_expired_accounts,
    admin_force_delete_user,
)

from app.models.user import User
from app.models.refresh_token import RefreshToken
from app.models.device_assignment import DeviceAssignment
from app.models.incident import Incident
from app.models.media import Media
from app.models.iot_device import IoTDevice

from app.core.enums import (
    IncidentStatus,
    IncidentSource,
    UserRole,
    DeviceType,
    DeviceStatus,
    MediaType,
)

from app.core.security import hash_password
from app.core.config import settings


# =========================================================
# TEST UTILITIES
# =========================================================


def create_user(db, pending=True, days_old=40):
    now = datetime.now(timezone.utc)

    deletion_requested_at = (
        now - timedelta(days=days_old)
        if pending
        else None
    )

    user = User(
        email=f"cleanup_{uuid.uuid4().hex}@test.com",
        password_hash=hash_password("StrongPass123!"),
        role=UserRole.TOURIST,
        is_active=True,
        is_verified=True,
        is_deleted=False,
        deleted_at=None,
        is_pending_deletion=pending,
        deletion_requested_at=deletion_requested_at,
        token_version=1,
    )

    db.add(user)
    db.commit()
    return user


def create_device(db, device_id: str):
    device = IoTDevice(
        device_id=device_id,
        api_key_hash=uuid.uuid4().hex * 2,  # 64 chars
        device_type=DeviceType.WRISTBAND,
        status=DeviceStatus.ACTIVE,
        is_verified=True,
    )
    db.add(device)
    db.commit()
    return device


@pytest.fixture(autouse=True)
def mock_side_effects(mocker):
    mocker.patch("app.services.cleanup_service.create_audit_log")
    mocker.patch("app.services.cleanup_service.create_outbox_event")
    mocker.patch(
        "app.services.cleanup_service.get_correlation_id",
        return_value="test-correlation-id",
    )


# =========================================================
# PERMANENT DELETE FLOW
# =========================================================


def test_permanent_delete_full_flow(db_session):

    settings.ACCOUNT_DELETION_GRACE_DAYS = 30
    settings.ACCOUNT_DELETION_BATCH_SIZE = 100

    user = create_user(db_session, pending=True, days_old=40)

    create_device(db_session, "dev-clean-1")

    # Valid refresh token (expires_at NOT NULL)
    token = RefreshToken(
        user_id=user.id,
        jti=uuid.uuid4().hex,
        token_hash=uuid.uuid4().hex * 2,
        is_revoked=False,
        expires_at=datetime.now(timezone.utc) + timedelta(days=30),
    )
    db_session.add(token)

    # Device assignment
    assignment = DeviceAssignment(
        device_id="dev-clean-1",
        tourist_id=user.id,
    )
    db_session.add(assignment)

    # Active incident
    incident = Incident(
        tourist_id=user.id,
        description="Test incident",
        status=IncidentStatus.OPEN,
        source=IncidentSource.MOBILE,
        is_auto_generated=False,
    )
    db_session.add(incident)

    # Valid media row (satisfies all constraints)
    media = Media(
        user_id=user.id,
        incident_id=None,  # exactly one owner
        media_type=MediaType.PROFILE_PHOTO,
        s3_key=f"test/{uuid.uuid4().hex}.jpg",
        content_type="image/jpeg",
        file_size_bytes=1024,
        is_deleted=False,
    )
    db_session.add(media)

    db_session.commit()

    deleted_count = permanently_delete_expired_accounts(db_session)
    db_session.commit()

    assert deleted_count == 1

    db_session.refresh(user)

    assert user.deleted_at is not None
    assert user.is_deleted is True
    assert user.is_active is False
    assert user.is_pending_deletion is False
    assert user.deletion_requested_at is None
    assert user.email.startswith("deleted_")

    token = db_session.query(RefreshToken).first()
    assert token.is_revoked is True

    assignment = db_session.query(DeviceAssignment).first()
    assert assignment.unassigned_at is not None

    incident = db_session.query(Incident).first()
    assert incident.status == IncidentStatus.CLOSED
    assert incident.resolved_at is not None

    media = db_session.query(Media).first()
    assert media.is_deleted is True
    assert media.deleted_at is not None


# =========================================================
# BELOW THRESHOLD — NO DELETE
# =========================================================


def test_no_delete_if_not_past_threshold(db_session):

    settings.ACCOUNT_DELETION_GRACE_DAYS = 30
    settings.ACCOUNT_DELETION_BATCH_SIZE = 100

    user = create_user(db_session, pending=True, days_old=2)

    deleted_count = permanently_delete_expired_accounts(db_session)
    db_session.commit()

    assert deleted_count == 0

    db_session.refresh(user)
    assert user.deleted_at is None
    assert user.is_deleted is False


# =========================================================
# ADMIN FORCE DELETE
# =========================================================


def test_admin_force_delete(db_session):

    user = create_user(db_session, pending=False)
    admin_user = create_user(db_session, pending=False)

    admin_force_delete_user(
        db=db_session,
        user_id=user.id,
        performed_by=admin_user.id,
    )

    db_session.commit()
    db_session.refresh(user)

    assert user.deleted_at is not None
    assert user.is_deleted is True
    assert user.is_active is False
    assert user.is_pending_deletion is False
    assert user.deletion_requested_at is None


# =========================================================
# USER NOT FOUND
# =========================================================


def test_admin_force_delete_not_found(db_session):

    with pytest.raises(Exception):
        admin_force_delete_user(
            db=db_session,
            user_id=99999,
            performed_by=1,
        )