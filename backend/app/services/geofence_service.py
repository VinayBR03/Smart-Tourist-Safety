from typing import Optional, Tuple
from datetime import datetime, timezone

from sqlalchemy.orm import Session
from sqlalchemy import select, func

from geoalchemy2.functions import (
    ST_SetSRID,
    ST_Point,
    ST_Contains,
    ST_DWithin,
)

from app.models.zone import Zone
from app.core.exceptions import ValidationError
from app.core.config import settings
from app.utils.logger import get_logger


logger = get_logger(__name__)

SRID = 4326
MAX_PROXIMITY_RADIUS = 500  # meters


# =========================================================
# Validation
# =========================================================

def _validate_coordinates(latitude, longitude) -> Tuple[float, float]:

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


def _validate_radius(radius_meters) -> float:

    try:
        radius_meters = float(radius_meters)
    except (TypeError, ValueError):
        raise ValidationError("Invalid radius")

    if radius_meters <= 0:
        raise ValidationError("Invalid radius")

    if radius_meters > MAX_PROXIMITY_RADIUS:
        raise ValidationError("Radius exceeds allowed limit")

    return radius_meters


def _build_point(latitude: float, longitude: float):
    return ST_SetSRID(ST_Point(longitude, latitude), SRID)


# =========================================================
# Strict Zone Containment
# =========================================================

def detect_zone(
    db: Session,
    *,
    latitude,
    longitude,
) -> Optional[int]:

    latitude, longitude = _validate_coordinates(latitude, longitude)
    point = _build_point(latitude, longitude)

    stmt = (
        select(Zone.id)
        .where(
            Zone.is_active.is_(True),
            Zone.deleted_at.is_(None),
            Zone.geometry.is_not(None),
            ST_Contains(Zone.geometry, point),
        )
        .order_by(Zone.created_at.asc())
        .limit(1)
    )

    return db.execute(stmt).scalar_one_or_none()


# =========================================================
# Proximity-Based Detection
# =========================================================

def detect_nearby_zone(
    db: Session,
    *,
    latitude,
    longitude,
    radius_meters: float = 50,
) -> Optional[int]:

    latitude, longitude = _validate_coordinates(latitude, longitude)
    radius_meters = _validate_radius(radius_meters)

    point = _build_point(latitude, longitude)

    stmt = (
        select(Zone.id)
        .where(
            Zone.is_active.is_(True),
            Zone.deleted_at.is_(None),
            Zone.geometry.is_not(None),
            ST_DWithin(
                Zone.geometry.cast("geography"),
                point.cast("geography"),
                radius_meters,
            ),
        )
        .order_by(
            func.ST_Distance(
                Zone.geometry.cast("geography"),
                point.cast("geography"),
            )
        )
        .limit(1)
    )

    return db.execute(stmt).scalar_one_or_none()


# =========================================================
# Unified Zone Detection
# =========================================================

def resolve_zone_for_location(
    db: Session,
    *,
    latitude,
    longitude,
) -> Tuple[Optional[int], bool]:

    latitude, longitude = _validate_coordinates(latitude, longitude)

    zone_id = detect_zone(
        db,
        latitude=latitude,
        longitude=longitude,
    )

    if zone_id:
        return zone_id, True

    safe_radius = min(
        getattr(settings, "DEFAULT_ZONE_PROXIMITY_RADIUS", 50),
        MAX_PROXIMITY_RADIUS,
    )

    nearby_zone = detect_nearby_zone(
        db,
        latitude=latitude,
        longitude=longitude,
        radius_meters=safe_radius,
    )

    return nearby_zone, False