import pytest
from datetime import datetime, timezone, timedelta

from app.services.device_service import (
    register_device,
    assign_device_to_tourist,
    unassign_device,
    update_heartbeat,
    update_device_status,
    mark_device_offline,
)

from app.models.iot_device import IoTDevice
from app.models.device_assignment import DeviceAssignment
from app.models.user import User

from app.core.enums import (
    DeviceType,
    DeviceStatus,
    UserRole,
)

from app.core.exceptions import (
    ValidationError,
    ConflictError,
)

from app.core.security import hash_password


# =========================================================
# TEST UTIL
# =========================================================

def create_user(db, email="tourist@test.com"):
    user = User(
        email=email,
        password_hash=hash_password("StrongPassword123!"),
        role=UserRole.TOURIST,
        is_active=True,
        is_pending_deletion=False,
    )
    db.add(user)
    db.commit()
    return user


class DummyPayload:
    def __init__(self, device_id, device_type):
        self.device_id = device_id
        self.device_type = device_type


# =========================================================
# GLOBAL MOCKS
# =========================================================

@pytest.fixture(autouse=True)
def mock_side_effects(mocker):
    mocker.patch("app.services.device_service.create_outbox_event")
    mocker.patch("app.services.device_service.create_audit_log")
    mocker.patch("app.services.device_service.create_notification")
    mocker.patch("app.services.device_service.rate_limiter.enforce")


# =========================================================
# REGISTER DEVICE
# =========================================================

def test_register_device_success(db_session):
    payload = DummyPayload("dev-1", DeviceType.WRISTBAND)

    result = register_device(db_session, payload=payload)
    db_session.commit()

    device = db_session.query(IoTDevice).first()

    assert device is not None
    assert device.status == DeviceStatus.INACTIVE
    assert result["api_key"] is not None


def test_register_device_duplicate(db_session):
    payload = DummyPayload("dev-2", DeviceType.WRISTBAND)
    register_device(db_session, payload=payload)
    db_session.commit()

    with pytest.raises(ConflictError):
        register_device(db_session, payload=payload)


# =========================================================
# ASSIGN DEVICE
# =========================================================

def test_assign_device_creates_assignment_record(db_session):
    user = create_user(db_session)

    payload = DummyPayload("dev-3", DeviceType.WRISTBAND)
    register_device(db_session, payload=payload)
    db_session.commit()

    assign_device_to_tourist(
        db_session,
        device_id="dev-3",
        tourist_id=user.id,
    )
    db_session.commit()

    assignment = db_session.query(DeviceAssignment).first()
    assert assignment.tourist_id == user.id


def test_assign_device_twice_fails(db_session):
    user1 = create_user(db_session, "u1@test.com")
    user2 = create_user(db_session, "u2@test.com")

    payload = DummyPayload("dev-4", DeviceType.WRISTBAND)
    register_device(db_session, payload=payload)
    db_session.commit()

    assign_device_to_tourist(
        db_session,
        device_id="dev-4",
        tourist_id=user1.id,
    )
    db_session.commit()

    with pytest.raises(ConflictError):
        assign_device_to_tourist(
            db_session,
            device_id="dev-4",
            tourist_id=user2.id,
        )


def test_assign_decommissioned_device_fails(db_session):
    user = create_user(db_session)

    payload = DummyPayload("dev-5", DeviceType.WRISTBAND)
    register_device(db_session, payload=payload)
    db_session.commit()

    device = db_session.query(IoTDevice).first()
    device.status = DeviceStatus.DECOMMISSIONED
    device.decommissioned_at = datetime.now(timezone.utc)
    db_session.commit()

    with pytest.raises(ValidationError):
        assign_device_to_tourist(
            db_session,
            device_id="dev-5",
            tourist_id=user.id,
        )


# =========================================================
# UNASSIGN DEVICE
# =========================================================

def test_unassign_device_success(db_session):
    user = create_user(db_session)

    payload = DummyPayload("dev-6", DeviceType.WRISTBAND)
    register_device(db_session, payload=payload)
    db_session.commit()

    assign_device_to_tourist(
        db_session,
        device_id="dev-6",
        tourist_id=user.id,
    )
    db_session.commit()

    unassign_device(db_session, device_id="dev-6")
    db_session.commit()

    assignment = db_session.query(DeviceAssignment).first()
    assert assignment.unassigned_at is not None


