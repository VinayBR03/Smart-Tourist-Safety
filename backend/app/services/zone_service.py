from typing import List, Tuple, Optional
from datetime import datetime, timezone

from sqlalchemy.orm import Session
from sqlalchemy import select, func

from geoalchemy2.shape import from_shape
from shapely.geometry import Polygon, Point

from app.models.zone import Zone
from app.models.zone_status import ZoneStatus
from app.models.zone_risk_history import ZoneRiskHistory

from app.core.enums import (
    AuditAction,
    EntityType,
    RiskLevel,
)

from app.core.exceptions import (
    ValidationError,
    NotFoundError,
    ConflictError,
)

from app.services.audit_service import create_audit_log
from app.services.outbox_service import create_outbox_event
from app.services.risk_engine_service import (
    update_zone_status,
    persist_zone_risk,
)

SRID = 4326
MAX_POLYGON_POINTS = 500


# =========================================================
# Helpers
# =========================================================

def _now():
    return datetime.now(timezone.utc)


def _ensure_unique_name(db: Session, name: str, exclude_id: Optional[int] = None):
    stmt = select(Zone.id).where(
        func.lower(Zone.name) == name.lower(),
        Zone.deleted_at.is_(None),
    )
    if exclude_id:
        stmt = stmt.where(Zone.id != exclude_id)

    if db.execute(stmt).scalar_one_or_none():
        raise ConflictError("Zone name already exists")


def _validate_polygon(coordinates: List[Tuple[float, float]]):

    if not coordinates or len(coordinates) < 4:
        raise ValidationError("Polygon must contain at least 4 coordinates")

    if len(coordinates) > MAX_POLYGON_POINTS:
        raise ValidationError("Polygon too complex")

    for lon, lat in coordinates:
        if not (-180 <= lon <= 180):
            raise ValidationError("Invalid longitude")
        if not (-90 <= lat <= 90):
            raise ValidationError("Invalid latitude")

    if coordinates[0] != coordinates[-1]:
        raise ValidationError("Polygon must be closed")

    polygon = Polygon(coordinates)

    if not polygon.is_valid or not polygon.is_simple:
        raise ValidationError("Invalid polygon geometry")

    if polygon.area == 0:
        raise ValidationError("Polygon area must be greater than zero")

    return from_shape(polygon, srid=SRID)


def _build_circle(center_lat: float, center_lon: float, radius_meters: float):
    if radius_meters <= 0:
        raise ValidationError("Invalid radius")

    # Simplified circular approximation (buffer in degrees)
    point = Point(center_lon, center_lat)
    geometry = point.buffer(radius_meters / 111_320)  # approx meter to degree
    return from_shape(geometry, srid=SRID)


# =========================================================
# Create Circular Zone
# =========================================================

def create_circular_zone(
    db: Session,
    *,
    name: str,
    zone_type: Optional[str],
    center_latitude: float,
    center_longitude: float,
    radius_meters: float,
) -> Zone:

    if not name or not name.strip():
        raise ValidationError("Zone name required")

    name = name.strip()

    _ensure_unique_name(db, name)

    geometry = _build_circle(center_latitude, center_longitude, radius_meters)

    zone = Zone(
        name=name,
        zone_type=zone_type,
        geometry=geometry,
        is_active=True,
        created_at=_now(),
        updated_at=_now(),
    )

    db.add(zone)
    db.flush()

    create_audit_log(
        db=db,
        user_id=None,
        action=AuditAction.CREATE_ZONE,
        entity_type=EntityType.ZONE,
        entity_id=zone.id,
    )

    create_outbox_event(
        db=db,
        topic="zone.created",
        payload={"zone_id": zone.id},
    )

    update_zone_status(db, zone.id)

    return zone


# =========================================================
# Create Polygon Zone
# =========================================================

