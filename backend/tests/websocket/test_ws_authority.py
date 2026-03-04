import pytest
import asyncio
from starlette.websockets import WebSocketDisconnect

from app.core.security import create_access_token
from app.core.enums import UserRole
from app.core.websocket_manager import websocket_manager


def build_ws_url(path: str, token: str):
    return f"{path}?token={token}"


# =========================================================
# Authority Can Connect
# =========================================================

def test_authority_can_connect(client, create_user):

    user = create_user(
        email="authority_connect@example.com",
        role=UserRole.AUTHORITY,
    )

    token = create_access_token(
        user_id=user.id,
        role=user.role.value,
        token_version=user.token_version,
    )

    url = build_ws_url("/ws/authority/live", token)

    with client.websocket_connect(url) as websocket:
        websocket.send_text("ping")


# =========================================================
# Admin Can Connect
# =========================================================

def test_admin_can_connect(client, create_user):

    user = create_user(
        email="admin_connect@example.com",
        role=UserRole.ADMIN,
    )

    token = create_access_token(
        user_id=user.id,
        role=user.role.value,
        token_version=user.token_version,
    )

    url = build_ws_url("/ws/authority/live", token)

    with client.websocket_connect(url) as websocket:
        websocket.send_text("ping")


# =========================================================
# Tourist Cannot Connect
# =========================================================

def test_tourist_cannot_connect_to_authority_socket(client, create_user):

    user = create_user(
        email="tourist_blocked@example.com",
        role=UserRole.TOURIST,
    )

    token = create_access_token(
        user_id=user.id,
        role=user.role.value,
        token_version=user.token_version,
    )

    url = build_ws_url("/ws/authority/live", token)

    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect(url):
            pass


# =========================================================
# Broadcast Reaches Authority
# =========================================================

def test_authority_receives_broadcast(client, create_user):

    user = create_user(
        email="authority_broadcast@example.com",
        role=UserRole.AUTHORITY,
    )

    token = create_access_token(
        user_id=user.id,
        role=user.role.value,
        token_version=user.token_version,
    )

    url = build_ws_url("/ws/authority/live", token)

    with client.websocket_connect(url) as websocket:

        message = {
            "type": "incident.created",
            "data": {"id": 123},
        }

        asyncio.run(
            websocket_manager.broadcast_to_role(
                role=UserRole.AUTHORITY.value,
                message=message,
            )
        )

        received = websocket.receive_json()

        assert received["type"] == "incident.created"
        assert received["data"]["id"] == 123


# =========================================================
# Tourist Does NOT Receive Authority Broadcast
# =========================================================

def test_tourist_does_not_receive_authority_broadcast(client, create_user):

    tourist = create_user(
        email="tourist_isolated@example.com",
        role=UserRole.TOURIST,
    )

    authority = create_user(
        email="authority_isolated@example.com",
        role=UserRole.AUTHORITY,
    )

    tourist_token = create_access_token(
        user_id=tourist.id,
        role=tourist.role.value,
        token_version=tourist.token_version,
    )

    authority_token = create_access_token(
        user_id=authority.id,
        role=authority.role.value,
        token_version=authority.token_version,
    )

    tourist_url = build_ws_url("/ws/notifications", tourist_token)
    authority_url = build_ws_url("/ws/authority/live", authority_token)

    with client.websocket_connect(tourist_url) as tourist_ws:
        with client.websocket_connect(authority_url) as authority_ws:

            message = {
                "type": "incident.created",
                "data": {"id": 555},
            }

            asyncio.run(
                websocket_manager.broadcast_to_role(
                    role=UserRole.AUTHORITY.value,
                    message=message,
                )
            )

            # Authority should receive
            received = authority_ws.receive_json()
            assert received["data"]["id"] == 555

            # Tourist should not receive
            with pytest.raises(Exception):
                tourist_ws.receive_json(timeout=0.2)