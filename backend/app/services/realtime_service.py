from typing import Dict, Any, Optional
from datetime import datetime, timezone

from app.core.websocket_manager import websocket_manager
from app.core.enums import UserRole
from app.core.config import settings
from app.core.exceptions import ValidationError
from app.core.logging_config import get_correlation_id
from app.utils.logger import get_logger


logger = get_logger(__name__)

MAX_EVENT_PAYLOAD_BYTES = 20_000
MAX_EVENT_TYPE_LENGTH   = 100


# =========================================================
# Internal Guards
# =========================================================

def _websockets_enabled() -> bool:
    return getattr(settings, "ENABLE_WEBSOCKETS", False)


def _validate_event(event_type: str, data: Dict[str, Any]) -> str:

    if not event_type or not isinstance(event_type, str):
        raise ValidationError("Event type required")

    event_type = event_type.strip()

    if len(event_type) > MAX_EVENT_TYPE_LENGTH:
        raise ValidationError("Event type too long")

    if not isinstance(data, dict):
        raise ValidationError("Event payload must be dictionary")

    return event_type.lower()


def _enforce_payload_size(event: Dict[str, Any]) -> None:
    import json

    try:
        serialized = json.dumps(event, sort_keys=True)
    except Exception:
        raise ValidationError("Event payload must be JSON serializable")

    if len(serialized.encode("utf-8")) > MAX_EVENT_PAYLOAD_BYTES:
        raise ValidationError("Realtime event payload too large")


def _wrap_event(
    *,
    event_type: str,
    data:       Dict[str, Any],
) -> Dict[str, Any]:

    normalized_type = _validate_event(event_type, data)

    event = {
        "type":           normalized_type,
        "timestamp":      datetime.now(timezone.utc)
                              .replace(microsecond=0)
                              .isoformat(),
        "correlation_id": get_correlation_id(),
        "data":           data,
    }

    _enforce_payload_size(event)

    return event


# =========================================================
# Safe Publish Helpers
#
# IMPORTANT: Use publish_to_user / publish_to_role (Redis
# pub/sub), NOT broadcast_to_user / broadcast_to_role.
#
# broadcast_* sends only to connections on THIS worker.
# publish_* sends to Redis so every worker delivers to its
# locally connected sockets — correct for multi-worker
# Gunicorn deployments (4 workers = 4 separate processes).
# =========================================================

async def _safe_publish_to_user(
    *,
    user_id:    int,
    event_type: str,
    data:       Dict[str, Any],
) -> None:

    if not _websockets_enabled():
        return

    if not websocket_manager:
        return

    if not isinstance(user_id, int) or user_id <= 0:
        return

    try:
        await websocket_manager.publish_to_user(
            user_id=user_id,
            event_type=event_type,
            data=data,
        )
    except Exception as e:
        logger.error(
            "WebSocket user publish failed",
            extra={
                "extra_data": {
                    "user_id":       user_id,
                    "error_type":    type(e).__name__,
                    "correlation_id": get_correlation_id(),
                }
            },
        )


async def _safe_publish_to_role(
    *,
    role:       str,
    event_type: str,
    data:       Dict[str, Any],
) -> None:

    if not _websockets_enabled():
        return

    if not websocket_manager:
        return

    valid_roles = {r.value for r in UserRole}

    if role not in valid_roles:
        return

    try:
        await websocket_manager.publish_to_role(
            role=role,
            event_type=event_type,
            data=data,
        )
    except Exception as e:
        logger.error(
            "WebSocket role publish failed",
            extra={
                "extra_data": {
                    "role":          role,
                    "error_type":    type(e).__name__,
                    "correlation_id": get_correlation_id(),
                }
            },
        )


async def _publish_to_authority_layer(
    event_type: str,
    data:       Dict[str, Any],
) -> None:
    await _safe_publish_to_role(
        role=UserRole.AUTHORITY.value,
        event_type=event_type,
        data=data,
    )
    await _safe_publish_to_role(
        role=UserRole.ADMIN.value,
        event_type=event_type,
        data=data,
    )


# =========================================================
# Incident Events
# =========================================================

async def broadcast_incident_created(*, data: Dict[str, Any]) -> None:
    await _publish_to_authority_layer("incident.created", data)


async def broadcast_incident_updated(*, data: Dict[str, Any]) -> None:
    await _publish_to_authority_layer("incident.updated", data)


# =========================================================
# Zone Risk Events
# =========================================================

async def broadcast_zone_risk_updated(*, data: Dict[str, Any]) -> None:
    await _publish_to_authority_layer("zone.risk.updated", data)


# =========================================================
# Notification Events
# =========================================================

async def broadcast_notification_created(
    *,
    user_id: Optional[int],
    data:    Dict[str, Any],
) -> None:

    if user_id is not None:
        await _safe_publish_to_user(
            user_id=user_id,
            event_type="notification.created",
            data=data,
        )
    else:
        await _publish_to_authority_layer("notification.created", data)


# =========================================================
# Tourist Activity Events
# =========================================================

async def broadcast_tourist_activity_update(*, data: Dict[str, Any]) -> None:
    await _publish_to_authority_layer("tourist.activity.updated", data)


# =========================================================
# Location Events
# =========================================================

async def broadcast_location_update(*, data: Dict[str, Any]) -> None:
    await _publish_to_authority_layer("location.update", data)