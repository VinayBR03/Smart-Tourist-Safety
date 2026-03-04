# app/core/websocket_manager.py

import asyncio
from typing import Dict, Set, Tuple
from fastapi import WebSocket

from app.core.config import settings
from app.utils.logger import get_logger


logger = get_logger(__name__)


class WebSocketManager:

    """
    Production-grade WebSocket manager.
    """

    def __init__(self) -> None:
        self.user_connections: Dict[int, Set[WebSocket]] = {}
        self.role_connections: Dict[str, Set[WebSocket]] = {}
        self.connection_metadata: Dict[WebSocket, Tuple[int, str]] = {}

        self._lock = asyncio.Lock()
        self._max_connections_per_user = 5  # safety guard

    # =========================================================
    # Connect
    # =========================================================

    async def connect(
        self,
        *,
        user_id: int,
        role: str,
        websocket: WebSocket,
    ) -> None:

        if not settings.ENABLE_WEBSOCKETS:
            await websocket.close()
            return

        async with self._lock:

            # Prevent abuse
            existing = self.user_connections.get(user_id, set())
            if len(existing) >= self._max_connections_per_user:
                logger.warning(
                    "WebSocket limit exceeded",
                    extra={"extra_data": {"user_id": user_id}},
                )
                await websocket.close()
                return

            self.user_connections.setdefault(user_id, set()).add(websocket)
            self.role_connections.setdefault(role, set()).add(websocket)
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
    # Broadcast to User
    # =========================================================

    async def broadcast_to_user(
        self,
        *,
        user_id: int,
        message: dict,
    ) -> None:

        async with self._lock:
            connections = list(self.user_connections.get(user_id, set()))

        for connection in connections:
            try:
                await connection.send_json(message)
            except Exception:
                await self.disconnect(connection)

    # =========================================================
    # Broadcast to Role
    # =========================================================

    async def broadcast_to_role(
        self,
        *,
        role: str,
        message: dict,
    ) -> None:

        async with self._lock:
            connections = list(self.role_connections.get(role, set()))

        for connection in connections:
            try:
                await connection.send_json(message)
            except Exception:
                await self.disconnect(connection)

    # =========================================================
    # Shutdown Cleanup
    # =========================================================

    async def shutdown(self):

        async with self._lock:
            all_connections = list(self.connection_metadata.keys())

        for connection in all_connections:
            try:
                await connection.close()
            except Exception:
                pass

        logger.info("WebSocket manager shutdown complete")


# =========================================================
# Global Singleton (Only if enabled)
# =========================================================

if settings.ENABLE_WEBSOCKETS:
    websocket_manager = WebSocketManager()
else:
    websocket_manager = None