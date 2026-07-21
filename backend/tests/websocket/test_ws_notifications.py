import pytest
import asyncio
from starlette.websockets import WebSocketDisconnect

from app.core.security import create_access_token
from app.core.enums import UserRole
from app.core.websocket_manager import websocket_manager


def build_ws_url(path: str, token: str):
    return f"{path}?token={token}"


def get_next_real_message(ws):
    """
    Helper function to consume messages from a WebSocket 
    until a non-ping payload is received.
    """
    while True:
        msg = ws.receive_json()
        if msg.get("type") != "ping":
            return msg


# =========================================================
# User Receives Direct Notification
# =========================================================

def test_user_receives_notification(client, create_user):

    user = create_user(
        email="notify_user@example.com",
        role=UserRole.TOURIST,
    )

    token = create_access_token(
        user_id=user.id,
        role=user.role.value,
        token_version=user.token_version,
    )

    url = build_ws_url("/ws/notifications", token)

    with client.websocket_connect(url) as websocket:

        message = {
            "type": "notification.created",
            "data": {"msg": "Hello"},
        }

        asyncio.run(
            websocket_manager.broadcast_to_user(
                user_id=user.id,
                message=message,
            )
        )

        received = get_next_real_message(websocket)

        assert received["type"] == "notification.created"
        assert received["data"]["msg"] == "Hello"


# =========================================================
# Notification Isolation Between Users
# =========================================================

def test_notification_isolation_between_users(client, create_user):

    user1 = create_user(
        email="notify_user1@example.com",
        role=UserRole.TOURIST,
    )

    user2 = create_user(
        email="notify_user2@example.com",
        role=UserRole.TOURIST,
    )

    token1 = create_access_token(
        user_id=user1.id,
        role=user1.role.value,
        token_version=user1.token_version,
    )

    token2 = create_access_token(
        user_id=user2.id,
        role=user2.role.value,
        token_version=user2.token_version,
    )

    url1 = build_ws_url("/ws/notifications", token1)
    url2 = build_ws_url("/ws/notifications", token2)

    with client.websocket_connect(url1) as ws1:
        with client.websocket_connect(url2) as ws2:

            message = {
                "type": "notification.created",
                "data": {"msg": "Private"},
            }

            asyncio.run(
                websocket_manager.broadcast_to_user(
                    user_id=user1.id,
                    message=message,
                )
            )

            # user1 receives
            received = get_next_real_message(ws1)
            assert received["data"]["msg"] == "Private"

            # user2 should not receive anything besides a potential initial ping
            with pytest.raises(Exception):
                # We loop in case user2 receives multiple system frames/pings, 
                # but should time out before getting the "Private" message.
                while True:
                    msg = ws2.receive_json(timeout=0.2)
                    if msg.get("type") != "ping":
                        break


# =========================================================
# Multi-Device Support
# =========================================================

def test_user_multi_device_support(client, create_user):

    user = create_user(
        email="multidevice@example.com",
        role=UserRole.TOURIST,
    )

    token = create_access_token(
        user_id=user.id,
        role=user.role.value,
        token_version=user.token_version,
    )

    url = build_ws_url("/ws/notifications", token)

    with client.websocket_connect(url) as ws1:
        with client.websocket_connect(url) as ws2:

            message = {
                "type": "notification.created",
                "data": {"msg": "Sync"},
            }

            asyncio.run(
                websocket_manager.broadcast_to_user(
                    user_id=user.id,
                    message=message,
                )
            )

            received1 = get_next_real_message(ws1)
            received2 = get_next_real_message(ws2)

            assert received1["data"]["msg"] == "Sync"
            assert received2["data"]["msg"] == "Sync"


# =========================================================
# Disconnect Cleanup
# =========================================================

def test_disconnect_removes_connection(client, create_user):

    user = create_user(
        email="cleanup_user@example.com",
        role=UserRole.TOURIST,
    )

    token = create_access_token(
        user_id=user.id,
        role=user.role.value,
        token_version=user.token_version,
    )

    url = build_ws_url("/ws/notifications", token)

    with client.websocket_connect(url) as websocket:

        # Confirm active
        active_before = asyncio.run(
            websocket_manager.get_active_user_count()
        )
        assert active_before >= 1

    # After context exit, connection should be removed
    active_after = asyncio.run(
        websocket_manager.get_active_user_count()
    )

    assert active_after == 0


# =========================================================
# Broadcast After Disconnect Does Not Crash
# =========================================================

def test_broadcast_after_disconnect_safe(client, create_user):

    user = create_user(
        email="safe_broadcast@example.com",
        role=UserRole.TOURIST,
    )

    token = create_access_token(
        user_id=user.id,
        role=user.role.value,
        token_version=user.token_version,
    )

    url = build_ws_url("/ws/notifications", token)

    with client.websocket_connect(url):
        pass  # immediately disconnect

    # Should not raise even if no active connections
    asyncio.run(
        websocket_manager.broadcast_to_user(
            user_id=user.id,
            message={"type": "notification.created", "data": {}},
        )
    )
