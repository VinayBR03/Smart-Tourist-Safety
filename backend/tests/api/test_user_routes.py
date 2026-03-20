import uuid
import pytest

from app.core.enums import UserRole


# =========================================================
# GET CURRENT USER
# =========================================================

def test_get_current_user_profile(client, auth_headers):

    response = client.get(
        "/users/me",
        headers=auth_headers,
    )

    assert response.status_code == 200

    data = response.json()

    assert "id" in data
    assert "email" in data
    assert data["role"] == UserRole.TOURIST.value


# =========================================================
# LIST USERS (ADMIN ONLY)
# =========================================================

def test_admin_can_list_users(client, admin_headers):

    response = client.get(
        "/users",
        headers=admin_headers,
    )

    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_non_admin_cannot_list_users(client, auth_headers):

    response = client.get(
        "/users",
        headers=auth_headers,
    )

    assert response.status_code == 403


# =========================================================
# GET USER BY ID
# =========================================================

def test_admin_can_get_user_by_id(client, admin_headers, create_user):

    user = create_user()

    response = client.get(
        f"/users/{user.id}",
        headers=admin_headers,
    )

    assert response.status_code == 200
    assert response.json()["id"] == user.id


def test_get_user_not_found(client, admin_headers):

    response = client.get(
        "/users/999999",
        headers=admin_headers,
    )

    assert response.status_code == 404


def test_non_admin_cannot_get_user(client, auth_headers, create_user):

    user = create_user()

    response = client.get(
        f"/users/{user.id}",
        headers=auth_headers,
    )

    assert response.status_code == 403


# =========================================================
# CREATE AUTHORITY
# =========================================================

def test_admin_can_create_authority(client, admin_headers):

    payload = {
        "email": f"authority_{uuid.uuid4().hex[:6]}@example.com",
        "password": "StrongPass123!",
        "name": "Authority User",
    }

    response = client.post(
        "/users/authority",
        json=payload,
        headers=admin_headers,
    )

    assert response.status_code == 201

    data = response.json()

    assert data["email"] == payload["email"]
    assert data["role"] == UserRole.AUTHORITY.value


def test_create_authority_missing_fields(client, admin_headers):

    payload = {
        "email": "missing@example.com"
    }

    response = client.post(
        "/users/authority",
        json=payload,
        headers=admin_headers,
    )

    assert response.status_code == 400


def test_create_authority_duplicate_email(client, admin_headers, create_user):

    email = f"duplicate_{uuid.uuid4().hex[:6]}@example.com"

    create_user(email=email)

    payload = {
        "email": email,
        "password": "StrongPass123!",
        "name": "Authority User",
    }

    response = client.post(
        "/users/authority",
        json=payload,
        headers=admin_headers,
    )

    assert response.status_code == 409


def test_non_admin_cannot_create_authority(client, auth_headers):

    payload = {
        "email": f"authority_{uuid.uuid4().hex[:6]}@example.com",
        "password": "StrongPass123!",
        "name": "Authority User",
    }

    response = client.post(
        "/users/authority",
        json=payload,
        headers=auth_headers,
    )

    assert response.status_code == 403


# =========================================================
# UPDATE USER STATUS
# =========================================================

def test_admin_can_update_user_status(client, admin_headers, create_user):

    user = create_user()

    payload = {"is_active": False}

    response = client.patch(
        f"/users/{user.id}/status",
        json=payload,
        headers=admin_headers,
    )

    assert response.status_code == 200

    data = response.json()

    assert data["updated"] is True
    assert data["user_id"] == user.id


def test_update_user_status_missing_field(client, admin_headers, create_user):

    user = create_user()

    response = client.patch(
        f"/users/{user.id}/status",
        json={},
        headers=admin_headers,
    )

    assert response.status_code == 400


def test_update_user_status_not_found(client, admin_headers):

    response = client.patch(
        "/users/999999/status",
        json={"is_active": True},
        headers=admin_headers,
    )

    assert response.status_code == 404


def test_non_admin_cannot_update_user_status(client, auth_headers, create_user):

    user = create_user()

    response = client.patch(
        f"/users/{user.id}/status",
        json={"is_active": False},
        headers=auth_headers,
    )

    assert response.status_code == 403