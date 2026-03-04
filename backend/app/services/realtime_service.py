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
MAX_EVENT_TYPE_LENGTH = 100


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
    data: Dict[str, Any],
) -> Dict[str, Any]:

    normalized_type = _validate_event(event_type, data)

    event = {
        "type": normalized_type,
        "timestamp": datetime.now(timezone.utc)
        .replace(microsecond=0)
        .isoformat(),
        "correlation_id": get_correlation_id(),
        "data": data,
    }

    _enforce_payload_size(event)

    return event


# =========================================================
# Safe Broadcast Helpers
# =========================================================

async def _safe_broadcast_to_user(
    *,
    user_id: int,
    event: Dict[str, Any],
) -> None:

    if not _websockets_enabled():
        return

    if not websocket_manager:
        return

    if not isinstance(user_id, int) or user_id <= 0:
        return

    try:
        await websocket_manager.broadcast_to_user(
            user_id=user_id,
            message=event,
        )
    except Exception as e:
        logger.error(
            "WebSocket user broadcast failed",
            extra={
                "extra_data": {
                    "user_id": user_id,
                    "error_type": type(e).__name__,
                    "correlation_id": get_correlation_id(),
                }
            },
        )


async def _safe_broadcast_to_role(
    *,
    role: str,
    event: Dict[str, Any],
) -> None:

    if not _websockets_enabled():
        return

    if not websocket_manager:
        return

    valid_roles = {r.value for r in UserRole}

    if role not in valid_roles:
        return

    try:
        await websocket_manager.broadcast_to_role(
            role=role,
            message=event,
        )
    except Exception as e:
        logger.error(
            "WebSocket role broadcast failed",
            extra={
                "extra_data": {
                    "role": role,
                    "error_type": type(e).__name__,
                    "correlation_id": get_correlation_id(),
                }
            },
        )


async def _broadcast_to_authority_layer(event: Dict[str, Any]) -> None:

    await _safe_broadcast_to_role(
        role=UserRole.AUTHORITY.value,
        event=event,
    )

    await _safe_broadcast_to_role(
        role=UserRole.ADMIN.value,
        event=event,
    )


# =========================================================
# Incident Events
# =========================================================

async def broadcast_incident_created(*, data: Dict[str, Any]) -> None:
    event = _wrap_event(event_type="incident.created", data=data)
    await _broadcast_to_authority_layer(event)


async def broadcast_incident_updated(*, data: Dict[str, Any]) -> None:
    event = _wrap_event(event_type="incident.updated", data=data)
    await _broadcast_to_authority_layer(event)


# =========================================================
# Zone Risk Events
# =========================================================

async def broadcast_zone_risk_updated(*, data: Dict[str, Any]) -> None:
    event = _wrap_event(event_type="zone.risk.updated", data=data)
    await _broadcast_to_authority_layer(event)


# =========================================================
# Notification Events
# =========================================================

async def broadcast_notification_created(
    *,
    user_id: Optional[int],
    data: Dict[str, Any],
) -> None:

    event = _wrap_event(event_type="notification.created", data=data)

    if user_id is not None:
        await _safe_broadcast_to_user(
            user_id=user_id,
            event=event,
        )
    else:
        await _broadcast_to_authority_layer(event)


# =========================================================
# Tourist Activity Events
# =========================================================

async def broadcast_tourist_activity_update(
    *,
    data: Dict[str, Any],
) -> None:

    event = _wrap_event(
        event_type="tourist.activity.updated",
        data=data,
    )

    await _broadcast_to_authority_layer(event)