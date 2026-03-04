import pytest
from datetime import datetime, timedelta, timezone
import uuid

from sqlalchemy.exc import IntegrityError

from app.models.iot_device import IoTDevice
from app.core.enums import DeviceType, DeviceStatus


# =========================================================
# TEST UTIL
# =========================================================


def valid_device(**overrides):
    base = {
        "device_id": f"dev_{uuid.uuid4().hex}",
        "api_key_hash": uuid.uuid4().hex * 2,  # 64 chars
        "device_type": DeviceType.WRISTBAND,
        "status": DeviceStatus.ACTIVE,
        "is_verified": True,
    }
    base.update(overrides)
    return IoTDevice(**base)


# =========================================================
# BATTERY RANGE
# =========================================================


def test_battery_percentage_below_zero_rejected(db_session):
    device = valid_device(battery_percentage=-5)

    db_session.add(device)

    with pytest.raises(IntegrityError):
        db_session.commit()

    db_session.rollback()


def test_battery_percentage_above_100_rejected(db_session):
    device = valid_device(battery_percentage=150)

    db_session.add(device)

    with pytest.raises(IntegrityError):
        db_session.commit()

    db_session.rollback()


# =========================================================
# ACTIVE + DECOMMISSIONED CONFLICT
# =========================================================


def test_active_device_with_decommissioned_at_rejected(db_session):
    device = valid_device(
        status=DeviceStatus.ACTIVE,
        decommissioned_at=datetime.now(timezone.utc),
    )

    db_session.add(device)

    with pytest.raises(IntegrityError):
        db_session.commit()

    db_session.rollback()


# =========================================================
# SUSPENDED REQUIRES TIMESTAMP
# =========================================================


def test_suspended_without_timestamp_rejected(db_session):
    device = valid_device(
        status=DeviceStatus.SUSPENDED,
        suspended_at=None,
    )

    db_session.add(device)

    with pytest.raises(IntegrityError):
        db_session.commit()

    db_session.rollback()


# =========================================================
# DECOMMISSIONED REQUIRES TIMESTAMP
# =========================================================


def test_decommissioned_without_timestamp_rejected(db_session):
    device = valid_device(
        status=DeviceStatus.DECOMMISSIONED,
        decommissioned_at=None,
    )

    db_session.add(device)

    with pytest.raises(IntegrityError):
        db_session.commit()

    db_session.rollback()


# =========================================================
# FUTURE HEARTBEAT
# =========================================================


def test_future_last_seen_rejected(db_session):
    future_time = datetime.now(timezone.utc) + timedelta(hours=1)

    device = valid_device(last_seen=future_time)

    db_session.add(device)

    with pytest.raises(IntegrityError):
        db_session.commit()

    db_session.rollback()


# =========================================================
# UNIQUE CONSTRAINTS
# =========================================================


def test_duplicate_device_id_rejected(db_session):
    device_id = f"dev_{uuid.uuid4().hex}"

    d1 = valid_device(device_id=device_id)
    d2 = valid_device(device_id=device_id)

    db_session.add(d1)
    db_session.commit()

    db_session.add(d2)

    with pytest.raises(IntegrityError):
        db_session.commit()

    db_session.rollback()


def test_duplicate_api_key_hash_rejected(db_session):
    api_key_hash = uuid.uuid4().hex * 2

    d1 = valid_device(api_key_hash=api_key_hash)
    d2 = valid_device(api_key_hash=api_key_hash)

    db_session.add(d1)
    db_session.commit()

    db_session.add(d2)

    with pytest.raises(IntegrityError):
        db_session.commit()

    db_session.rollback()