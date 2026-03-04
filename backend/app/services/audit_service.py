# app/services/audit_service.py

from datetime import datetime, timezone
from typing import Optional, Dict, Any
import json
import copy

from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.core.enums import AuditAction, EntityType
from app.core.exceptions import ValidationError
from app.core.logging_config import get_correlation_id
from app.utils.logger import get_logger


logger = get_logger(__name__)

# Hard cap to prevent oversized audit blobs (defensive safety)
MAX_AUDIT_PAYLOAD_BYTES = 20_000  # 20 KB


# =========================================================
# Create Audit Log (Transactional Only – NO COMMIT)
# =========================================================

def create_audit_log(
    db: Session,
    *,
    user_id: Optional[int],
    action: AuditAction,
    entity_type: EntityType,
    entity_id: Optional[int] = None,
    old_value: Optional[Dict[str, Any]] = None,
    new_value: Optional[Dict[str, Any]] = None,
    ip_address: Optional[str] = None,
) -> AuditLog:
    """
    Enterprise-grade audit logging.

    Guarantees:
    - No commit
    - No HTTP exceptions
    - Strict enum validation
    - JSON-safe values
    - Payload size protection
    - Correlation propagation
    - Deterministic serialization
    - Defensive copying
    """

    if db is None:
        raise ValidationError("Database session required for audit logging")

    # -----------------------------------------------------
    # Enum Validation (Fail Fast)
    # -----------------------------------------------------

    if not isinstance(action, AuditAction):
        raise ValidationError("Invalid audit action")

    if not isinstance(entity_type, EntityType):
        raise ValidationError("Invalid entity type")

    # -----------------------------------------------------
    # Safe JSON Handling
    # -----------------------------------------------------

    safe_old = _safe_dict(old_value)
    safe_new = _safe_dict(new_value)

    _enforce_payload_size(safe_old)
    _enforce_payload_size(safe_new)

    now = datetime.now(timezone.utc)

    audit = AuditLog(
        user_id=user_id,
        action=action.value,
        entity_type=entity_type.value,
        entity_id=entity_id,
        old_value=safe_old,
        new_value=safe_new,
        ip_address=_normalize_ip(ip_address),
        created_at=now,
    )

    db.add(audit)

    logger.debug(
        "Audit log created",
        extra={
            "extra_data": {
                "action": action.value,
                "entity_type": entity_type.value,
                "entity_id": entity_id,
                "user_id": user_id,
                "correlation_id": get_correlation_id(),
            }
        },
    )

    return audit


# =========================================================
# Helpers
# =========================================================

def _safe_dict(value: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """
    Ensures value is JSON-serializable dict.
    Prevents audit corruption and mutation side-effects.
    """

    if value is None:
        return None

    if not isinstance(value, dict):
        raise ValidationError("Audit values must be dictionary")

    # Defensive deep copy
    copied = copy.deepcopy(value)

    try:
        # Deterministic JSON validation
        json.dumps(copied, sort_keys=True)
    except Exception:
        raise ValidationError("Audit value must be JSON serializable")

    return copied


def _enforce_payload_size(value: Optional[Dict[str, Any]]) -> None:
    """
    Prevents accidental large payload storage.
    """

    if value is None:
        return

    serialized = json.dumps(value, sort_keys=True)

    if len(serialized.encode("utf-8")) > MAX_AUDIT_PAYLOAD_BYTES:
        raise ValidationError("Audit payload exceeds maximum allowed size")


def _normalize_ip(ip: Optional[str]) -> Optional[str]:
    if not ip:
        return None

    ip = ip.strip()

    if len(ip) > 45:
        raise ValidationError("Invalid IP address length")

    return ip