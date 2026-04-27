# app/realtime/redis_listener.py

import asyncio
import json
from typing import Dict, Any, Optional

from app.core.config import settings
from app.utils.logger import get_logger

logger = get_logger(__name__)

REDIS_CHANNEL = "realtime.events"


# =========================================================
# Event Router
# =========================================================

async def _route_event(
    event:             Dict[str, Any],
    websocket_manager: Any,
) -> None:
    """
    Route a Redis pub/sub event to the correct WebSocket targets
    on THIS worker.

    Routing rules
    ─────────────
    1. `tourist_id` or `user_id` in data  → broadcast to that user
    2. `_target_role` in data             → broadcast to that role
    3. event_type starts with incident./media.  → broadcast to AUTHORITY role
    4. event_type starts with notification.     → broadcast to user_id
    """

    event_type_raw = event.get("event_type")
    data_raw       = event.get("data")

    if not isinstance(event_type_raw, str):
        return
    if not isinstance(data_raw, dict):
        return

    event_type: str        = event_type_raw
    data:       Dict[str, Any] = data_raw

    message = {"type": event_type.lower(), "event_type": event_type.lower(), "data": data}

    # ----------------------------------------------------------
    # Role-targeted broadcast  (_target_role set by publish_to_role)
    # ----------------------------------------------------------
    target_role = data.get("_target_role")
    if isinstance(target_role, str):
        await websocket_manager.broadcast_to_role(
            role=target_role,
            message=message,
        )
        return  # role-targeted — don't double-deliver

    # ----------------------------------------------------------
    # User-targeted broadcast  (tourist_id or user_id)
    # ----------------------------------------------------------
    user_id: Optional[int] = None

    tourist_id_raw = data.get("tourist_id")
    if isinstance(tourist_id_raw, int):
        user_id = tourist_id_raw

    user_id_raw = data.get("user_id")
    if isinstance(user_id_raw, int):
        user_id = user_id_raw

    if user_id is not None:
        await websocket_manager.broadcast_to_user(
            user_id=user_id,
            message=message,
        )

    # ----------------------------------------------------------
    # Authority fan-out  (incident / media events)
    # ----------------------------------------------------------
    if event_type.startswith("incident.") or event_type.startswith("media."):
        await websocket_manager.broadcast_to_role(
            role="AUTHORITY",
            message=message,
        )

    # ----------------------------------------------------------
    # ADMIN fan-out  (system-level events)
    # ----------------------------------------------------------
    if event_type.startswith("system.") or event_type.startswith("zone.risk."):
        await websocket_manager.broadcast_to_role(
            role="ADMIN",
            message=message,
        )


# =========================================================
# Redis Subscriber Loop
# =========================================================

async def start_redis_listener() -> None:
    """
    Subscribes to the Redis realtime channel and dispatches
    events to the local WebSocket manager.

    Runs as a background task on every Uvicorn worker process.
    Because each worker has its own in-memory connection table,
    each worker only delivers to sockets it owns — which is
    exactly what we want.
    """

    if not settings.ENABLE_WEBSOCKETS:
        logger.info("WebSockets disabled — Redis listener not started")
        return

    if not settings.ENABLE_REDIS:
        logger.warning("Redis disabled — realtime events will not fan-out")
        return

    # Import here to avoid circular dependency at module load
    from app.core.websocket_manager import websocket_manager
    from app.core.redis import get_redis

    if websocket_manager is None:
        logger.warning("WebSocket manager is None — listener not started")
        return

    logger.info("Starting Redis realtime listener on channel: %s", REDIS_CHANNEL)

    loop = asyncio.get_running_loop()

    while True:
        redis_client = get_redis(strict=False)

        if not redis_client:
            logger.warning("Redis unavailable — retrying in 5s")
            await asyncio.sleep(5)
            continue

        pubsub = redis_client.pubsub()

        try:
            pubsub.subscribe(REDIS_CHANNEL)
            logger.info("Redis listener subscribed to %s", REDIS_CHANNEL)

            while True:
                # Run blocking get_message in executor so we don't block
                # the event loop. Timeout=1.0s keeps the loop responsive.
                message = await loop.run_in_executor(
                    None,
                    lambda: pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0),
                )

                if not message:
                    await asyncio.sleep(0.05)
                    continue

                if message.get("type") != "message":
                    continue

                raw_data = message.get("data")
                if not isinstance(raw_data, str):
                    continue

                try:
                    event: Dict[str, Any] = json.loads(raw_data)
                except json.JSONDecodeError:
                    logger.warning("Redis listener received invalid JSON — skipping")
                    continue

                try:
                    await _route_event(event, websocket_manager)
                except Exception:
                    logger.exception("Error routing Redis event")

        except Exception:
            logger.exception("Redis listener error — reconnecting in 3s")
            await asyncio.sleep(3)

        finally:
            try:
                pubsub.unsubscribe(REDIS_CHANNEL)
                pubsub.close()
            except Exception:
                pass