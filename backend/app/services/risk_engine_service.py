from datetime import datetime, timezone
from typing import Tuple, Optional, Dict
import math

from sqlalchemy.orm import Session
from sqlalchemy import select

from app.models.zone import Zone
from app.models.zone_status import ZoneStatus
from app.models.zone_risk_history import ZoneRiskHistory

from app.core.enums import (
    RiskLevel,
    AuditAction,
    EntityType,
    NotificationChannel,
    NotificationSeverity,
)

from app.core.exceptions import NotFoundError, ValidationError
from app.core.logging_config import get_correlation_id
from app.core.config import settings

from app.services.audit_service import create_audit_log
from app.services.outbox_service import create_outbox_event
from app.services.notification_service import create_notification
from app.services.feature_service import extract_zone_features, normalize_features
from app.services.internal_ml_service import internal_ml_service
from app.services.blockchain_service import log_zone_risk

from app.utils.logger import get_logger


logger = get_logger(__name__)

FLOAT_TOLERANCE = 0.0001


# =========================================================
# Utilities
# =========================================================

def _clamp_score(score: float) -> float:
    try:
        score = float(score)
    except (TypeError, ValueError):
        return 0.0

    if not math.isfinite(score):
        return 0.0

    return max(0.0, min(1.0, score))


def _resolve_risk_level(score: float) -> RiskLevel:
    low = float(getattr(settings, "RISK_LOW_THRESHOLD", 0.3))
    high = float(getattr(settings, "RISK_HIGH_THRESHOLD", 0.7))

    if score < low:
        return RiskLevel.LOW
    elif score < high:
        return RiskLevel.MEDIUM
    return RiskLevel.HIGH


def _log(message: str, **kwargs):
    logger.info(
        message,
        extra={
            "extra_data": {
                **kwargs,
                "correlation_id": get_correlation_id(),
            }
        },
    )


# =========================================================
# RULE-BASED ENGINE
# =========================================================

def compute_rule_based_risk(
    db: Session,
    *,
    zone_id: int,
) -> Tuple[float, RiskLevel, Dict[str, float]]:

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

    if not zone.is_active:
        return 0.0, RiskLevel.LOW, {}

    features = extract_zone_features(db, zone_id=zone_id)
    features = normalize_features(features=features)

    incident_weight = float(getattr(settings, "RISK_INCIDENT_WEIGHT", 0.4))
    sos_weight = float(getattr(settings, "RISK_SOS_WEIGHT", 0.3))
    density_weight = float(getattr(settings, "RISK_DENSITY_WEIGHT", 0.3))
    density_norm = max(float(getattr(settings, "RISK_DENSITY_NORMALIZER", 100)), 1.0)

    incident_score = min(
        features["incident_count"] * incident_weight,
        incident_weight,
    )

    sos_score = min(
        features["sos_count"] * sos_weight,
        sos_weight,
    )

    density_score = min(
        (features["event_count"] / density_norm) * density_weight,
        density_weight,
    )

    raw_score = incident_score + sos_score + density_score

    risk_score = _clamp_score(raw_score)
    risk_level = _resolve_risk_level(risk_score)

    return risk_score, risk_level, features


# =========================================================
# HYBRID ORCHESTRATION
# =========================================================

def update_zone_status(
    db: Session,
    zone_id: int,
) -> None:

    rule_score, rule_level, features = compute_rule_based_risk(
        db,
        zone_id=zone_id,
    )

    final_score = rule_score
    final_level = rule_level
    model_version = "rule_v1"

    if features:

        ml_result = internal_ml_service.predict_zone_risk(
            features=features,
        )

        if ml_result:

            try:
                ml_level = RiskLevel(ml_result["risk_level"])
            except Exception:
                ml_level = rule_level

            ml_score = _clamp_score(ml_result["risk_score"])

            if rule_level == RiskLevel.HIGH and ml_level != RiskLevel.HIGH:
                _log(
                    "ML downgrade blocked",
                    zone_id=zone_id,
                    rule_level=rule_level.value,
                    ml_level=ml_level.value,
                )
            else:
                final_score = ml_score
                final_level = ml_level
                model_version = ml_result.get("model_version") or "ml_unknown"

                _log(
                    "ML risk applied",
                    zone_id=zone_id,
                    risk_score=final_score,
                    model_version=model_version,
                )
        else:
            _log(
                "Rule fallback used",
                zone_id=zone_id,
                risk_score=final_score,
            )

    persist_zone_risk(
        db,
        zone_id=zone_id,
        risk_score=final_score,
        risk_level=final_level,
        model_version=model_version,
        features=features,
    )


