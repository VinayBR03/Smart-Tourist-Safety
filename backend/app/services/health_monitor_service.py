from datetime import datetime, timedelta, timezone
from typing import Optional, Dict
import math

from sqlalchemy.orm import Session
from sqlalchemy import select

from app.models.health_telemetry import HealthTelemetry
from app.models.incident import Incident

from app.core.enums import (
    AuditAction,
    EntityType,
    IncidentStatus,
    IncidentSource,
    NotificationChannel,
    NotificationSeverity,
)

from app.core.exceptions import ConflictError
from app.services.audit_service import create_audit_log
from app.services.notification_service import create_notification
from app.services.outbox_service import create_outbox_event
from app.services.incident_service import create_incident
from app.services.internal_ml_service import internal_ml_service
from app.services.blockchain_service import log_health_alert

from app.core.logging_config import get_correlation_id
from app.core.config import settings
from app.utils.logger import get_logger


logger = get_logger(__name__)


# =========================================================
# Logging
# =========================================================

def _log(message: str, **kwargs):
    logger.warning(
        message,
        extra={
            "extra_data": {
                **kwargs,
                "correlation_id": get_correlation_id(),
            }
        },
    )


# =========================================================
# Sanitization
# =========================================================

def _sanitize(value: Optional[float], min_val: float, max_val: float) -> Optional[float]:
    if value is None:
        return None
    try:
        value = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(value):
        return None
    if value < min_val or value > max_val:
        return None
    return value


# =========================================================
# Cooldown Guard
# =========================================================

def _has_recent_health_incident(db: Session, *, tourist_id: int) -> bool:

    cooldown = int(getattr(settings, "HEALTH_ALERT_COOLDOWN_MINUTES", 5))

    threshold = datetime.now(timezone.utc) - timedelta(minutes=cooldown)

    stmt = (
        select(Incident.id)
        .where(
            Incident.tourist_id == tourist_id,
            Incident.created_at >= threshold,
            Incident.deleted_at.is_(None),
            Incident.status.in_(
                [
                    IncidentStatus.OPEN.value,
                    IncidentStatus.IN_PROGRESS.value,
                ]
            ),
        )
        .limit(1)
    )

    return db.execute(stmt).scalar_one_or_none() is not None


# =========================================================
# Previous Health Score Lookup
#
# Fetches the tourist's most recent anomaly score so the
# LSTM model gets real temporal context rather than 0.0.
# Returns 0.0 if no prior telemetry exists (first reading).
# =========================================================

def _get_previous_health_score(db: Session, *, tourist_id: int) -> float:

    stmt = (
        select(HealthTelemetry.is_alert)
        .where(HealthTelemetry.tourist_id == tourist_id)
        .order_by(HealthTelemetry.recorded_at.desc())
        .limit(1)
    )

    result = db.execute(stmt).scalar_one_or_none()

    if result is None:
        return 0.0

    # is_alert is boolean — map to float score
    return 1.0 if result else 0.0


# =========================================================
# Consecutive Alert Streak Tracker
#
# Tracks how many consecutive BLE health payloads exceeded a threshold
# for each tourist. When a tourist hits ALERT_STREAK_SOS_THRESHOLD
# consecutive alerts, an SOS incident is force-created regardless of
# the cooldown guard. Resets on any normal reading.
#
# In-process dict is sufficient — wristband sends 1 payload per 30s,
# streak only matters within a single server process lifetime, and
# a restart is an acceptable reset (LoRa covers emergency path anyway).
# =========================================================

_alert_streaks: dict[int, int] = {}        # tourist_id → consecutive alert count
ALERT_STREAK_SOS_THRESHOLD = 5             # 5 consecutive alerts ≈ 2.5 minutes


def _increment_alert_streak(tourist_id: int) -> int:
    _alert_streaks[tourist_id] = _alert_streaks.get(tourist_id, 0) + 1
    return _alert_streaks[tourist_id]


def _reset_alert_streak(tourist_id: int) -> None:
    _alert_streaks.pop(tourist_id, None)


def _is_sos_escalation(tourist_id: int) -> bool:
    """True when consecutive alert count has hit the SOS threshold."""
    return _alert_streaks.get(tourist_id, 0) >= ALERT_STREAK_SOS_THRESHOLD


# =========================================================
# Evaluate Health Metrics
# =========================================================

