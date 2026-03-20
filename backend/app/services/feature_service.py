from datetime import datetime, timedelta, timezone
from typing import Dict
import math

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.incident import Incident
from app.models.location_event import LocationEvent
from app.models.zone_status import ZoneStatus

from app.core.enums import IncidentStatus
from app.core.exceptions import ValidationError
from app.utils.logger import get_logger


logger = get_logger(__name__)


ZONE_FEATURE_KEYS = (
    "incident_count",
    "sos_count",
    "event_count",
    "previous_risk_score",
    "window_minutes",
)

MAX_WINDOW_MINUTES = 24 * 60
MIN_WINDOW_MINUTES = 1


# =========================================================
# Feature Extraction
# =========================================================

def extract_zone_features(
    db: Session,
    *,
    zone_id:        int,
    window_minutes: int = 60,
) -> Dict[str, float]:

    if db is None:
        raise ValidationError("Database session required")

    if not isinstance(zone_id, int) or zone_id <= 0:
        raise ValidationError("Invalid zone_id")

    try:
        window_minutes = int(window_minutes)
    except (TypeError, ValueError):
        raise ValidationError("Invalid window_minutes")

    if window_minutes < MIN_WINDOW_MINUTES:
        raise ValidationError("Window too small")

    if window_minutes > MAX_WINDOW_MINUTES:
        raise ValidationError("Window exceeds maximum allowed size")

    now          = datetime.now(timezone.utc)
    window_start = now - timedelta(minutes=window_minutes)

    if window_start > now:
        window_start = now

    incident_count = (
        db.query(func.count(Incident.id))
        .filter(
            Incident.zone_id == zone_id,
            Incident.status.in_(
                [
                    IncidentStatus.OPEN.value,
                    IncidentStatus.IN_PROGRESS.value,
                ]
            ),
            Incident.created_at >= window_start,
        )
        .scalar() or 0
    )

    sos_count = (
        db.query(func.count(LocationEvent.id))
        .filter(
            LocationEvent.zone_id == zone_id,
            LocationEvent.sos_flag.is_(True),
            LocationEvent.timestamp >= window_start,
        )
        .scalar() or 0
    )

    event_count = (
        db.query(func.count(LocationEvent.id))
        .filter(
            LocationEvent.zone_id == zone_id,
            LocationEvent.timestamp >= window_start,
        )
        .scalar() or 0
    )

    zone_status = (
        db.query(ZoneStatus)
        .filter(ZoneStatus.zone_id == zone_id)
        .first()
    )

    previous_risk = float(zone_status.risk_score) if zone_status else 0.0

    if not math.isfinite(previous_risk):
        previous_risk = 0.0

    features = {
        "incident_count":     float(incident_count),
        "sos_count":          float(sos_count),
        "event_count":        float(event_count),
        "previous_risk_score": float(previous_risk),
        "window_minutes":     float(window_minutes),
    }

    # ── FIX: set comparison instead of tuple comparison ──
    # Tuple comparison requires identical insertion order.
    # Set comparison is order-independent and won't raise a
    # false mismatch if keys are added in a different order.
    if set(features.keys()) != set(ZONE_FEATURE_KEYS):
        raise ValidationError("Zone feature schema mismatch")

    logger.debug("Zone features extracted", extra={"zone_id": zone_id})

    return features


# =========================================================
# Normalize
# =========================================================

def normalize_features(
    *,
    features: Dict[str, float],
) -> Dict[str, float]:

    if not isinstance(features, dict):
        raise ValidationError("Features must be dictionary")

    normalized: Dict[str, float] = {}

    for key in ZONE_FEATURE_KEYS:
        if key not in features:
            raise ValidationError(f"Missing required feature: {key}")

        try:
            value = float(features[key])
        except (TypeError, ValueError):
            value = 0.0

        if not math.isfinite(value):
            value = 0.0

        normalized[key] = value

    return normalized