from datetime import datetime, timedelta, timezone
from typing import Dict, Optional, Tuple
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

def _log(message: str, **kwargs) -> None:
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

    cooldown  = int(getattr(settings, "CROWD_ALERT_COOLDOWN_MINUTES", 5))
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
#
# We don't have raw dwell-time or movement-distribution data
# in location_event, so we build the best proxies available:
#
#   avg_dwell_time   = events per unique device
#                      (more events per person → longer dwell)
#
#   movement_entropy = unique devices / total events
#                      (high ratio → crowd is spread out →
#                       high entropy; low ratio → a few devices
#                       generating many events → clustered)
#
# These are approximations. For production accuracy, raw
# dwell timestamps should be logged per-tourist and fed
# through CrowdFeatureEngineer directly.
# =========================================================

def _extract_crowd_features(
    db:             Session,
    *,
    zone_id:        int,
    window_minutes: int = 10,
) -> Dict[str, float]:

    now          = datetime.now(timezone.utc)
    window_start = now - timedelta(minutes=window_minutes)

    event_count = (
        db.query(func.count(LocationEvent.id))
        .filter(
            LocationEvent.zone_id == zone_id,
            LocationEvent.timestamp >= window_start,
        )
        .scalar() or 0
    )

    unique_devices = (
        db.query(func.count(func.distinct(LocationEvent.tourist_id)))
        .filter(
            LocationEvent.zone_id == zone_id,
            LocationEvent.timestamp >= window_start,
        )
        .scalar() or 0
    )

    # avg_dwell_time: how many events each person generates
    # (proxy for time spent — more events = longer presence)
    avg_dwell_time: float = (
        float(event_count) / max(float(unique_devices), 1.0)
    )

    # movement_entropy: ratio of unique people to total events
    # High → crowd is spread (many different people, few events each)
    # Low  → crowd is clustered (same people generating many events)
    # Clamped to [0, 1] — unique_devices can never exceed event_count
    movement_entropy: float = min(
        1.0,
        float(unique_devices) / max(float(event_count), 1.0),
    )

    return {
        "event_count":      float(event_count),
        "unique_devices":   float(unique_devices),
        "avg_dwell_time":   avg_dwell_time,
        "movement_entropy": movement_entropy,
    }


# =========================================================
# Rule-Based Fallback
#
# Used when ML engine is unavailable (circuit open, models
# not yet trained, AI engine container not started).
#
# Three independent triggers — any one fires the alert:
#
#   1. DENSITY     — raw event count exceeds threshold
#                    (simplest signal: too many people)
#
#   2. SPIKE       — surge ratio: events >> unique devices
#                    means a small group generating massive
#                    activity (SOS spam, emergency, device bug)
#
#   3. SATURATION  — many unique devices all active at once
#                    and high entropy = packed zone with
#                    different tourists all simultaneously active
#
# Returns (triggered, score, reason).
# =========================================================

def _rule_based_crowd_check(
    features: Dict[str, float],
) -> Tuple[bool, float, Optional[str]]:

    event_count    = features["event_count"]
    unique_devices = features["unique_devices"]
    avg_dwell      = features["avg_dwell_time"]
    entropy        = features["movement_entropy"]

    density_threshold     = float(getattr(settings, "CROWD_ALERT_THRESHOLD",        500))
    spike_ratio_threshold = float(getattr(settings, "CROWD_SPIKE_RATIO_THRESHOLD",  10.0))
    saturation_threshold  = float(getattr(settings, "CROWD_SATURATION_THRESHOLD",   200))
    saturation_entropy    = float(getattr(settings, "CROWD_SATURATION_ENTROPY_MIN", 0.8))

    # ── Rule 1: Raw density ──────────────────────────────
    if event_count >= density_threshold:
        score = min(1.0, event_count / density_threshold)
        return True, round(score, 6), "Crowd density threshold exceeded"

    # ── Rule 2: Activity spike ───────────────────────────
    # avg_dwell high + meaningful event count = few devices
    # generating many events — unusual burst pattern
    if avg_dwell >= spike_ratio_threshold and event_count >= 50:
        score = min(1.0, avg_dwell / spike_ratio_threshold)
        return True, round(score, 6), "Abnormal crowd activity spike detected"

    # ── Rule 3: High saturation ──────────────────────────
    # Many unique devices all active + high entropy = packed zone
    if (
        unique_devices >= saturation_threshold
        and entropy >= saturation_entropy
    ):
        score = min(1.0, unique_devices / density_threshold)
        return True, round(score, 6), "Zone saturation — high unique device density"

    return False, 0.0, None


# =========================================================
# Alert Trigger (shared by ML and rule paths)
# =========================================================

def _fire_alert(
    db:            Session,
    *,
    zone_id:       int,
    anomaly_score: float,
    source:        str,
) -> None:
    """
    Creates notification, outbox event, and audit log.
    source: "ml" | "rule"
    """

    create_notification(
        db=db,
        user_id=None,
        event_type="CROWD_ANOMALY_ALERT",
        channel=NotificationChannel.IN_APP,
        severity=NotificationSeverity.HIGH,
        related_entity_type=EntityType.ZONE,
        related_entity_id=zone_id,
        context={
            "zone_id":       zone_id,
            "anomaly_score": anomaly_score,
            "source":        source,
        },
    )

    create_outbox_event(
        db=db,
        topic="crowd.anomaly.detected",
        payload={
            "zone_id":       zone_id,
            "anomaly_score": anomaly_score,
            "source":        source,
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
            "source":        source,
        },
    )

    _log(
        "Crowd anomaly detected",
        zone_id=zone_id,
        anomaly_score=anomaly_score,
        source=source,
    )


# =========================================================
# Evaluate Crowd Activity
#
# Decision flow:
#   1. Validate zone exists and is active
#   2. Check cooldown — skip if recent alert fired
#   3. Extract features from location_event
#   4. Try ML prediction
#      a. ML available  → use ML score, skip rules
#      b. ML unavailable → apply rule-based fallback
#   5. Fire alert if threshold exceeded
# =========================================================

def evaluate_crowd_activity(
    db:      Session,
    *,
    zone_id: int,
) -> None:

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

    features = _extract_crowd_features(db, zone_id=zone_id)

    ml_threshold = float(getattr(settings, "CROWD_ANOMALY_THRESHOLD", 0.8))

    # ── ML Path ──────────────────────────────────────────
    ml_result = internal_ml_service.predict_crowd_anomaly(features=features)

    if ml_result:
        try:
            anomaly_score = float(ml_result.get("anomaly_score", 0.0))
        except (TypeError, ValueError):
            anomaly_score = 0.0

        if not math.isfinite(anomaly_score):
            anomaly_score = 0.0

        anomaly_score = max(0.0, min(1.0, anomaly_score))

        if anomaly_score >= ml_threshold:
            _fire_alert(
                db,
                zone_id=zone_id,
                anomaly_score=anomaly_score,
                source="ml",
            )

        # ML responded — skip rules regardless of outcome.
        # Don't double-check with rules when ML is healthy.
        return

    # ── Rule-Based Fallback ──────────────────────────────
    # ML engine unavailable (circuit open, model not loaded,
    # AI engine container down). Apply deterministic rules so
    # crowd alerts still fire during ML outages.

    _log(
        "ML unavailable — applying rule-based crowd check",
        zone_id=zone_id,
    )

    triggered, rule_score, reason = _rule_based_crowd_check(features)

    if triggered:
        _fire_alert(
            db,
            zone_id=zone_id,
            anomaly_score=rule_score,
            source="rule",
        )