def evaluate_health_metrics(
    db: Session,
    *,
    tourist_id:        int,
    device_id:         Optional[str]   = None,
    heart_rate:        Optional[float],
    spo2:              Optional[float],
    body_temperature:  Optional[float],
    movement_variance: Optional[float] = None,
    fall_detected:     bool            = False,
    zone_id:           Optional[int]   = None,
    latitude:          Optional[float] = None,
    longitude:         Optional[float] = None,
) -> None:

    now = datetime.now(timezone.utc)

    # Sanitize physiological inputs
    heart_rate       = _sanitize(heart_rate,       20,  300)
    spo2             = _sanitize(spo2,             50,  100)
    body_temperature = _sanitize(body_temperature, 30,   45)

    # Persist telemetry — include location point if GPS coords were provided
    from geoalchemy2.functions import ST_SetSRID, ST_Point as ST_Pt
    location_point = None
    if latitude is not None and longitude is not None:
        try:
            location_point = ST_SetSRID(ST_Pt(longitude, latitude), 4326)
        except Exception:
            location_point = None

    db.add(
        HealthTelemetry(
            tourist_id=tourist_id,
            device_id=device_id,
            heart_rate=heart_rate,
            spo2=spo2,
            body_temperature=body_temperature,
            fall_detected=fall_detected,
            location=location_point,
            recorded_at=now,
        )
    )

    if _has_recent_health_incident(db, tourist_id=tourist_id):
        return

    # -------------------------------------------------
    # RULE CHECK
    # -------------------------------------------------

    rule_triggered = False
    reason         = None

    hr_high      = float(getattr(settings, "HEART_RATE_HIGH",     140))
    hr_low       = float(getattr(settings, "HEART_RATE_LOW",       40))
    spo2_low     = float(getattr(settings, "SPO2_LOW",             90))
    temp_high    = float(getattr(settings, "TEMP_HIGH",            39))
    ml_threshold = float(getattr(settings, "HEALTH_ML_THRESHOLD", 0.8))

    if fall_detected:
        rule_triggered = True
        reason         = "Fall detected"

    elif heart_rate is not None:
        if heart_rate > hr_high:
            rule_triggered = True
            reason         = "Critical high heart rate"
        elif heart_rate < hr_low:
            rule_triggered = True
            reason         = "Critical low heart rate"

    if not rule_triggered and spo2 is not None:
        if spo2 < spo2_low:
            rule_triggered = True
            reason         = "Low oxygen level"

    if not rule_triggered and body_temperature is not None:
        if body_temperature > temp_high:
            rule_triggered = True
            reason         = "High body temperature"

    # -------------------------------------------------
    # ML CHECK
    # -------------------------------------------------

    ml_triggered = False

    # Fetch real previous anomaly score — gives LSTM temporal context
    previous_health_score = _get_previous_health_score(db, tourist_id=tourist_id)

    ml_features: Dict[str, float] = {
        "heart_rate":            float(heart_rate       or 0.0),
        "spo2":                  float(spo2             or 0.0),
        "temperature":           float(body_temperature or 0.0),
        "movement_variance":     float(movement_variance or 0.0),
        "previous_health_score": previous_health_score,
    }

    ml_result = internal_ml_service.predict_health_risk(features=ml_features)

    if ml_result:
        try:
            anomaly_score = float(ml_result.get("anomaly_score", 0.0))
        except (TypeError, ValueError):
            anomaly_score = 0.0

        if not math.isfinite(anomaly_score):
            anomaly_score = 0.0

        anomaly_score = max(0.0, min(1.0, anomaly_score))

        if anomaly_score >= ml_threshold:
            ml_triggered = True
            if not reason:
                reason = "ML detected health anomaly"

            _log(
                "ML health anomaly detected",
                tourist_id=tourist_id,
                anomaly_score=anomaly_score,
            )

    # -------------------------------------------------
    # FINAL DECISION
    # -------------------------------------------------

    if not rule_triggered and not ml_triggered:
        # Reset consecutive alert counter on normal reading
        _reset_alert_streak(tourist_id)
        return

    # Track consecutive alert readings — auto-escalate to SOS after threshold
    streak = _increment_alert_streak(tourist_id)
    _log(
        "Alert streak",
        tourist_id=tourist_id,
        streak=streak,
        reason=reason,
    )

    log_health_alert(
        tourist_id, 0,
        reason or "Health anomaly",
        heart_rate or 0,
        spo2 or 0,
        body_temperature or 0,
    )

    try:
        _trigger_auto_incident(
            db=db,
            tourist_id=tourist_id,
            reason=reason or "Health anomaly detected",
            zone_id=zone_id,
            latitude=latitude,
            longitude=longitude,
        )
    except Exception:
        # If incident creation fails (e.g. no GPS + no zone), still persist
        # the telemetry row and mark it as an alert — don't 500 the caller.
        logger.exception(
            "Auto-incident creation failed — telemetry row still written",
            extra={"tourist_id": tourist_id},
        )


# =========================================================
# Auto Incident Trigger
# =========================================================

def _trigger_auto_incident(
    db:         Session,
    *,
    tourist_id: int,
    reason:     str,
    zone_id:    Optional[int],
    latitude:   Optional[float],
    longitude:  Optional[float],
) -> None:

    # If we have no location at all (no GPS, no zone) we cannot create an
    # incident — incident_service validates location presence.
    # Skip gracefully so the telemetry row is still committed.
    if zone_id is None and (latitude is None or longitude is None):
        _log(
            "Skipping auto-incident — no location available",
            tourist_id=tourist_id,
            reason=reason,
        )
        return

    # Escalate to SOS description after streak threshold
    if _is_sos_escalation(tourist_id):
        reason = f"PERSISTENT ALERT — AUTO-SOS: {reason} (sustained for {_alert_streaks.get(tourist_id, 0)} readings)"
        _reset_alert_streak(tourist_id)  # reset after escalation

    try:
        incident = create_incident(
            db=db,
            tourist_id=tourist_id,
            description=reason,
            source=IncidentSource.IOT,
            latitude=latitude,
            longitude=longitude,
            zone_id=zone_id,
        )
    except ConflictError:
        return
    except Exception:
        _log("create_incident failed", tourist_id=tourist_id, reason=reason)
        return

    create_notification(
        db=db,
        user_id=None,
        event_type="health.emergency",
        channel=NotificationChannel.IN_APP,
        severity=NotificationSeverity.CRITICAL,
        related_entity_type=EntityType.INCIDENT,
        related_entity_id=incident.id,
        context={
            "tourist_id": tourist_id,
            "reason":     reason,
        },
    )

    create_outbox_event(
        db=db,
        topic="health.alert",
        payload={
            "tourist_id":  tourist_id,
            "incident_id": incident.id,
            "reason":      reason,
        },
    )

    create_audit_log(
        db=db,
        user_id=tourist_id,
        action=AuditAction.CREATE_INCIDENT,
        entity_type=EntityType.INCIDENT,
        entity_id=incident.id,
        new_value={
            "auto_triggered": True,
            "reason":         reason,
        },
    )

    _log(
        "Health auto-incident triggered",
        tourist_id=tourist_id,
        reason=reason,
    )