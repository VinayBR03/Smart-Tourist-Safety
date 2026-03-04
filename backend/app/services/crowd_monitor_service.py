from datetime import datetime, timedelta, timezone
from typing import Dict
import math

from sqlalchemy.orm import Session
from sqlalchemy import func, select

from app.models.location_event import LocationEvent
from app.models.zone import Zone
from app.models.incident import Incident

from app.core.enums import (
    AuditAction,
    EntityType,
    NotificationChannel,
    NotificationSeverity,
)

from app.services.audit_service import create_audit_log
from app.services.notification_service import create_notification
from app.services.outbox_service import create_outbox_event
from app.services.internal_ml_service import internal_ml_service

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
# Cooldown Guard
# =========================================================

def _has_recent_crowd_alert(db: Session, *, zone_id: int) -> bool:

    cooldown = int(getattr(settings, "CROWD_ALERT_COOLDOWN_MINUTES", 5))

    threshold = datetime.now(timezone.utc) - timedelta(minutes=cooldown)

    stmt = (
        select(Incident.id)
        .where(
            Incident.zone_id == zone_id,
            Incident.created_at >= threshold,
            Incident.deleted_at.is_(None),
        )
        .limit(1)
    )

    return db.execute(stmt).scalar_one_or_none() is not None


# =========================================================
# Feature Extraction
# =========================================================

def _extract_crowd_features(
    db: Session,
    *,
    zone_id: int,
    window_minutes: int = 10,
) -> Dict[str, float]:

    now = datetime.now(timezone.utc)
    window_start = now - timedelta(minutes=window_minutes)

    event_count = (
        db.query(func.count(LocationEvent.id))
        .filter(
            LocationEvent.zone_id == zone_id,
            LocationEvent.timestamp >= window_start,
        )
        .scalar()
        or 0
    )

    unique_devices = (
        db.query(func.count(func.distinct(LocationEvent.tourist_id)))
        .filter(
            LocationEvent.zone_id == zone_id,
            LocationEvent.timestamp >= window_start,
        )
        .scalar()
        or 0
    )

    avg_dwell_time = float(event_count) / max(unique_devices, 1)
    movement_entropy = min(1.0, unique_devices / max(event_count, 1))

    return {
        "event_count": float(event_count),
        "unique_devices": float(unique_devices),
        "avg_dwell_time": float(avg_dwell_time),
        "movement_entropy": float(movement_entropy),
    }


# =========================================================
# Evaluate Crowd Activity
# =========================================================

def evaluate_crowd_activity(
    db: Session,
    *,
    zone_id: int,
) -> None:

    # Validate zone exists and active
    zone = (
        db.query(Zone)
        .filter(
            Zone.id == zone_id,
            Zone.deleted_at.is_(None),
            Zone.is_active.is_(True),
        )
        .first()
    )

    if not zone:
        return

    if _has_recent_crowd_alert(db, zone_id=zone_id):
        return

    features = _extract_crowd_features(
        db,
        zone_id=zone_id,
    )

    ml_result = internal_ml_service.predict_crowd_anomaly(
        features=features
    )

    if not ml_result:
        return

    try:
        anomaly_score = float(ml_result.get("anomaly_score", 0.0))
    except (TypeError, ValueError):
        anomaly_score = 0.0

    if not math.isfinite(anomaly_score):
        anomaly_score = 0.0

    anomaly_score = max(0.0, min(1.0, anomaly_score))

    threshold = float(getattr(settings, "CROWD_ANOMALY_THRESHOLD", 0.8))

    if anomaly_score < threshold:
        return

    # -------------------------------------------------
    # Trigger Alert
    # -------------------------------------------------

    create_notification(
        db=db,
        user_id=None,
        event_type="CROWD_ANOMALY_ALERT",
        channel=NotificationChannel.IN_APP,
        severity=NotificationSeverity.HIGH,
        related_entity_type=EntityType.ZONE,
        related_entity_id=zone_id,
        context={
            "zone_id": zone_id,
            "anomaly_score": anomaly_score,
        },
    )

    create_outbox_event(
        db=db,
        topic="crowd.anomaly.detected",
        payload={
            "zone_id": zone_id,
            "anomaly_score": anomaly_score,
        },
    )

    create_audit_log(
        db=db,
        user_id=None,
        action=AuditAction.UPDATE_ZONE,
        entity_type=EntityType.ZONE,
        entity_id=zone_id,
        new_value={
            "crowd_anomaly": True,
            "anomaly_score": anomaly_score,
        },
    )

    _log(
        "Crowd anomaly detected",
        zone_id=zone_id,
        anomaly_score=anomaly_score,
    )