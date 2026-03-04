import pytest
from app.core.enums import UserRole, DeviceStatus, DeviceType
from app.core.exceptions import ValidationError, NotFoundError, ForbiddenError


# =========================================================
# REGISTER DEVICE
# =========================================================

def test_admin_can_register_device(client, admin_headers):
    payload = {
        "device_id": "device123",
        "device_type": DeviceType.WRISTBAND.name,
    }

    response = client.post("/devices", json=payload, headers=admin_headers)
    assert response.status_code == 201
    assert "api_key" in response.json()


def test_tourist_cannot_register_device(client, auth_headers):
    payload = {
        "device_id": "blocked123",
        "device_type": DeviceType.WRISTBAND.name,
    }

    response = client.post("/devices", json=payload, headers=auth_headers)
    assert response.status_code == 403


# =========================================================
# LIST DEVICES
# =========================================================

def test_admin_can_list_devices(client, admin_headers):
    response = client.get("/devices", headers=admin_headers)
    assert response.status_code in (200, 204)


def test_authority_can_list_devices(client, authority_headers):
    response = client.get("/devices", headers=authority_headers)
    assert response.status_code in (200, 204)


def test_tourist_cannot_list_devices(client, auth_headers):
    response = client.get("/devices", headers=auth_headers)
    assert response.status_code == 403


# =========================================================
# FETCH DEVICE
# =========================================================

def test_fetch_device_not_found(client, admin_headers):
    response = client.get("/devices/nonexistent", headers=admin_headers)
    assert response.status_code == 404


# =========================================================
# UPDATE STATUS
# =========================================================

def test_admin_can_update_device_status(client, admin_headers):
    register_payload = {
        "device_id": "status123",
        "device_type": DeviceType.WRISTBAND.name,
    }

    create_res = client.post("/devices", json=register_payload, headers=admin_headers)
    assert create_res.status_code == 201

    update_payload = {"status": DeviceStatus.ACTIVE.name}

    response = client.patch(
        "/devices/status123/status",
        json=update_payload,
        headers=admin_headers,
    )

    assert response.status_code == 200


def test_invalid_status_transition(client, admin_headers):
    register_payload = {
        "device_id": "invalidstatus123",
        "device_type": DeviceType.WRISTBAND.name,
    }

    client.post("/devices", json=register_payload, headers=admin_headers)

    # Try illegal transition directly to DECOMMISSIONED via generic endpoint
    response = client.patch(
        "/devices/invalidstatus123/status",
        json={"status": "DECOMMISSIONED"},
        headers=admin_headers,
    )

    assert response.status_code in (400, 422)


# =========================================================
# ASSIGN / UNASSIGN
# =========================================================

def test_admin_can_assign_and_unassign_device(
    client, admin_headers, create_user
):
    user = create_user(email="tourist_assign@example.com")

    register_payload = {
        "device_id": "assign123",
        "device_type": DeviceType.WRISTBAND.name,
    }

    client.post("/devices", json=register_payload, headers=admin_headers)

    client.patch(
        "/devices/assign123/status",
        json={"status": "ACTIVE"},
        headers=admin_headers,
    )

    assign_res = client.post(
        f"/devices/assign123/assign/{user.id}",
        headers=admin_headers,
    )
    assert assign_res.status_code == 204

    unassign_res = client.post(
        "/devices/assign123/unassign",
        headers=admin_headers,
    )
    assert unassign_res.status_code == 204


def test_tourist_cannot_assign_device(client, auth_headers):
    response = client.post("/devices/deviceX/assign/1", headers=auth_headers)
    assert response.status_code == 403

# =========================================================
# ROUTER EXCEPTION BRANCH COVERAGE
# =========================================================



# ---------------------------------------------------------
# REGISTER DEVICE - ValidationError -> 400
# ---------------------------------------------------------

def test_register_device_validation_error(client, admin_headers, monkeypatch):
    def raise_validation(*args, **kwargs):
        raise ValidationError("Invalid device")

    monkeypatch.setattr(
        "app.routers.device.register_device",
        raise_validation,
    )

    payload = {
        "device_id": "baddevice",
        "device_type": DeviceType.WRISTBAND.name,
    }

    response = client.post("/devices", json=payload, headers=admin_headers)
    assert response.status_code == 400


