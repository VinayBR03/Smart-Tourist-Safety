import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock
from datetime import datetime, timezone

import app.main as main_module

from app.core.exceptions import (
    ValidationError,
    NotFoundError,
    ForbiddenError,
    ConflictError,
)

from app.routers.iot import get_current_iot_device


client = TestClient(main_module.app)


# =========================================================
# Dependency Override
# =========================================================

@pytest.fixture(autouse=True)
def override_iot_device_dependency():

    class DummyDevice:
        device_id = "dev-1"

    def override():
        return DummyDevice()

    main_module.app.dependency_overrides[get_current_iot_device] = override
    yield
    main_module.app.dependency_overrides.clear()


# =========================================================
# HEARTBEAT
# =========================================================

def test_heartbeat_success(monkeypatch):

    monkeypatch.setattr(
        "app.routers.iot.update_heartbeat",
        lambda **kwargs: None,
    )

    response = client.post(
        "/iot/heartbeat",
        json={
            "battery_percentage": 80,
            "battery_voltage": 3.7,
            "firmware_version": "1.0",
        },
    )

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_heartbeat_validation_error(monkeypatch):

    monkeypatch.setattr(
        "app.routers.iot.update_heartbeat",
        lambda **kwargs: (_ for _ in ()).throw(ValidationError("Invalid")),
    )

    response = client.post(
        "/iot/heartbeat",
        json={
            "battery_percentage": 80,
            "battery_voltage": 3.7,
            "firmware_version": "1.0",
        },
    )

    assert response.status_code == 400


# =========================================================
# LOCATION
# =========================================================

def test_location_success(monkeypatch):

    now = datetime.now(timezone.utc).isoformat()

    monkeypatch.setattr(
        "app.routers.iot.handle_location_event",
        lambda **kwargs: None,
    )

    response = client.post(
        "/iot/location",
        json={
            "latitude": 12.9,
            "longitude": 77.5,
            "rssi": -60,
            "sos_flag": False,
            "recorded_at": now,
        },
    )

    assert response.status_code == 202
    assert response.json()["status"] == "accepted"


def test_location_validation_error(monkeypatch):

    now = datetime.now(timezone.utc).isoformat()

    monkeypatch.setattr(
        "app.routers.iot.handle_location_event",
        lambda **kwargs: (_ for _ in ()).throw(ValidationError("Invalid")),
    )

    response = client.post(
        "/iot/location",
        json={
            "latitude": 12.9,
            "longitude": 77.5,
            "rssi": -60,
            "sos_flag": False,
            "recorded_at": now,
        },
    )

    assert response.status_code == 400


def test_location_forbidden(monkeypatch):

    now = datetime.now(timezone.utc).isoformat()

    monkeypatch.setattr(
        "app.routers.iot.handle_location_event",
        lambda **kwargs: (_ for _ in ()).throw(ForbiddenError("Denied")),
    )

    response = client.post(
        "/iot/location",
        json={
            "latitude": 12.9,
            "longitude": 77.5,
            "rssi": -60,
            "sos_flag": False,
            "recorded_at": now,
        },
    )

    assert response.status_code == 403


def test_location_conflict(monkeypatch):

    now = datetime.now(timezone.utc).isoformat()

    monkeypatch.setattr(
        "app.routers.iot.handle_location_event",
        lambda **kwargs: (_ for _ in ()).throw(ConflictError("Conflict")),
    )

    response = client.post(
        "/iot/location",
        json={
            "latitude": 12.9,
            "longitude": 77.5,
            "rssi": -60,
            "sos_flag": False,
            "recorded_at": now,
        },
    )

    assert response.status_code == 409


# =========================================================
# HEALTH
# =========================================================

def test_health_success(monkeypatch):

    now = datetime.now(timezone.utc).isoformat()

    monkeypatch.setattr(
        "app.routers.iot.handle_location_event",
        lambda **kwargs: None,
    )

    response = client.post(
        "/iot/health",
        json={
            "heart_rate": 80,
            "latitude": 12.9,
            "longitude": 77.5,
            "recorded_at": now,
        },
    )

    assert response.status_code == 202
    assert response.json()["status"] == "accepted"


def test_health_validation_error(monkeypatch):

    now = datetime.now(timezone.utc).isoformat()

    monkeypatch.setattr(
        "app.routers.iot.handle_location_event",
        lambda **kwargs: (_ for _ in ()).throw(ValidationError("Invalid")),
    )

    response = client.post(
        "/iot/health",
        json={
            "heart_rate": 80,
            "latitude": 12.9,
            "longitude": 77.5,
            "recorded_at": now,
        },
    )

    assert response.status_code == 400


def test_health_forbidden(monkeypatch):

    now = datetime.now(timezone.utc).isoformat()

    monkeypatch.setattr(
        "app.routers.iot.handle_location_event",
        lambda **kwargs: (_ for _ in ()).throw(NotFoundError("Not found")),
    )

    response = client.post(
        "/iot/health",
        json={
            "heart_rate": 80,
            "latitude": 12.9,
            "longitude": 77.5,
            "recorded_at": now,
        },
    )

    assert response.status_code == 403


def test_health_conflict(monkeypatch):

    now = datetime.now(timezone.utc).isoformat()

    monkeypatch.setattr(
        "app.routers.iot.handle_location_event",
        lambda **kwargs: (_ for _ in ()).throw(ConflictError("Conflict")),
    )

    response = client.post(
        "/iot/health",
        json={
            "heart_rate": 80,
            "latitude": 12.9,
            "longitude": 77.5,
            "recorded_at": now,
        },
    )

    assert response.status_code == 409