def create_polygon_zone(
    db: Session,
    *,
    name: str,
    zone_type: Optional[str],
    coordinates: List[Tuple[float, float]],
) -> Zone:

    if not name or not name.strip():
        raise ValidationError("Zone name required")

    name = name.strip()

    _ensure_unique_name(db, name)

    geometry = _validate_polygon(coordinates)

    zone = Zone(
        name=name,
        zone_type=zone_type,
        geometry=geometry,
        is_active=True,
        created_at=_now(),
        updated_at=_now(),
    )

    db.add(zone)
    db.flush()

    create_audit_log(
        db=db,
        user_id=None,
        action=AuditAction.CREATE_ZONE,
        entity_type=EntityType.ZONE,
        entity_id=zone.id,
    )

    create_outbox_event(
        db=db,
        topic="zone.created",
        payload={"zone_id": zone.id},
    )

    update_zone_status(db, zone.id)

    return zone


# =========================================================
# Update Zone Metadata
# =========================================================

def update_zone(
    db: Session,
    *,
    zone_id: int,
    name: Optional[str],
    zone_type: Optional[str],
    is_active: Optional[bool],
) -> Zone:

    stmt = select(Zone).where(
        Zone.id == zone_id,
        Zone.deleted_at.is_(None),
    ).with_for_update()

    zone = db.execute(stmt).scalar_one_or_none()

    if not zone:
        raise NotFoundError("Zone")

    if name:
        name = name.strip()
        _ensure_unique_name(db, name, exclude_id=zone.id)
        zone.name = name

    if zone_type is not None:
        zone.zone_type = zone_type

    if is_active is not None and zone.is_active != is_active:
        zone.is_active = is_active

        if not is_active:
            persist_zone_risk(
                db=db,
                zone_id=zone.id,
                risk_score=0.0,
                risk_level=RiskLevel.LOW,
                model_version="forced_reset",
                features=None,
            )
        else:
            update_zone_status(db, zone.id)

    zone.updated_at = _now()

    create_audit_log(
        db=db,
        user_id=None,
        action=AuditAction.UPDATE_ZONE,
        entity_type=EntityType.ZONE,
        entity_id=zone.id,
    )

    create_outbox_event(
        db=db,
        topic="zone.updated",
        payload={"zone_id": zone.id},
    )

    return zone


# =========================================================
# Get Zone By ID (With Status)
# =========================================================

def get_zone_by_id(db: Session, *, zone_id: int):

    zone = (
        db.query(Zone)
        .filter(
            Zone.id == zone_id,
            Zone.deleted_at.is_(None),
        )
        .first()
    )

    if not zone:
        raise NotFoundError("Zone")

    status = (
        db.query(ZoneStatus)
        .filter(ZoneStatus.zone_id == zone.id)
        .first()
    )

    return {
        **zone.__dict__,
        "risk_score": status.risk_score if status else None,
        "risk_level": status.risk_level if status else None,
        "status_updated_at": status.updated_at if status else None,
    }


# =========================================================
# List Zones
# =========================================================

def list_zones(db: Session) -> List[Zone]:

    return (
        db.query(Zone)
        .filter(Zone.deleted_at.is_(None))
        .order_by(Zone.created_at.desc())
        .all()
    )


# =========================================================
# Current Risk Status
# =========================================================

def get_zone_status(db: Session, *, zone_id: int) -> ZoneStatus:

    status = (
        db.query(ZoneStatus)
        .filter(ZoneStatus.zone_id == zone_id)
        .first()
    )

    if not status:
        raise NotFoundError("Zone")

    return status


# =========================================================
# Risk History
# =========================================================

def get_zone_risk_history(
    db: Session,
    *,
    zone_id: int,
) -> List[ZoneRiskHistory]:

    history = (
        db.query(ZoneRiskHistory)
        .filter(ZoneRiskHistory.zone_id == zone_id)
        .order_by(ZoneRiskHistory.recorded_at.desc())
        .limit(200)
        .all()
    )

    return history

# =========================================================
# Validate Zone Integrity
# =========================================================

def validate_zone_integrity(db: Session, *, zone: Zone) -> None:
    """
    Validate zone consistency.
    Idempotent.
    """

    if not zone.is_active:
        return

    # Ensure zone has status record
    status = (
        db.query(ZoneStatus)
        .filter(ZoneStatus.zone_id == zone.id)
        .first()
    )

    if not status:
        update_zone_status(db, zone.id)

    # Optional future validations can be added here