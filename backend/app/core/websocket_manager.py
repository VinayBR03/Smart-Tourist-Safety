# app/core/websocket_manager.py

import asyncio
import json
from typing import Dict, Set, Tuple, Optional

from fastapi import WebSocket

from app.core.config import settings
from app.utils.logger import get_logger

logger = get_logger(__name__)

REDIS_CHANNEL = "realtime.events"


class WebSocketManager:
    """
    Production-grade WebSocket manager with Redis pub/sub fan-out.
    """

    def __init__(self) -> None:
        self.user_connections:    Dict[int, Set[WebSocket]]        = {}
        self.role_connections:    Dict[str, Set[WebSocket]]        = {}
        self.connection_metadata: Dict[WebSocket, Tuple[int, str]] = {}

        self._lock                     = asyncio.Lock()
        self._max_connections_per_user = 3   # reduced from 5 — dev only needs 1-2

    # =========================================================
    # Connect
    # =========================================================

    async def connect(
        self,
        *,
        user_id:   int,
        role:      str,
        websocket: WebSocket,
    ) -> None:

        if not settings.ENABLE_WEBSOCKETS:
            await websocket.close()
            return

        async with self._lock:
            existing = self.user_connections.get(user_id, set())

            # ── Evict stale connections before checking the limit ──
            # Stale connections are sockets that are no longer open
            # but weren't removed because the disconnect handler
            # didn't run (e.g. server restart, network drop).
            stale = set()
            for ws in existing:
                try:
                    # send_json with an empty ping — if it raises the
                    # connection is dead and should be evicted
                    await ws.send_json({"type": "ping"})
                except Exception:
                    stale.add(ws)

            for ws in stale:
                existing.discard(ws)
                self.connection_metadata.pop(ws, None)
                role_set = self.role_connections.get(role)
                if role_set:
                    role_set.discard(ws)

            if stale:
                logger.info(
                    "Evicted %d stale connections for user %d",
                    len(stale),
                    user_id,
                )

            if len(existing) >= self._max_connections_per_user:
                logger.warning(
                    "WebSocket limit exceeded — accepting then closing cleanly",
                    extra={"extra_data": {"user_id": user_id}},
                )
                # MUST accept before closing — closing an unaccepted
                # WebSocket causes RuntimeError in the router's receive_text()
                await websocket.accept()
                await websocket.close(code=4029, reason="Connection limit reached")
                return

            await websocket.accept()

            self.user_connections.setdefault(user_id, set()).add(websocket)
            self.role_connections.setdefault(role,    set()).add(websocket)
            self.connection_metadata[websocket] = (user_id, role)

        logger.info(
            "WebSocket connected",
            extra={"extra_data": {"user_id": user_id, "role": role}},
        )

    # =========================================================
    # Disconnect
    # =========================================================

    async def disconnect(self, websocket: WebSocket) -> None:

        async with self._lock:
            metadata = self.connection_metadata.pop(websocket, None)
            if not metadata:
                return

            user_id, role = metadata

            user_set = self.user_connections.get(user_id)
            if user_set:
                user_set.discard(websocket)
                if not user_set:
                    self.user_connections.pop(user_id, None)

            role_set = self.role_connections.get(role)
            if role_set:
                role_set.discard(websocket)
                if not role_set:
                    self.role_connections.pop(role, None)

        logger.info(
            "WebSocket disconnected",
            extra={"extra_data": {"user_id": user_id, "role": role}},
        )

    # =========================================================
    # Local broadcast (THIS worker only)
    # Called by redis_listener after receiving from Redis.
    # =========================================================

    async def broadcast_to_user(
        self,
        *,
        user_id: int,
        message: dict,
    ) -> None:
        async with self._lock:
            connections = list(self.user_connections.get(user_id, set()))

        for ws in connections:
            try:
                await ws.send_json(message)
            except Exception:
                await self.disconnect(ws)

    async def broadcast_to_role(
        self,
        *,
        role:    str,
        message: dict,
    ) -> None:
        async with self._lock:
            connections = list(self.role_connections.get(role, set()))

        for ws in connections:
            try:
                await ws.send_json(message)
            except Exception:
                await self.disconnect(ws)

    # =========================================================
    # Redis publish (ALL workers)
    # Use these from services / routers / tasks.
    # =========================================================

    def _get_redis(self):
        if not settings.ENABLE_REDIS:
            return None
        try:
            from app.core.redis import get_redis
            return get_redis(strict=False)
        except Exception:
            return None

    def _publish(self, event_type: str, data: dict) -> None:
        redis_client = self._get_redis()
        if not redis_client:
            return
        try:
            payload = json.dumps({"event_type": event_type, "data": data})
            redis_client.publish(REDIS_CHANNEL, payload)
        except Exception:
            logger.warning(
                "Redis publish failed — message may not reach all workers",
                extra={"extra_data": {"event_type": event_type}},
            )

    async def publish_to_user(
        self,
        *,
        user_id:    int,
        event_type: str,
        data:       dict,
    ) -> None:
        payload = {**data, "tourist_id": user_id, "user_id": user_id}
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(None, self._publish, event_type, payload)

    async def publish_to_role(
        self,
        *,
        role:       str,
        event_type: str,
        data:       dict,
    ) -> None:
        payload = {**data, "_target_role": role}
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(None, self._publish, event_type, payload)

    # =========================================================
    # Helpers
    # =========================================================

    async def get_active_user_count(self) -> int:
        async with self._lock:
            return sum(len(v) for v in self.user_connections.values())

    # =========================================================
    # Shutdown
    # =========================================================

    async def shutdown(self) -> None:
        async with self._lock:
            all_connections = list(self.connection_metadata.keys())

        for ws in all_connections:
            try:
                await ws.close()
            except Exception:
                pass

        logger.info("WebSocket manager shutdown complete")


# =========================================================
# Global Singleton
# =========================================================

if settings.ENABLE_WEBSOCKETS:
    websocket_manager = WebSocketManager()
else:
    websocket_manager = None  # type: ignore[assignment]