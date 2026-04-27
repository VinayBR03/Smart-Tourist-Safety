from datetime import datetime, timezone, timedelta
from typing import Optional

from sqlalchemy.orm import Session
from sqlalchemy import select

from geoalchemy2.functions import ST_SetSRID, ST_Point

from app.models.iot_device import IoTDevice
from app.models.device_assignment import DeviceAssignment
from app.models.location_event import LocationEvent

from app.core.enums import (
    EventSource,
    IncidentSource,
    DeviceStatus,
    AuditAction,
    EntityType,
)

from app.core.exceptions import (
    NotFoundError,
    ForbiddenError,
    ValidationError,
    ConflictError,
)

from app.services.device_service import update_heartbeat
from app.services.health_monitor_service import evaluate_health_metrics
from app.services.geofence_service import resolve_zone_for_location
from app.services.audit_service import create_audit_log
from app.services.outbox_service import create_outbox_event
from app.services.incident_service import create_incident
from app.services.throttle_service import should_accept_location

from app.core.rate_limiter import RateLimiter
from app.utils.logger import get_logger


logger = get_logger(__name__)
rate_limiter = RateLimiter()

SRID = 4326


# =========================================================
# Validation
# =========================================================

def _validate_device_id(device_id: str) -> str:
    if not device_id or not isinstance(device_id, str):
        raise ValidationError("Invalid device_id")

    device_id = device_id.strip()

    if len(device_id) > 100:
        raise ValidationError("Invalid device_id")

    return device_id


def _validate_coordinates(latitude, longitude):
    try:
        latitude = float(latitude)
        longitude = float(longitude)
    except (TypeError, ValueError):
        raise ValidationError("Invalid coordinates")

    if not (-90 <= latitude <= 90):
        raise ValidationError("Invalid latitude")

    if not (-180 <= longitude <= 180):
        raise ValidationError("Invalid longitude")

    return latitude, longitude


def _sanitize(value: Optional[float], min_val: float, max_val: float) -> Optional[float]:
    if value is None:
        return None

    try:
        value = float(value)
    except (TypeError, ValueError):
        return None

    if value < min_val or value > max_val:
        return None

    return value


def _resolve_active_tourist(db: Session, *, device_id: str) -> Optional[int]:
    assignment = (
        db.query(DeviceAssignment)
        .filter(
            DeviceAssignment.device_id == device_id,
            DeviceAssignment.unassigned_at.is_(None),
        )
        .order_by(DeviceAssignment.assigned_at.desc())
        .first()
    )

    return assignment.tourist_id if assignment else None


# =========================================================
# IoT Ingestion Entry
# =========================================================

def handle_location_event(
    db: Session,
    *,
    device_id: str,
    latitude: Optional[float],
    longitude: Optional[float],
    rssi: Optional[float],
    sos_flag,
    heart_rate: Optional[float],
    spo2: Optional[float],
    temperature: Optional[float],
    fall_detected,
    battery_percentage: Optional[float],
    battery_voltage: Optional[float],
    firmware_version: Optional[str],
    device_timestamp: Optional[datetime] = None,
) -> None:

    device_id = _validate_device_id(device_id)

    sos_flag = bool(sos_flag)
    fall_detected = bool(fall_detected)

    rate_limiter.enforce(
        prefix="iot_ingestion",
        identifier=device_id,
        limit=300,
        window_seconds=60,
    )

    stmt = (
        select(IoTDevice)
        .where(IoTDevice.device_id == device_id)
        .with_for_update()
    )

    device = db.execute(stmt).scalar_one_or_none()

    if not device:
        raise NotFoundError("Device")

    if not device.is_verified:
        raise ForbiddenError("Device not verified")

    if device.status != DeviceStatus.ACTIVE:
        raise ForbiddenError("Device inactive")

    # Correct call signature
    update_heartbeat(
        db=db,
        device_id=device.device_id,
        battery_percentage=battery_percentage,
        battery_voltage=battery_voltage,
        firmware_version=firmware_version,
    )

    tourist_id = _resolve_active_tourist(db, device_id=device_id)

    if not tourist_id:
        logger.info(
            "Device has no active assignment",
            extra={"device_id": device_id},
        )
        return

    location_point = None
    zone_id = None

    if latitude is not None and longitude is not None:
        latitude, longitude = _validate_coordinates(latitude, longitude)

        location_point = ST_SetSRID(
            ST_Point(longitude, latitude),
            SRID,
        )

        try:
            zone_id, _ = resolve_zone_for_location(
                db,
                latitude=latitude,
                longitude=longitude,
            )
        except Exception:
            logger.exception("Zone resolution failed")
            zone_id = None

    # NOTE: Do NOT return here when location_point is None.
    # Health data must be persisted regardless of GPS availability.
    # The phone may not have GPS permission, or the wristband sends 0.0/0.0
    # as a sentinel — neither case should discard health telemetry.

    last_event = (
        db.query(LocationEvent.timestamp)
        .filter(LocationEvent.tourist_id == tourist_id)
        .order_by(LocationEvent.timestamp.desc())
        .first()
    )

    # Only throttle location events — never throttle health-only events
    if location_point is not None and last_event and not should_accept_location(
        last_timestamp=last_event[0],
        battery_percentage=battery_percentage,
    ):
        return

    heart_rate = _sanitize(heart_rate, 20, 250)
    spo2 = _sanitize(spo2, 50, 100)
    temperature = _sanitize(temperature, 30, 45)

    now = datetime.now(timezone.utc)

    if device_timestamp:
        if device_timestamp.tzinfo is None:
            device_timestamp = device_timestamp.replace(tzinfo=timezone.utc)

        if device_timestamp > now + timedelta(minutes=5):
            device_timestamp = now

        if device_timestamp < now - timedelta(days=7):
            device_timestamp = now

    event_timestamp = device_timestamp or now

    event = LocationEvent(
        tourist_id=tourist_id,
        device_id=device_id,
        zone_id=zone_id,
        location=location_point,
        rssi=rssi,
        source=EventSource.IOT,
        sos_flag=sos_flag,
        timestamp=event_timestamp,
    )

    db.add(event)
    db.flush()

    evaluate_health_metrics(
        db=db,
        tourist_id=tourist_id,
        device_id=device_id,
        heart_rate=heart_rate,
        spo2=spo2,
        body_temperature=temperature,
        fall_detected=fall_detected,
        zone_id=zone_id,
        latitude=latitude,
        longitude=longitude,
    )

    if sos_flag:
        try:
            incident = create_incident(
                db=db,
                tourist_id=tourist_id,
                description="Manual SOS triggered",
                source=IncidentSource.IOT,
                latitude=latitude,
                longitude=longitude,
                zone_id=zone_id,
            )

            create_outbox_event(
                db=db,
                topic="incident.sos_triggered",
                payload={
                    "incident_id": incident.id,
                    "tourist_id": tourist_id,
                },
            )

        except ConflictError:
            logger.info(
                "Duplicate SOS ignored",
                extra={"tourist_id": tourist_id},
            )

    create_outbox_event(
        db=db,
        topic="location.event",
        payload={
            "tourist_id": tourist_id,
            "zone_id": zone_id,
            "sos_flag": sos_flag,
        },
    )

    create_audit_log(
        db=db,
        user_id=tourist_id,
        action=AuditAction.UPDATE_LOCATION,
        entity_type=EntityType.USER,
        entity_id=tourist_id,
        new_value={"zone_id": zone_id},
    )

    logger.info(
        "IoT event processed",
        extra={
            "device_id": device_id,
            "tourist_id": tourist_id,
            "zone_id": zone_id,
            "sos_flag": sos_flag,
        },
    )

