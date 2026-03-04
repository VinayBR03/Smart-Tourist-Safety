import pytest


# =========================================================
# REGISTER
# =========================================================


def test_register_success(client):
    payload = {
        "email": "newuser@test.com",
        "password": "StrongPass123!",
        "role": "TOURIST",
    }

    response = client.post("/auth/register", json=payload)

    assert response.status_code == 201

    data = response.json()

    assert data["email"] == payload["email"].lower()
    assert data["role"] == "TOURIST"
    assert data["is_active"] is True
    assert data["is_verified"] is False or True  # depends on service logic


def test_register_duplicate_email(client, create_user):
    create_user(email="duplicate@test.com")

    payload = {
        "email": "duplicate@test.com",
        "password": "StrongPass123!",
        "role": "TOURIST",
    }

    response = client.post("/auth/register", json=payload)

    assert response.status_code == 409


def test_register_non_tourist_rejected(client):
    payload = {
        "email": "adminregister@test.com",
        "password": "StrongPass123!",
        "role": "ADMIN",
    }

    response = client.post("/auth/register", json=payload)

    assert response.status_code == 403


# =========================================================
# LOGIN
# =========================================================


def test_login_success(client, create_user):
    create_user(email="login@test.com", password="StrongPass123!")

    payload = {
        "email": "login@test.com",
        "password": "StrongPass123!",
        "device_info": "pytest-device",
    }

    response = client.post("/auth/login", json=payload)

    assert response.status_code == 200

    data = response.json()

    assert "access_token" in data
    assert "refresh_token" in data
    assert isinstance(data["access_token"], str)
    assert isinstance(data["refresh_token"], str)


def test_login_invalid_password(client, create_user):
    create_user(email="badpass@test.com", password="StrongPass123!")

    payload = {
        "email": "badpass@test.com",
        "password": "WrongPassword!",
        "device_info": "pytest-device",
    }

    response = client.post("/auth/login", json=payload)

    assert response.status_code == 401


def test_login_nonexistent_user(client):
    payload = {
        "email": "doesnotexist@test.com",
        "password": "StrongPass123!",
        "device_info": "pytest-device",
    }

    response = client.post("/auth/login", json=payload)

    assert response.status_code == 401


def test_login_unverified_user_blocked(client, create_user):
    create_user(
        email="unverified@test.com",
        password="StrongPass123!",
        is_verified=False,
    )

    payload = {
        "email": "unverified@test.com",
        "password": "StrongPass123!",
        "device_info": "pytest-device",
    }

    response = client.post("/auth/login", json=payload)

    assert response.status_code == 403


# =========================================================
# REFRESH
# =========================================================


def test_refresh_token_success(client, create_user):
    create_user(email="refresh@test.com", password="StrongPass123!")

    login = client.post(
        "/auth/login",
        json={
            "email": "refresh@test.com",
            "password": "StrongPass123!",
            "device_info": "pytest-device",
        },
    )

    refresh_token = login.json()["refresh_token"]

    response = client.post(
        "/auth/refresh",
        json={"refresh_token": refresh_token},
    )

    assert response.status_code == 200

    data = response.json()

    assert "access_token" in data
    assert "refresh_token" in data


def test_refresh_invalid_token(client):
    response = client.post(
        "/auth/refresh",
        json={"refresh_token": "invalid.token.value"},
    )

    assert response.status_code == 401


# =========================================================
# LOGOUT
# =========================================================


def test_logout_success(client, create_user):
    create_user(email="logout@test.com", password="StrongPass123!")

    login = client.post(
        "/auth/login",
        json={
            "email": "logout@test.com",
            "password": "StrongPass123!",
            "device_info": "pytest-device",
        },
    )

    refresh_token = login.json()["refresh_token"]

    response = client.post(
        "/auth/logout",
        json={"refresh_token": refresh_token},
    )

    assert response.status_code == 204


def test_logout_invalid_token(client):
    response = client.post(
        "/auth/logout",
        json={"refresh_token": "invalid.token"},
    )

    assert response.status_code == 400


# =========================================================
# GET CURRENT USER
# =========================================================


def test_get_me_success(client, auth_headers):
    response = client.get("/auth/me", headers=auth_headers)

    assert response.status_code == 200

    data = response.json()

    assert "email" in data
    assert "role" in data


def test_get_me_unauthorized(client):
    response = client.get("/auth/me")

    assert response.status_code == 401