from datetime import datetime, timezone
from typing import Optional, List
from math import radians, sin, cos, sqrt, atan2, isfinite

from shapely import Point
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError

from geoalchemy2.functions import ST_SetSRID, ST_Point
from geoalchemy2.shape import to_shape, from_shape

from app.models.location import Location
from app.models.location_event import LocationEvent
from app.models.user import User

from app.core.enums import (
    EventSource,
    AuditAction,
    EntityType,
)

from app.core.exceptions import (
    NotFoundError,
    ValidationError,
)

from app.services.geofence_service import resolve_zone_for_location
from app.services.outbox_service import create_outbox_event
from app.services.audit_service import create_audit_log
from app.services.throttle_service import should_accept_location
from app.core.rate_limiter import RateLimiter


rate_limiter = RateLimiter()

MAX_SPEED_KMH = 1200
MIN_MOVEMENT_METERS = 3
ZONE_ACCURACY_THRESHOLD = 100


# =========================================================
# Utilities
# =========================================================

def _now():
    return datetime.now(timezone.utc)


def _validate_coordinates(latitude: float, longitude: float):
    try:
        latitude = float(latitude)
        longitude = float(longitude)
    except (TypeError, ValueError):
        raise ValidationError("Invalid coordinates")

    if not isfinite(latitude) or not isfinite(longitude):
        raise ValidationError("Invalid coordinates")

    if not (-90 <= latitude <= 90):
        raise ValidationError("Invalid latitude")

    if not (-180 <= longitude <= 180):
        raise ValidationError("Invalid longitude")


def _haversine(lat1, lon1, lat2, lon2):
    R = 6371000
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)

    a = (
        sin(dlat / 2) ** 2
        + cos(radians(lat1))
        * cos(radians(lat2))
        * sin(dlon / 2) ** 2
    )

    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return R * c


def _extract_coordinates(geometry):
    """
    Safely extract longitude and latitude from:
    - WKBElement (PostGIS)
    - Shapely Point
    """
    try:
        point = to_shape(geometry)
    except Exception:
        point = geometry

    return point.y, point.x


# =========================================================
# Update User Location
# =========================================================

def update_user_location(
    db: Session,
    *,
    user_id: int,
    latitude: float,
    longitude: float,
    accuracy_meters: Optional[float],
    battery_percentage: Optional[float],
) -> Location:

    rate_limiter.enforce(
        prefix="location_update",
        identifier=str(user_id),
        limit=60,
        window_seconds=60,
    )

    _validate_coordinates(latitude, longitude)

    stmt = (
        select(User)
        .where(
            User.id == user_id,
            User.deleted_at.is_(None),
            User.is_active.is_(True),
            User.is_pending_deletion.is_(False),
        )
        .with_for_update()
    )

    user = db.execute(stmt).scalar_one_or_none()
    if not user:
        raise NotFoundError("User")

    now = _now()
    location_point = from_shape(Point(longitude, latitude), 4326)

    snapshot_stmt = (
        select(Location)
        .where(Location.tourist_id == user_id)
        .with_for_update()
    )

    existing = db.execute(snapshot_stmt).scalar_one_or_none()

   # =====================================================
    # Movement Guard (Deterministic & Physically Correct)
    # =====================================================

    if existing and existing.updated_at and existing.coordinates:

        prev_lat, prev_lon = _extract_coordinates(existing.coordinates)

        time_diff = (now - existing.updated_at).total_seconds()

        # Clamp to minimum 1 second to avoid microsecond artifacts
        if time_diff < 1:
            time_diff = 1

        distance = _haversine(prev_lat, prev_lon, latitude, longitude)

        # Always ignore tiny jitter
        if distance < MIN_MOVEMENT_METERS:
            return existing

        speed_kmh = (distance / time_diff) * 3.6

        if speed_kmh > MAX_SPEED_KMH:
            raise ValidationError("Unrealistic movement detected")

        if not should_accept_location(
            last_timestamp=existing.updated_at,
            battery_percentage=battery_percentage,
        ):
            return existing

    # =====================================================
    # Snapshot Update
    # =====================================================

    if existing:
        existing.coordinates = location_point
        existing.updated_at = now
        existing.battery_percentage = battery_percentage
        existing.accuracy_meters = accuracy_meters
        snapshot = existing
    else:
        snapshot = Location(
            tourist_id=user_id,
            coordinates=location_point,
            updated_at=now,
            battery_percentage=battery_percentage,
            accuracy_meters=accuracy_meters,
        )
        db.add(snapshot)
        try:
            db.flush()
        except IntegrityError:
            db.rollback()
            return update_user_location(
                db=db,
                user_id=user_id,
                latitude=latitude,
                longitude=longitude,
                accuracy_meters=accuracy_meters,
                battery_percentage=battery_percentage,
            )

    # =====================================================
    # Zone Detection
    # =====================================================

    zone_id = None

    if accuracy_meters is None or accuracy_meters <= ZONE_ACCURACY_THRESHOLD:
        try:
            zone_id, _ = resolve_zone_for_location(
                db,
                latitude=latitude,
                longitude=longitude,
            )
        except Exception:
            zone_id = None

    # =====================================================
    # History Event
    # =====================================================

    db.add(
        LocationEvent(
            tourist_id=user_id,
            device_id=None,
            zone_id=zone_id,
            location=location_point,
            rssi=None,
            source=EventSource.MOBILE,
            sos_flag=False,
            timestamp=now,
        )
    )

    create_outbox_event(
        db=db,
        topic="location.event",
        payload={
            "tourist_id": user_id,
            "zone_id": zone_id,
        },
    )

    create_audit_log(
        db=db,
        user_id=user_id,
        action=AuditAction.UPDATE_LOCATION,
        entity_type=EntityType.USER,
        entity_id=user_id,
    )


    return snapshot


# =========================================================
# Read Functions
# =========================================================

def get_latest_location_for_user(
    db: Session,
    *,
    user_id: int,
) -> Location:

    location = (
        db.query(Location)
        .filter(Location.tourist_id == user_id)
        .first()
    )

    if not location:
        raise NotFoundError("Location")

    return location


def get_live_locations(db: Session) -> List[Location]:

    locations = (
        db.query(Location)
        .join(User, User.id == Location.tourist_id)
        .filter(
            User.deleted_at.is_(None),
            User.is_active.is_(True),
        )
        .all()
    )

    return locations


def get_zone_presence_summary(db: Session):

    results = (
        db.query(
            LocationEvent.zone_id,
            func.count(func.distinct(LocationEvent.tourist_id)),
        )
        .filter(LocationEvent.zone_id.isnot(None))
        .group_by(LocationEvent.zone_id)
        .all()
    )

    return [
        {
            "zone_id": zone_id,
            "tourist_count": count,
        }
        for zone_id, count in results
    ]