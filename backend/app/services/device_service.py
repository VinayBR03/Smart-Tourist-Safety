from datetime import datetime, timedelta, timezone
from typing import Optional, List
import secrets
import hashlib
import re

from sqlalchemy.orm import Session
from sqlalchemy import select

from app.models.iot_device import IoTDevice
from app.models.device_assignment import DeviceAssignment

from app.core.enums import (
    DeviceStatus,
    NotificationChannel,
    NotificationSeverity,
    AuditAction,
    EntityType,
)

from app.core.exceptions import (
    NotFoundError,
    ValidationError,
    ConflictError,
)

from app.services.notification_service import create_notification
from app.services.audit_service import create_audit_log
from app.services.outbox_service import create_outbox_event

from app.core.rate_limiter import RateLimiter
from app.core.config import settings
from app.utils.logger import get_logger


logger = get_logger(__name__)
rate_limiter = RateLimiter()

MAX_FIRMWARE_LENGTH = 64


# =========================================================
# Status Transition Matrix (Enum-based)
# =========================================================

ALLOWED_TRANSITIONS = {
    DeviceStatus.ACTIVE: {
        DeviceStatus.SUSPENDED,
        DeviceStatus.DECOMMISSIONED,
        DeviceStatus.INACTIVE,
    },
    DeviceStatus.INACTIVE: {
        DeviceStatus.ACTIVE,
        DeviceStatus.DECOMMISSIONED,
    },
    DeviceStatus.SUSPENDED: {
        DeviceStatus.ACTIVE,
        DeviceStatus.DECOMMISSIONED,
    },
    DeviceStatus.DECOMMISSIONED: set(),
}


# =========================================================
# Utilities
# =========================================================

def _validate_device_id(device_id: str) -> str:
    if not device_id or not isinstance(device_id, str):
        raise ValidationError("Invalid device_id")

    device_id = device_id.strip()

    if not device_id or len(device_id) > 128:
        raise ValidationError("Invalid device_id")

    return device_id


def _generate_api_key() -> str:
    return secrets.token_urlsafe(48)


def _hash_api_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode()).hexdigest()


# =========================================================
# Core Retrieval
# =========================================================

def get_device_by_device_id(
    db: Session,
    *,
    device_id: str,
    lock: bool = False,
) -> IoTDevice:

    device_id = _validate_device_id(device_id)

    stmt = select(IoTDevice).where(
        IoTDevice.device_id == device_id,
        IoTDevice.deleted_at.is_(None),
    )

    if lock:
        stmt = stmt.with_for_update()

    device = db.execute(stmt).scalar_one_or_none()

    if not device:
        raise NotFoundError("Device")

    return device


def get_device(
    db: Session,
    *,
    device_id: str,
) -> IoTDevice:
    return get_device_by_device_id(db, device_id=device_id)


def list_devices(db: Session) -> List[IoTDevice]:
    stmt = select(IoTDevice).where(
        IoTDevice.deleted_at.is_(None),
    )
    return db.execute(stmt).scalars().all()


# =========================================================
# Registration
# =========================================================

def register_device(
    db: Session,
    *,
    payload,
):

    device_id = _validate_device_id(payload.device_id)

    existing = db.execute(
        select(IoTDevice).where(
            IoTDevice.device_id == device_id,
            IoTDevice.deleted_at.is_(None),
        )
    ).scalar_one_or_none()

    if existing:
        raise ConflictError("Device already exists")

    raw_key = _generate_api_key()

    device = IoTDevice(
        device_id=device_id,
        device_type=payload.device_type,
        status=DeviceStatus.INACTIVE,
        api_key_hash=_hash_api_key(raw_key),
        is_verified=True,
    )

    db.add(device)
    db.flush()

    create_audit_log(
        db=db,
        user_id=None,
        action=AuditAction.CREATE_DEVICE,
        entity_type=EntityType.DEVICE,
        entity_id=None,
    )

    create_outbox_event(
        db=db,
        topic="device.registered",
        payload={"device_id": device_id},
    )

    logger.info("Device registered", extra={"device_id": device_id})

    return {
        "device_id": device_id,
        "device_type": payload.device_type,
        "api_key": raw_key,
    }