def test_unassign_not_assigned_fails(db_session):
    payload = DummyPayload("dev-7", DeviceType.WRISTBAND)
    register_device(db_session, payload=payload)
    db_session.commit()

    with pytest.raises(ValidationError):
        unassign_device(db_session, device_id="dev-7")


# =========================================================
# HEARTBEAT
# =========================================================

def test_heartbeat_updates_device_and_activates(db_session):
    payload = DummyPayload("dev-8", DeviceType.WRISTBAND)
    register_device(db_session, payload=payload)
    db_session.commit()

    device = update_heartbeat(
        db_session,
        device_id="dev-8",
        battery_percentage=50,
        battery_voltage=3.7,
        firmware_version="1.0.0",
    )

    assert device.status == DeviceStatus.ACTIVE
    assert device.battery_percentage == 50


def test_heartbeat_invalid_battery(db_session):
    payload = DummyPayload("dev-9", DeviceType.WRISTBAND)
    register_device(db_session, payload=payload)
    db_session.commit()

    with pytest.raises(ValidationError):
        update_heartbeat(
            db_session,
            device_id="dev-9",
            battery_percentage=150,
            battery_voltage=None,
            firmware_version=None,
        )


def test_heartbeat_invalid_firmware(db_session):
    payload = DummyPayload("dev-10", DeviceType.WRISTBAND)
    register_device(db_session, payload=payload)
    db_session.commit()

    with pytest.raises(ValidationError):
        update_heartbeat(
            db_session,
            device_id="dev-10",
            battery_percentage=50,
            battery_voltage=None,
            firmware_version="bad$$$",
        )


# =========================================================
# LOW BATTERY
# =========================================================

def test_low_battery_sets_alert_timestamp(db_session):
    payload = DummyPayload("dev-11", DeviceType.WRISTBAND)
    register_device(db_session, payload=payload)
    db_session.commit()

    device = db_session.query(IoTDevice).first()
    device.battery_percentage = 50
    db_session.commit()

    update_heartbeat(
        db_session,
        device_id="dev-11",
        battery_percentage=10,
        battery_voltage=None,
        firmware_version=None,
    )

    assert device.low_battery_alerted_at is not None


# =========================================================
# STATUS TRANSITIONS
# =========================================================

def test_valid_status_transition(db_session):
    payload = DummyPayload("dev-12", DeviceType.WRISTBAND)
    register_device(db_session, payload=payload)
    db_session.commit()

    # INACTIVE → ACTIVE (valid)
    update_device_status(
        db_session,
        device_id="dev-12",
        status=DeviceStatus.ACTIVE,
        performed_by=None,
    )
    db_session.commit()

    # ACTIVE → SUSPENDED (valid)
    device = update_device_status(
        db_session,
        device_id="dev-12",
        status=DeviceStatus.SUSPENDED,
        performed_by=None,
    )

    assert device.status == DeviceStatus.SUSPENDED


def test_invalid_status_transition(db_session):
    payload = DummyPayload("dev-13", DeviceType.WRISTBAND)
    register_device(db_session, payload=payload)
    db_session.commit()

    # INACTIVE → SUSPENDED is invalid
    with pytest.raises(ConflictError):
        update_device_status(
            db_session,
            device_id="dev-13",
            status=DeviceStatus.SUSPENDED,
            performed_by=None,
        )


# =========================================================
# MARK OFFLINE
# =========================================================

def test_mark_device_offline_changes_status(db_session):
    payload = DummyPayload("dev-14", DeviceType.WRISTBAND)
    register_device(db_session, payload=payload)
    db_session.commit()

    device = db_session.query(IoTDevice).first()
    device.status = DeviceStatus.ACTIVE
    db_session.commit()

    updated = mark_device_offline(db_session, device=device)

    assert updated.status == DeviceStatus.INACTIVE


def test_mark_device_offline_idempotent(db_session):
    payload = DummyPayload("dev-15", DeviceType.WRISTBAND)
    register_device(db_session, payload=payload)
    db_session.commit()

    device = db_session.query(IoTDevice).first()

    updated = mark_device_offline(db_session, device=device)

    assert updated.status == device.status