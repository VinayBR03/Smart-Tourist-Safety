import pytest
from starlette.websockets import WebSocketDisconnect
from jose import jwt
from datetime import datetime, timedelta, timezone

from app.core.config import settings
from app.core.security import create_access_token
from app.core.enums import UserRole


settings.ENABLE_WEBSOCKETS = True


def build_ws_url(path: str, token: str | None = None):
    if token:
        return f"{path}?token={token}"
    return path


# =========================================================
# Missing Token
# =========================================================

def test_ws_rejects_missing_token(client):
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect("/ws/notifications"):
            pass


# =========================================================
# Invalid Token
# =========================================================

def test_ws_rejects_invalid_token(client):
    url = build_ws_url("/ws/notifications", "invalidtoken")

    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect(url):
            pass


# =========================================================
# Expired Token
# =========================================================

def test_ws_rejects_expired_token(client, create_user):
    user = create_user()

    expired_payload = {
        "sub": str(user.id),
        "role": user.role.value,
        "token_version": user.token_version,
        "type": "access",
        "exp": datetime.now(timezone.utc) - timedelta(minutes=5),
    }

    token = jwt.encode(
        expired_payload,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )

    url = build_ws_url("/ws/notifications", token)

    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect(url):
            pass


# =========================================================
# Token Version Mismatch
# =========================================================

def test_ws_rejects_token_version_mismatch(client, create_user, db_session):
    user = create_user()

    token = create_access_token(
        user_id=user.id,
        role=user.role.value,
        token_version=user.token_version,
    )

    # Invalidate session
    user.token_version += 1
    db_session.commit()

    url = build_ws_url("/ws/notifications", token)

    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect(url):
            pass


# =========================================================
# Role Tampering
# =========================================================

def test_ws_rejects_role_tampering(client, create_user):
    user = create_user(role=UserRole.TOURIST)

    tampered_token = create_access_token(
        user_id=user.id,
        role=UserRole.ADMIN.value,
        token_version=user.token_version,
    )

    url = build_ws_url("/ws/notifications", tampered_token)

    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect(url):
            pass


# =========================================================
# Inactive User
# =========================================================

def test_ws_rejects_inactive_user(client, create_user):
    user = create_user(is_active=False)

    token = create_access_token(
        user_id=user.id,
        role=user.role.value,
        token_version=user.token_version,
    )

    url = build_ws_url("/ws/notifications", token)

    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect(url):
            pass


# =========================================================
# Unverified User
# =========================================================

def test_ws_rejects_unverified_user(client, create_user):
    user = create_user(is_verified=False)

    token = create_access_token(
        user_id=user.id,
        role=user.role.value,
        token_version=user.token_version,
    )

    url = build_ws_url("/ws/notifications", token)

    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect(url):
            pass


# =========================================================
# Valid Connection
# =========================================================

def test_ws_accepts_valid_token(client, auth_headers):
    token = auth_headers["Authorization"].split(" ")[1]
    url = build_ws_url("/ws/notifications", token)

    with client.websocket_connect(url) as websocket:
        websocket.send_text("ping")