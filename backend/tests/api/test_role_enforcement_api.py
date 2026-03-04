import pytest

from app.core.enums import UserRole
from app.core.security import create_access_token


# =========================================================
# HELPERS
# =========================================================

def tampered_role_headers(user):
    """
    Create token with wrong role embedded (privilege escalation attempt).
    """
    token = create_access_token(
        user_id=user.id,
        role="ADMIN",  # Force escalation attempt
        token_version=user.token_version,
    )
    return {"Authorization": f"Bearer {token}"}


# =========================================================
# ADMIN ENDPOINTS PROTECTION
# =========================================================

def test_tourist_cannot_create_device(client, auth_headers):
    response = client.post("/devices", json={}, headers=auth_headers)
    assert response.status_code == 403


def test_authority_cannot_create_device(client, authority_headers):
    response = client.post("/devices", json={}, headers=authority_headers)
    assert response.status_code == 403


def test_admin_can_access_admin_endpoint(client, admin_headers):
    response = client.get("/devices", headers=admin_headers)
    assert response.status_code in (200, 204)


# =========================================================
# AUTHORITY PROTECTION
# =========================================================

def test_tourist_cannot_list_incidents(client, auth_headers):
    response = client.get("/incidents", headers=auth_headers)
    assert response.status_code == 403


def test_authority_can_list_incidents(client, authority_headers):
    response = client.get("/incidents", headers=authority_headers)
    assert response.status_code in (200, 204)


# =========================================================
# TOURIST PROTECTION
# =========================================================

def test_admin_cannot_access_tourist_profile_endpoint(client, admin_headers):
    response = client.get("/tourists/me", headers=admin_headers)
    assert response.status_code == 403


def test_tourist_can_access_own_profile(client, auth_headers):
    response = client.get("/tourists/me", headers=auth_headers)
    assert response.status_code == 200


# =========================================================
# TOKEN TAMPERING
# =========================================================

def test_token_role_tampering_blocked(client, create_user):
    user = create_user(role=UserRole.TOURIST, is_verified=True)

    headers = tampered_role_headers(user)
    response = client.get("/devices", headers=headers)

    # Role mismatch should trigger 401 (token invalid)
    assert response.status_code == 401


# =========================================================
# INACTIVE USER BLOCKED
# =========================================================

def test_inactive_user_blocked(client, create_user):
    user = create_user(is_active=False, is_verified=True)

    token = create_access_token(
        user_id=user.id,
        role=user.role.value,
        token_version=user.token_version,
    )

    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/tourists/me", headers=headers)

    assert response.status_code == 403


# =========================================================
# UNVERIFIED USER BLOCKED
# =========================================================

def test_unverified_user_blocked(client, create_user):
    user = create_user(is_verified=False)

    token = create_access_token(
        user_id=user.id,
        role=user.role.value,
        token_version=user.token_version,
    )

    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/tourists/me", headers=headers)

    assert response.status_code == 403


# =========================================================
# SOFT DELETED USER BLOCKED
# =========================================================

def test_deleted_user_blocked(client, create_user, db_session):
    user = create_user(is_verified=True)

    user.is_deleted = True
    user.deleted_at = user.created_at
    db_session.commit()

    token = create_access_token(
        user_id=user.id,
        role=user.role.value,
        token_version=user.token_version,
    )

    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/tourists/me", headers=headers)

    assert response.status_code == 403


# =========================================================
# TOKEN VERSION MISMATCH
# =========================================================

def test_token_version_mismatch_blocked(client, create_user):
    user = create_user(is_verified=True)

    # simulate session invalidation
    user.token_version += 1

    token = create_access_token(
        user_id=user.id,
        role=user.role.value,
        token_version=0,
    )

    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/tourists/me", headers=headers)

    assert response.status_code == 401


# =========================================================
# MISSING TOKEN
# =========================================================

def test_missing_token_blocked(client):
    response = client.get("/tourists/me")

    # HTTPBearer auto_error=True returns 401
    assert response.status_code == 401