# =========================================================
# Persistence
# =========================================================

def persist_zone_risk(
    db: Session,
    *,
    zone_id: int,
    risk_score: float,
    risk_level: RiskLevel,
    model_version: Optional[str] = None,
    features: Optional[Dict[str, float]] = None,
) -> None:

    if not isinstance(risk_level, RiskLevel):
        raise ValidationError("Invalid risk level")

    risk_score = _clamp_score(risk_score)
    now = datetime.now(timezone.utc)

    # Ensure zone exists
    zone_exists = (
        db.query(Zone.id)
        .filter(
            Zone.id == zone_id,
            Zone.deleted_at.is_(None),
        )
        .first()
    )

    if not zone_exists:
        raise NotFoundError("Zone")

    stmt = (
        select(ZoneStatus)
        .where(ZoneStatus.zone_id == zone_id)
        .with_for_update()
    )

    zone_status = db.execute(stmt).scalar_one_or_none()

    previous_level = None
    previous_score = None

    if zone_status:
        previous_level = zone_status.risk_level
        previous_score = float(zone_status.risk_score)

        if (
            abs(previous_score - risk_score) < FLOAT_TOLERANCE
            and previous_level == risk_level.value
            and zone_status.model_version == model_version
        ):
            return

        zone_status.risk_score = risk_score
        zone_status.risk_level = risk_level.value
        zone_status.model_version = model_version
        zone_status.updated_at = now

    else:
        zone_status = ZoneStatus(
            zone_id=zone_id,
            risk_score=risk_score,
            risk_level=risk_level.value,
            model_version=model_version,
            updated_at=now,
        )
        db.add(zone_status)

        zone_risk_entry = ZoneRiskHistory(
            zone_id=zone_id,
            risk_score=risk_score,
            risk_level=risk_level.value,
            model_version=model_version,
            recorded_at=now,
        )
        db.add(zone_risk_entry)

    tx = log_zone_risk(zone_id, previous_level or "", risk_level.value, risk_score, model_version or "unknown")
    zone_risk_entry.blockchain_tx_hash = tx
    if zone_status:
        zone_status.blockchain_tx_hash = tx

    create_audit_log(
        db=db,
        user_id=None,
        action=AuditAction.UPDATE_ZONE,
        entity_type=EntityType.ZONE,
        entity_id=zone_id,
        new_value={
            "risk_score": risk_score,
            "risk_level": risk_level.value,
            "model_version": model_version,
        },
    )

    create_outbox_event(
        db=db,
        topic="zone.risk.updated",
        payload={
            "zone_id": zone_id,
            "risk_score": risk_score,
            "risk_level": risk_level.value,
        },
    )

    if previous_level != RiskLevel.HIGH.value and risk_level == RiskLevel.HIGH:
        create_notification(
            db=db,
            user_id=None,
            event_type="ZONE_HIGH_RISK_ALERT",
            channel=NotificationChannel.IN_APP,
            severity=NotificationSeverity.CRITICAL,
            related_entity_type=EntityType.ZONE,
            related_entity_id=zone_id,
            context={
                "zone_id": zone_id,
                "risk_score": risk_score,
                "features": features or {},
            },
        )

    _log(
        "Zone risk persisted",
        zone_id=zone_id,
        risk_score=risk_score,
        risk_level=risk_level.value,
        previous_level=previous_level,
    )