# =========================================================
# Assignment (Uses DeviceAssignment table correctly)
# =========================================================

def assign_device_to_tourist(
    db: Session,
    *,
    device_id: str,
    tourist_id: int,
):

    device = get_device_by_device_id(
        db,
        device_id=device_id,
        lock=True,
    )

    if device.status == DeviceStatus.DECOMMISSIONED:
        raise ValidationError("Cannot assign decommissioned device")

    existing = (
        db.query(DeviceAssignment)
        .filter(
            DeviceAssignment.device_id == device_id,
            DeviceAssignment.unassigned_at.is_(None),
        )
        .first()
    )

    if existing:
        raise ConflictError("Device already assigned")

    assignment = DeviceAssignment(
        device_id=device_id,
        tourist_id=tourist_id,
    )

    db.add(assignment)
    db.flush()

    create_outbox_event(
        db=db,
        topic="device.assigned",
        payload={
            "device_id": device_id,
            "tourist_id": tourist_id,
        },
    )

    logger.info(
        "Device assigned",
        extra={"device_id": device_id, "tourist_id": tourist_id},
    )


def unassign_device(
    db: Session,
    *,
    device_id: str,
):

    assignment = (
        db.query(DeviceAssignment)
        .filter(
            DeviceAssignment.device_id == device_id,
            DeviceAssignment.unassigned_at.is_(None),
        )
        .with_for_update()
        .first()
    )

    if not assignment:
        raise ValidationError("Device not assigned")

    assignment.unassigned_at = datetime.now(timezone.utc)

    create_outbox_event(
        db=db,
        topic="device.unassigned",
        payload={
            "device_id": device_id,
            "tourist_id": assignment.tourist_id,
        },
    )

    logger.info(
        "Device unassigned",
        extra={"device_id": device_id},
    )


# =========================================================
# Heartbeat
# =========================================================

def update_heartbeat(
    db: Session,
    *,
    device_id: str,
    battery_percentage: Optional[float],
    battery_voltage: Optional[float],
    firmware_version: Optional[str],
) -> IoTDevice:

    device = get_device_by_device_id(
        db,
        device_id=device_id,
        lock=True,
    )

    rate_limiter.enforce(
        prefix="device_heartbeat",
        identifier=device.device_id,
        limit=settings.DEVICE_HEARTBEAT_RATE_LIMIT,
        window_seconds=60,
    )

    now = datetime.now(timezone.utc)

    previous_status = device.status
    previous_battery = device.battery_percentage

    device.last_seen = now

    if battery_percentage is not None:

        if not 0 <= battery_percentage <= 100:
            raise ValidationError("Invalid battery percentage")

        max_delta = getattr(settings, "DEVICE_MAX_BATTERY_DELTA", 50)

        if (
            previous_battery is not None
            and abs(previous_battery - battery_percentage) > max_delta
        ):
            raise ValidationError("Suspicious battery jump detected")

        device.battery_percentage = battery_percentage
        device.battery_updated_at = now

        _handle_low_battery(
            db=db,
            device=device,
            previous_battery=previous_battery,
            current_battery=battery_percentage,
        )

    if battery_voltage is not None:
        if battery_voltage < 0:
            raise ValidationError("Invalid battery voltage")
        device.battery_voltage = battery_voltage

    if firmware_version:
        version = firmware_version.strip()

        if len(version) > MAX_FIRMWARE_LENGTH:
            raise ValidationError("Firmware version too long")

        if not re.match(r"^[a-zA-Z0-9.\-_]+$", version):
            raise ValidationError("Invalid firmware version")

        device.firmware_version = version

    if device.status == DeviceStatus.INACTIVE:
        device.status = DeviceStatus.ACTIVE

        create_outbox_event(
            db=db,
            topic="device.status_updated",
            payload={
                "device_id": device.device_id,
                "old_status": previous_status.name,
                "new_status": DeviceStatus.ACTIVE.name,
            },
        )

    create_outbox_event(
        db=db,
        topic="device.heartbeat",
        payload={
            "device_id": device.device_id,
            "battery_percentage": battery_percentage,
        },
    )

    logger.info(
        "Device heartbeat processed",
        extra={"device_id": device.device_id},
    )

    return device


