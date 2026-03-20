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
#
# Returns both:
#   - X, y  (preprocessed matrix for selector score comparison)
#   - named arrays (raw columns for ZoneTrainer.train())
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

    incident_counts_list: list[float] = []
    sos_counts_list:      list[float] = []
    event_counts_list:    list[float] = []
    previous_scores_list: list[float] = []
    window_minutes_list:  list[float] = []
    labels_list:          list[int]   = []

    for (zone_id,) in zones:

        incident_count = (
            db.query(func.count(Incident.id))
            .filter(
                Incident.zone_id == zone_id,
                Incident.created_at >= cutoff,
                Incident.deleted_at.is_(None),
            )
            .scalar() or 0
        )

        sos_count = (
            db.query(func.count(LocationEvent.id))
            .filter(
                LocationEvent.zone_id == zone_id,
                LocationEvent.sos_flag.is_(True),
                LocationEvent.timestamp >= cutoff,
            )
            .scalar() or 0
        )

        event_count = (
            db.query(func.count(LocationEvent.id))
            .filter(
                LocationEvent.zone_id == zone_id,
                LocationEvent.timestamp >= cutoff,
            )
            .scalar() or 0
        )

        previous_risk = (
            db.query(ZoneRiskHistory.risk_score)
            .filter(ZoneRiskHistory.zone_id == zone_id)
            .order_by(ZoneRiskHistory.recorded_at.desc())
            .first()
        )

        previous_score = float(previous_risk[0]) if previous_risk else 0.0
        label = 1 if previous_score >= getattr(settings, "ZONE_LABEL_THRESHOLD", 0.7) else 0

        incident_counts_list.append(float(incident_count))
        sos_counts_list.append(float(sos_count))
        event_counts_list.append(float(event_count))
        previous_scores_list.append(previous_score)
        window_minutes_list.append(float(window_minutes))
        labels_list.append(label)

    if not incident_counts_list:
        return None

    incident_counts = np.asarray(incident_counts_list, dtype=np.float64)
    sos_counts      = np.asarray(sos_counts_list,      dtype=np.float64)
    event_counts    = np.asarray(event_counts_list,    dtype=np.float64)
    previous_scores = np.asarray(previous_scores_list, dtype=np.float64)
    window_arr      = np.asarray(window_minutes_list,  dtype=np.float64)
    y               = np.asarray(labels_list,          dtype=np.int64)

    # Full feature matrix for the selector score comparison
    X = np.column_stack([
        incident_counts,
        sos_counts,
        event_counts,
        previous_scores,
        window_arr,
    ])
    X[~np.isfinite(X)] = 0.0

    return {
        "X":               X,
        "y":               y,
        # Named columns for ZoneTrainer.train()
        "incident_counts": incident_counts,
        "sos_counts":      sos_counts,
        "event_counts":    event_counts,
        "previous_scores": previous_scores,
        "window_minutes":  window_arr,
    }


# =========================================================
# HEALTH DATASET
#
# Returns both:
#   - X, y  (preprocessed matrix)
#   - named arrays for HealthTrainer.train()
#
# previous_health_score: the tourist's most recent anomaly
# score from health_telemetry. Defaults to 0.0 for tourists
# with no history (first reading = no prior anomaly).
# =========================================================

def load_health_training_data(
    db: Session,
    window_minutes: int = 30,
) -> Optional[Dict[str, NDArray]]:

    window_minutes = _validate_window(window_minutes)
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=window_minutes)

    rows = (
        db.query(
            HealthTelemetry.tourist_id,
            HealthTelemetry.heart_rate,
            HealthTelemetry.spo2,
            HealthTelemetry.body_temperature,
            HealthTelemetry.fall_detected,
            HealthTelemetry.is_alert,
            HealthTelemetry.recorded_at,
        )
        .filter(HealthTelemetry.recorded_at >= cutoff)
        .order_by(
            HealthTelemetry.tourist_id,
            HealthTelemetry.recorded_at.asc(),
        )
        .all()
    )

    if not rows:
        return None

    heart_rate_list:            list[float] = []
    spo2_list:                  list[float] = []
    temperature_list:           list[float] = []
    movement_variance_list:     list[float] = []
    previous_health_score_list: list[float] = []
    labels_list:                list[int]   = []

    # Track previous anomaly score per tourist within this batch
    prev_score_by_tourist: Dict[int, float] = {}

    for row in rows:
        tourist_id    = row.tourist_id
        heart_rate    = float(row.heart_rate or 0.0)
        spo2          = float(row.spo2 or 0.0)
        temperature   = float(row.body_temperature or 0.0)
        # fall_detected used as a proxy for movement variance
        movement_var  = 1.0 if row.fall_detected else 0.0
        label         = 1 if row.is_alert else 0
        prev_score    = prev_score_by_tourist.get(tourist_id, 0.0)

        heart_rate_list.append(heart_rate)
        spo2_list.append(spo2)
        temperature_list.append(temperature)
        movement_variance_list.append(movement_var)
        previous_health_score_list.append(prev_score)
        labels_list.append(label)

        # Update rolling previous score (1.0 = alert, 0.0 = normal)
        prev_score_by_tourist[tourist_id] = 1.0 if row.is_alert else 0.0

    heart_rate            = np.asarray(heart_rate_list,            dtype=np.float64)
    spo2                  = np.asarray(spo2_list,                  dtype=np.float64)
    temperature           = np.asarray(temperature_list,           dtype=np.float64)
    movement_variance     = np.asarray(movement_variance_list,     dtype=np.float64)
    previous_health_score = np.asarray(previous_health_score_list, dtype=np.float64)
    y                     = np.asarray(labels_list,                dtype=np.int64)

    X = np.column_stack([
        heart_rate,
        spo2,
        temperature,
        movement_variance,
        previous_health_score,
    ])
    X[~np.isfinite(X)] = 0.0

    return {
        "X":                     X,
        "y":                     y,
        # Named columns for HealthTrainer.train()
        "heart_rate":            heart_rate,
        "spo2":                  spo2,
        "temperature":           temperature,
        "movement_variance":     movement_variance,
        "previous_health_score": previous_health_score,
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

    rows:     list[list[float]] = []
    zone_ids: list[int]         = []

    for zone_id, event_count, unique_devices in zone_events:

        if zone_id is None:
            continue

        label = 1 if event_count > threshold else 0

        rows.append([
            float(event_count),
            float(unique_devices or 0),
            0.0,   # avg_dwell_time — placeholder, no dwell data in DB
            0.0,   # movement_entropy — placeholder
            float(label),
        ])

        zone_ids.append(int(zone_id))

    if not rows:
        return None

    data = _safe_numpy(rows)

    X = data[:, :-1]
    y = data[:, -1].astype(np.int64)

    return {
        "X":        X,
        "y":        y,
        "zone_ids": np.asarray(zone_ids, dtype=np.int64),
    }