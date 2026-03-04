from typing import Dict, Optional
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session
from sqlalchemy import func

import numpy as np
from numpy.typing import NDArray

from app.models.incident import Incident
from app.models.location_event import LocationEvent
from app.models.zone_risk_history import ZoneRiskHistory
from app.models.health_telemetry import HealthTelemetry
from app.models.zone import Zone

from app.core.exceptions import ValidationError
from app.core.config import settings


MIN_WINDOW_MINUTES = 1
MAX_WINDOW_MINUTES = 24 * 60


# =========================================================
# Utilities
# =========================================================

def _validate_window(window_minutes: int) -> int:
    try:
        window_minutes = int(window_minutes)
    except (TypeError, ValueError):
        raise ValidationError("Invalid window_minutes")

    if window_minutes < MIN_WINDOW_MINUTES:
        raise ValidationError("Window too small")

    if window_minutes > MAX_WINDOW_MINUTES:
        raise ValidationError("Window too large")

    return window_minutes


def _safe_numpy(rows: list[list[float]]) -> NDArray[np.float64]:
    data = np.asarray(rows, dtype=np.float64)
    data[~np.isfinite(data)] = 0.0
    return data


# =========================================================
# ZONE DATASET
# =========================================================

def load_zone_training_data(
    db: Session,
    window_minutes: int = 60,
) -> Optional[Dict[str, NDArray]]:

    window_minutes = _validate_window(window_minutes)
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=window_minutes)

    zones = db.query(Zone.id).filter(
        Zone.deleted_at.is_(None)
    ).all()

    if not zones:
        return None

    rows: list[list[float]] = []

    for (zone_id,) in zones:

        incident_count = (
            db.query(func.count(Incident.id))
            .filter(
                Incident.zone_id == zone_id,
                Incident.created_at >= cutoff,
                Incident.deleted_at.is_(None),
            )
            .scalar()
            or 0
        )

        sos_count = (
            db.query(func.count(LocationEvent.id))
            .filter(
                LocationEvent.zone_id == zone_id,
                LocationEvent.sos_flag.is_(True),
                LocationEvent.timestamp >= cutoff,
            )
            .scalar()
            or 0
        )

        event_count = (
            db.query(func.count(LocationEvent.id))
            .filter(
                LocationEvent.zone_id == zone_id,
                LocationEvent.timestamp >= cutoff,
            )
            .scalar()
            or 0
        )

        previous_risk = (
            db.query(ZoneRiskHistory.risk_score)
            .filter(ZoneRiskHistory.zone_id == zone_id)
            .order_by(ZoneRiskHistory.recorded_at.desc())
            .first()
        )

        previous_score = float(previous_risk[0]) if previous_risk else 0.0

        # Weak supervision label (bootstrapped)
        label = 1 if previous_score >= getattr(settings, "ZONE_LABEL_THRESHOLD", 0.7) else 0

        rows.append([
            float(incident_count),
            float(sos_count),
            float(event_count),
            float(previous_score),
            float(window_minutes),
            float(label),
        ])

    if not rows:
        return None

    data = _safe_numpy(rows)

    X = data[:, :-1]
    y = data[:, -1].astype(np.int64)

    return {
        "X": X,
        "y": y,
    }


# =========================================================
# HEALTH DATASET
# =========================================================

def load_health_training_data(
    db: Session,
    window_minutes: int = 30,
) -> Optional[Dict[str, NDArray]]:

    window_minutes = _validate_window(window_minutes)
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=window_minutes)

    rows = (
        db.query(
            HealthTelemetry.heart_rate,
            HealthTelemetry.spo2,
            HealthTelemetry.body_temperature,
            HealthTelemetry.is_alert,
        )
        .filter(
            HealthTelemetry.recorded_at >= cutoff,
        )
        .all()
    )

    if not rows:
        return None

    data = _safe_numpy(rows)

    X = data[:, :-1]
    y = data[:, -1].astype(np.int64)

    return {
        "X": X,
        "y": y,
    }


# =========================================================
# CROWD DATASET
# =========================================================

def load_crowd_training_data(
    db: Session,
    window_minutes: int = 30,
) -> Optional[Dict[str, NDArray]]:

    window_minutes = _validate_window(window_minutes)
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=window_minutes)

    threshold = getattr(settings, "CROWD_ALERT_THRESHOLD", 500)

    zone_events = (
        db.query(
            LocationEvent.zone_id,
            func.count(LocationEvent.id).label("event_count"),
            func.count(func.distinct(LocationEvent.device_id)).label("unique_devices"),
        )
        .filter(LocationEvent.timestamp >= cutoff)
        .group_by(LocationEvent.zone_id)
        .all()
    )

    if not zone_events:
        return None

    rows: list[list[float]] = []
    zone_ids: list[int] = []

    for zone_id, event_count, unique_devices in zone_events:

        if zone_id is None:
            continue

        label = 1 if event_count > threshold else 0

        rows.append([
            float(event_count),
            float(unique_devices or 0),
            0.0,  # avg_dwell_time placeholder
            0.0,  # movement_entropy placeholder
            float(label),
        ])

        zone_ids.append(int(zone_id))

    if not rows:
        return None

    data = _safe_numpy(rows)

    X = data[:, :-1]
    y = data[:, -1].astype(np.int64)

    return {
        "X": X,
        "y": y,
        "zone_ids": np.asarray(zone_ids, dtype=np.int64),
    }