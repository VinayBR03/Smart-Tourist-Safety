import pytest
from datetime import datetime, timezone
from unittest.mock import MagicMock

from app.services.iot_service import handle_location_event
from app.models.iot_device import IoTDevice
from app.models.device_assignment import DeviceAssignment
from app.models.location_event import LocationEvent
from app.models.user import User

from app.core.enums import DeviceStatus, DeviceType, UserRole
from app.core.exceptions import NotFoundError, ForbiddenError
from app.core.security import hash_password


# ----------------------------------------------------------
# Helpers
# ----------------------------------------------------------

def create_tourist(db):
    user = User(
        email=f"tourist_{datetime.now().timestamp()}@example.com",
        password_hash=hash_password("StrongPassword123!"),
        role=UserRole.TOURIST.value,
        is_active=True,
    )
    db.add(user)
    db.commit()
    return user


def create_device(
    db,
    device_id="dev123",
    verified=True,
    status=DeviceStatus.ACTIVE,
    device_type=DeviceType.WRISTBAND,
):
    device = IoTDevice(
        device_id=device_id,
        api_key_hash=f"hash_{device_id}",
        device_type=device_type,
        is_verified=verified,
        status=status,
    )
    db.add(device)
    db.commit()
    return device


def assign_device(db, device_id):
    user = create_tourist(db)

    assignment = DeviceAssignment(
        device_id=device_id,
        tourist_id=user.id,
    )
    db.add(assignment)
    db.commit()

    return user


# ----------------------------------------------------------
# Device Not Found
# ----------------------------------------------------------

def test_device_not_found(db_session):
    with pytest.raises(NotFoundError):
        handle_location_event(
            db_session,
            device_id="unknown",
            latitude=10,
            longitude=20,
            rssi=None,
            sos_flag=False,
            heart_rate=None,
            spo2=None,
            temperature=None,
            fall_detected=False,
            battery_percentage=80,
            battery_voltage=3.7,
            firmware_version="1.0",
        )


# ----------------------------------------------------------
# Device Not Verified
# ----------------------------------------------------------

def test_device_not_verified(db_session):
    create_device(db_session, verified=False)

    with pytest.raises(ForbiddenError):
        handle_location_event(
            db_session,
            device_id="dev123",
            latitude=10,
            longitude=20,
            rssi=None,
            sos_flag=False,
            heart_rate=None,
            spo2=None,
            temperature=None,
            fall_detected=False,
            battery_percentage=80,
            battery_voltage=3.7,
            firmware_version="1.0",
        )


# ----------------------------------------------------------
# Device Inactive
# ----------------------------------------------------------

def test_device_inactive(db_session):
    create_device(db_session, status=DeviceStatus.INACTIVE)

    with pytest.raises(ForbiddenError):
        handle_location_event(
            db_session,
            device_id="dev123",
            latitude=10,
            longitude=20,
            rssi=None,
            sos_flag=False,
            heart_rate=None,
            spo2=None,
            temperature=None,
            fall_detected=False,
            battery_percentage=80,
            battery_voltage=3.7,
            firmware_version="1.0",
        )


# ----------------------------------------------------------
# No Active Assignment
# ----------------------------------------------------------

def test_no_active_assignment(db_session):
    create_device(db_session)

    handle_location_event(
        db_session,
        device_id="dev123",
        latitude=10,
        longitude=20,
        rssi=None,
        sos_flag=False,
        heart_rate=None,
        spo2=None,
        temperature=None,
        fall_detected=False,
        battery_percentage=80,
        battery_voltage=3.7,
        firmware_version="1.0",
    )

    events = db_session.query(LocationEvent).all()
    assert len(events) == 0


# ----------------------------------------------------------
# Normal Ingestion
# ----------------------------------------------------------

def test_normal_location_ingestion(monkeypatch, db_session):
    create_device(db_session)
    assign_device(db_session, "dev123")

    monkeypatch.setattr(
        "app.services.iot_service.evaluate_health_metrics",
        lambda **kwargs: None,
    )

    monkeypatch.setattr(
        "app.services.iot_service.resolve_zone_for_location",
        lambda db, latitude, longitude: (None, False),
    )

    handle_location_event(
        db_session,
        device_id="dev123",
        latitude=12.9,
        longitude=77.5,
        rssi=-60,
        sos_flag=False,
        heart_rate=80,
        spo2=98,
        temperature=36.5,
        fall_detected=False,
        battery_percentage=80,
        battery_voltage=3.7,
        firmware_version="1.0",
    )

    db_session.commit()

    events = db_session.query(LocationEvent).all()
    assert len(events) == 1


# ----------------------------------------------------------
# SOS Incident Creation
# ----------------------------------------------------------

def test_sos_creates_incident(monkeypatch, db_session):
    create_device(db_session)
    assign_device(db_session, "dev123")

    monkeypatch.setattr(
        "app.services.iot_service.evaluate_health_metrics",
        lambda **kwargs: None,
    )

    monkeypatch.setattr(
        "app.services.iot_service.resolve_zone_for_location",
        lambda db, latitude, longitude: (None, False),
    )

    fake_incident = MagicMock()
    fake_incident.id = 99

    monkeypatch.setattr(
        "app.services.iot_service.create_incident",
        lambda **kwargs: fake_incident,
    )

    monkeypatch.setattr(
        "app.services.iot_service.create_outbox_event",
        lambda **kwargs: None,
    )

    handle_location_event(
        db_session,
        device_id="dev123",
        latitude=12.9,
        longitude=77.5,
        rssi=-60,
        sos_flag=True,
        heart_rate=None,
        spo2=None,
        temperature=None,
        fall_detected=False,
        battery_percentage=80,
        battery_voltage=3.7,
        firmware_version="1.0",
    )

    db_session.commit()

    events = db_session.query(LocationEvent).all()
    assert len(events) == 1