# =========================================================
# Low Battery Handling
# =========================================================

def _handle_low_battery(
    db: Session,
    *,
    device: IoTDevice,
    previous_battery: Optional[float],
    current_battery: float,
) -> None:

    threshold = settings.LOW_BATTERY_THRESHOLD

    if previous_battery is None:
        return

    if previous_battery > threshold and current_battery <= threshold:

        now = datetime.now(timezone.utc)

        if device.low_battery_alerted_at:
            cooldown_threshold = now - timedelta(
                minutes=settings.DEVICE_ALERT_COOLDOWN_MINUTES
            )
            if device.low_battery_alerted_at > cooldown_threshold:
                return

        device.low_battery_alerted_at = now

        create_notification(
            db=db,
            user_id=None,
            event_type="LOW_BATTERY",
            channel=NotificationChannel.IN_APP,
            severity=NotificationSeverity.WARNING,
            related_entity_type=EntityType.DEVICE,
            related_entity_id=device.id,
            context={"battery_percentage": current_battery},
        )

        create_outbox_event(
            db=db,
            topic="device.low_battery",
            payload={
                "device_id": device.device_id,
                "battery_percentage": current_battery,
            },
        )


# =========================================================
# Status Update
# =========================================================

def update_device_status(
    db: Session,
    *,
    device_id: str,
    status: DeviceStatus,
    performed_by: Optional[int],
) -> IoTDevice:

    if not isinstance(status, DeviceStatus):
        raise ValidationError("Invalid device status")

    device = get_device_by_device_id(
        db,
        device_id=device_id,
        lock=True,
    )

    if device.status == status:
        return device

    allowed = ALLOWED_TRANSITIONS.get(device.status, set())

    if status not in allowed:
        raise ConflictError("Invalid device status transition")

    old_status = device.status
    device.status = status

    create_audit_log(
        db=db,
        user_id=performed_by,
        action=AuditAction.UPDATE_DEVICE_STATUS,
        entity_type=EntityType.DEVICE,
        entity_id=device.id,
        old_value={"status": old_status.name},
        new_value={"status": status.name},
    )

    create_outbox_event(
        db=db,
        topic="device.status_updated",
        payload={
            "device_id": device.device_id,
            "old_status": old_status.name,
            "new_status": status.name,
        },
    )

    logger.info(
        "Device status updated",
        extra={"device_id": device.device_id, "status": status.name},
    )

    return device


# =========================================================
# Serialization
# =========================================================

def mark_device_offline(db: Session, *, device: IoTDevice) -> IoTDevice:
    """
    Mark device as INACTIVE due to heartbeat timeout.
    Idempotent.
    """

    if device.status != DeviceStatus.ACTIVE:
        return device

    old_status = device.status
    device.status = DeviceStatus.INACTIVE

    create_audit_log(
        db=db,
        user_id=None,
        action=AuditAction.UPDATE_DEVICE_STATUS,
        entity_type=EntityType.DEVICE,
        entity_id=device.id,
        old_value={"status": old_status.name},
        new_value={"status": DeviceStatus.INACTIVE.name},
    )

    create_outbox_event(
        db=db,
        topic="device.status_updated",
        payload={
            "device_id": device.device_id,
            "old_status": old_status.name,
            "new_status": DeviceStatus.INACTIVE.name,
        },
    )

    logger.warning(
        "Device marked offline",
        extra={"device_id": device.device_id},
    )

    return device