import pytest
from app.core.enums import UserRole
from app.core.security import create_access_token


# =========================================================
# GET OWN PROFILE
# =========================================================

def test_tourist_can_get_own_profile(client, auth_headers):
    response = client.get("/tourists/me", headers=auth_headers)

    assert response.status_code == 200
    data = response.json()

    assert "user" in data
    assert "activity_status" in data


def test_admin_cannot_access_me_endpoint(client, admin_headers):
    response = client.get("/tourists/me", headers=admin_headers)
    assert response.status_code == 403


# =========================================================
# GET TOURIST BY ID (ADMIN / AUTHORITY)
# =========================================================

def test_admin_can_fetch_tourist_by_id(client, admin_headers, create_user):
    tourist = create_user(role=UserRole.TOURIST, is_verified=True)

    response = client.get(f"/tourists/{tourist.id}", headers=admin_headers)

    assert response.status_code == 200
    data = response.json()
    assert data["user"]["id"] == tourist.id


def test_tourist_cannot_fetch_other_tourist(client, auth_headers, create_user):
    other = create_user(email="other@test.com", role=UserRole.TOURIST, is_verified=True)

    response = client.get(f"/tourists/{other.id}", headers=auth_headers)

    assert response.status_code == 403


def test_fetch_nonexistent_tourist(client, admin_headers):
    response = client.get("/tourists/999999", headers=admin_headers)
    assert response.status_code == 404


# =========================================================
# UPDATE OWN PROFILE
# =========================================================

def test_tourist_can_update_profile(client, auth_headers):
    payload = {
        "full_name": "Updated Name",
        "phone": "9999999999"
    }

    response = client.patch("/tourists/me", json=payload, headers=auth_headers)

    assert response.status_code == 200
    data = response.json()

    assert data["updated"] is True
    assert "user_id" in data


def test_invalid_profile_update_payload(client, auth_headers):
    response = client.patch("/tourists/me", json="invalid", headers=auth_headers)
    assert response.status_code == 422


# =========================================================
# PROFILE PHOTO
# =========================================================

def test_get_profile_photo_key(client, auth_headers):
    response = client.get("/tourists/me/profile-photo", headers=auth_headers)

    assert response.status_code == 200
    assert "s3_key" in response.json()


# =========================================================
# ACCOUNT DELETION
# =========================================================

def test_request_account_deletion_success(client, auth_headers):
    response = client.post("/tourists/me/request-deletion", headers=auth_headers)

    assert response.status_code == 204


def test_request_deletion_twice_returns_204(client, auth_headers):
    client.post("/tourists/me/request-deletion", headers=auth_headers)
    response = client.post("/tourists/me/request-deletion", headers=auth_headers)

    # Service silently ignores if already pending
    assert response.status_code == 204


# =========================================================
# AUTHORIZATION PROTECTION
# =========================================================

def test_missing_token_blocked(client):
    response = client.get("/tourists/me")
    assert response.status_code == 401


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