# ---------------------------------------------------------
# FETCH DEVICE - Forced NotFound -> 404
# ---------------------------------------------------------

def test_fetch_device_forced_not_found(client, admin_headers, monkeypatch):
    def raise_not_found(*args, **kwargs):
        raise NotFoundError("Missing")

    monkeypatch.setattr(
        "app.routers.device.get_device",
        raise_not_found,
    )

    response = client.get("/devices/xyz", headers=admin_headers)
    assert response.status_code == 404


# ---------------------------------------------------------
# UPDATE STATUS - NotFound -> 404
# ---------------------------------------------------------

def test_update_status_not_found(client, admin_headers, monkeypatch):
    def raise_not_found(*args, **kwargs):
        raise NotFoundError("Missing")

    monkeypatch.setattr(
        "app.routers.device.update_device_status",
        raise_not_found,
    )

    response = client.patch(
        "/devices/missing/status",
        json={"status": DeviceStatus.ACTIVE.name},
        headers=admin_headers,
    )

    assert response.status_code == 404


# ---------------------------------------------------------
# UPDATE STATUS - ValidationError -> 400
# ---------------------------------------------------------

def test_update_status_validation_error(client, admin_headers, monkeypatch):
    def raise_validation(*args, **kwargs):
        raise ValidationError("Invalid transition")

    monkeypatch.setattr(
        "app.routers.device.update_device_status",
        raise_validation,
    )

    response = client.patch(
        "/devices/device1/status",
        json={"status": DeviceStatus.ACTIVE.name},
        headers=admin_headers,
    )

    assert response.status_code == 400


# ---------------------------------------------------------
# UPDATE STATUS - ForbiddenError -> 403
# ---------------------------------------------------------

def test_update_status_forbidden(client, admin_headers, monkeypatch):
    def raise_forbidden(*args, **kwargs):
        raise ForbiddenError("Denied")

    monkeypatch.setattr(
        "app.routers.device.update_device_status",
        raise_forbidden,
    )

    response = client.patch(
        "/devices/device1/status",
        json={"status": DeviceStatus.ACTIVE.name},
        headers=admin_headers,
    )

    assert response.status_code == 403


# ---------------------------------------------------------
# ASSIGN - ValidationError -> 400
# ---------------------------------------------------------

def test_assign_device_validation_error(client, admin_headers, monkeypatch):
    def raise_validation(*args, **kwargs):
        raise ValidationError("Invalid assignment")

    monkeypatch.setattr(
        "app.routers.device.assign_device_to_tourist",
        raise_validation,
    )

    response = client.post(
        "/devices/device1/assign/1",
        headers=admin_headers,
    )

    assert response.status_code == 400


# ---------------------------------------------------------
# ASSIGN - NotFoundError -> 400
# ---------------------------------------------------------

def test_assign_device_not_found(client, admin_headers, monkeypatch):
    def raise_not_found(*args, **kwargs):
        raise NotFoundError("Missing")

    monkeypatch.setattr(
        "app.routers.device.assign_device_to_tourist",
        raise_not_found,
    )

    response = client.post(
        "/devices/device1/assign/1",
        headers=admin_headers,
    )

    assert response.status_code == 400


# ---------------------------------------------------------
# UNASSIGN - NotFoundError -> 404
# ---------------------------------------------------------

def test_unassign_device_not_found(client, admin_headers, monkeypatch):
    def raise_not_found(*args, **kwargs):
        raise NotFoundError("Missing")

    monkeypatch.setattr(
        "app.routers.device.unassign_device",
        raise_not_found,
    )

    response = client.post(
        "/devices/device1/unassign",
        headers=admin_headers,
    )

    assert response.status_code == 404


# ---------------------------------------------------------
# UNASSIGN - ValidationError -> 400
# ---------------------------------------------------------

def test_unassign_device_validation_error(client, admin_headers, monkeypatch):
    def raise_validation(*args, **kwargs):
        raise ValidationError("Invalid")

    monkeypatch.setattr(
        "app.routers.device.unassign_device",
        raise_validation,
    )

    response = client.post(
        "/devices/device1/unassign",
        headers=admin_headers,
    )

    assert response.status_code == 400