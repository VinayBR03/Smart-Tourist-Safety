# app/realtime/redis_listener.py

import asyncio
import json
from typing import Dict, Any, Optional

from redis.exceptions import RedisError

from app.core.redis import get_redis
from app.utils.logger import get_logger
from app.routers.websocket import websocket_manager


logger = get_logger(__name__)

REDIS_CHANNEL = "realtime.events"


# =========================================================
# Event Router
# =========================================================

async def _route_event(event: Dict[str, Any]) -> None:
    """
    Route Redis event to appropriate WebSocket targets.
    """

    event_type_raw: Optional[Any] = event.get("event_type")
    data_raw: Optional[Any] = event.get("data")

    # Strict type validation
    if not isinstance(event_type_raw, str):
        return

    if not isinstance(data_raw, dict):
        return

    event_type: str = event_type_raw
    data: Dict[str, Any] = data_raw

    message = {
        "event_type": event_type,
        "data": data,
    }

    # -----------------------------------------------------
    # Tourist-directed events
    # -----------------------------------------------------
    tourist_id_raw = data.get("tourist_id")

    if isinstance(tourist_id_raw, int):
        await websocket_manager.broadcast_to_user(
            user_id=tourist_id_raw,
            message=message,
        )

    # -----------------------------------------------------
    # Authority broadcast events
    # -----------------------------------------------------
    if event_type.startswith("incident.") or event_type.startswith("media."):
        await websocket_manager.broadcast_to_role(
            role="AUTHORITY",
            message=message,
        )

    # -----------------------------------------------------
    # Notification events
    # -----------------------------------------------------
    if event_type.startswith("notification."):
        user_id_raw = data.get("user_id")

        if isinstance(user_id_raw, int):
            await websocket_manager.broadcast_to_user(
                user_id=user_id_raw,
                message=message,
            )


# =========================================================
# Redis Subscriber Loop
# =========================================================

async def start_redis_listener() -> None:
    """
    Subscribes to Redis pub/sub channel and dispatches
    events to WebSocket manager.
    """

    logger.info("Starting Redis realtime listener")

    redis_client = get_redis(strict=False)

    if not redis_client:
        logger.warning("Redis unavailable. Realtime disabled.")
        return

    pubsub = redis_client.pubsub()
    pubsub.subscribe(REDIS_CHANNEL)

    loop = asyncio.get_running_loop()

    try:
        while True:
            try:
                message = await loop.run_in_executor(
                    None,
                    pubsub.get_message,
                    True,   # ignore subscribe messages
                    1.0     # timeout
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
                    logger.warning("Invalid Redis message format")
                    continue

                await _route_event(event)

            except RedisError:
                logger.exception("Redis connection error")
                await asyncio.sleep(2)

            except Exception:
                logger.exception("Unexpected Redis listener error")
                await asyncio.sleep(2)

    finally:
        try:
            pubsub.close()
        except Exception:
            logger.exception("Redis pubsub shutdown failed")