# =========================================================
# BLE Gateway Health Ingestion
# =========================================================
#
# Dedicated entry point called by the BLE gateway router endpoints
# (/iot/gateway/health and /iot/health via IoT key).
#
# Unlike handle_location_event, this ALWAYS persists health data
# regardless of GPS availability — GPS is optional for health readings.
# =========================================================

def handle_health_event(
    db: Session,
    *,
    device_id: str,
    heart_rate: Optional[float],
    spo2: Optional[float],
    body_temperature: Optional[float],
    is_alert: bool = False,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    device_timestamp: Optional[datetime] = None,
) -> None:

    device_id = _validate_device_id(device_id)

    rate_limiter.enforce(
        prefix="iot_health",
        identifier=device_id,
        limit=300,
        window_seconds=60,
    )

    stmt = select(IoTDevice).where(IoTDevice.device_id == device_id).with_for_update()
    device = db.execute(stmt).scalar_one_or_none()

    if not device:
        raise NotFoundError("Device")
    if not device.is_verified:
        raise ForbiddenError("Device not verified")
    if device.status != DeviceStatus.ACTIVE:
        raise ForbiddenError("Device inactive")

    tourist_id = _resolve_active_tourist(db, device_id=device_id)
    if not tourist_id:
        logger.info("Device has no active assignment", extra={"device_id": device_id})
        return

    # Resolve zone if GPS is available — optional, never blocks health write
    zone_id = None
    if latitude is not None and longitude is not None:
        try:
            latitude, longitude = _validate_coordinates(latitude, longitude)
            zone_id, _ = resolve_zone_for_location(db, latitude=latitude, longitude=longitude)
        except Exception:
            logger.exception("Zone resolution failed")
            zone_id = None

    now = datetime.now(timezone.utc)
    if device_timestamp:
        if device_timestamp.tzinfo is None:
            device_timestamp = device_timestamp.replace(tzinfo=timezone.utc)
        if device_timestamp > now + timedelta(minutes=5):
            device_timestamp = now
        if device_timestamp < now - timedelta(days=7):
            device_timestamp = now

    # Always write health telemetry — GPS is optional
    evaluate_health_metrics(
        db=db,
        tourist_id=tourist_id,
        device_id=device_id,
        heart_rate=heart_rate,
        spo2=spo2,
        body_temperature=body_temperature,
        fall_detected=False,
        zone_id=zone_id,
        latitude=latitude,
        longitude=longitude,
    )

    # Update device heartbeat with no battery info (health POST has none)
    update_heartbeat(
        db=db,
        device_id=device_id,
        battery_percentage=None,
        battery_voltage=None,
        firmware_version=None,
    )

    create_outbox_event(
        db=db,
        topic="health.telemetry",
        payload={
            "tourist_id": tourist_id,
            "device_id":  device_id,
            "zone_id":    zone_id,
            "is_alert":   is_alert,
        },
    )

    logger.info(
        "BLE health event processed",
        extra={"device_id": device_id, "tourist_id": tourist_id, "zone_id": zone_id},
    )
