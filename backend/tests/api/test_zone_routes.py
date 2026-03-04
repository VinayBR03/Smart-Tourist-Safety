import pytest
from app.core.enums import UserRole
from app.core.exceptions import ValidationError, ConflictError
from app.routers.zone import (
    create_polygon_zone_endpoint,
    update_zone_endpoint,
)
from app.schemas.zone_schema import (
    ZoneCreatePolygonRequest,
    ZoneUpdateRequest,
)
from fastapi import HTTPException

# =========================================================
# CREATE ZONE (ADMIN ONLY)
# =========================================================

def test_admin_can_create_circular_zone(client, admin_headers):
    payload = {
        "name": "Test Zone",
        "zone_type": "SAFE",
        "center_latitude": 12.9716,
        "center_longitude": 77.5946,
        "radius_meters": 500,
    }

    response = client.post("/zones/circular", json=payload, headers=admin_headers)
    assert response.status_code == 201


def test_tourist_cannot_create_zone(client, auth_headers):
    payload = {
        "name": "Blocked Zone",
        "zone_type": "SAFE",
        "center_latitude": 12.9716,
        "center_longitude": 77.5946,
        "radius_meters": 500,
    }

    response = client.post("/zones/circular", json=payload, headers=auth_headers)
    assert response.status_code == 403


# =========================================================
# LIST ZONES
# =========================================================

def test_admin_can_list_zones(client, admin_headers):
    response = client.get("/zones", headers=admin_headers)
    assert response.status_code in (200, 204)


def test_authority_can_list_zones(client, authority_headers):
    response = client.get("/zones", headers=authority_headers)
    assert response.status_code in (200, 204)


def test_tourist_cannot_list_zones(client, auth_headers):
    response = client.get("/zones", headers=auth_headers)
    assert response.status_code == 403


# =========================================================
# FETCH ZONE
# =========================================================

def test_fetch_zone_not_found(client, admin_headers):
    response = client.get("/zones/99999", headers=admin_headers)
    assert response.status_code == 404


# =========================================================
# UPDATE ZONE
# =========================================================

def test_admin_can_update_zone(client, admin_headers):
    create_payload = {
        "name": "Update Zone",
        "zone_type": "SAFE",
        "center_latitude": 12.9716,
        "center_longitude": 77.5946,
        "radius_meters": 500,
    }

    create_res = client.post("/zones/circular", json=create_payload, headers=admin_headers)
    zone_id = create_res.json()["id"]

    update_payload = {"name": "Updated Zone"}

    response = client.patch(f"/zones/{zone_id}", json=update_payload, headers=admin_headers)
    assert response.status_code == 200


def test_tourist_cannot_update_zone(client, auth_headers):
    response = client.patch("/zones/1", json={"name": "X"}, headers=auth_headers)
    assert response.status_code == 403


# =========================================================
# STATUS & HISTORY
# =========================================================

def test_get_zone_status_not_found(client, admin_headers):
    response = client.get("/zones/99999/status", headers=admin_headers)
    assert response.status_code == 404


def test_get_zone_risk_history(client, admin_headers):
    response = client.get("/zones/99999/risk-history", headers=admin_headers)
    assert response.status_code in (200, 404)


# =========================================================
# CREATE CIRCULAR - ERROR BRANCHES
# =========================================================

def test_create_circular_validation_error(client, admin_headers, monkeypatch):
    monkeypatch.setattr(
        "app.routers.zone.create_circular_zone",
        lambda **kwargs: (_ for _ in ()).throw(ValidationError("Invalid data")),
    )

    payload = {
        "name": "Bad Zone",
        "zone_type": "SAFE",
        "center_latitude": 12.9,
        "center_longitude": 77.5,
        "radius_meters": 100,
    }

    response = client.post("/zones/circular", json=payload, headers=admin_headers)
    assert response.status_code == 400


def test_create_circular_conflict_error(client, admin_headers, monkeypatch):
    monkeypatch.setattr(
        "app.routers.zone.create_circular_zone",
        lambda **kwargs: (_ for _ in ()).throw(ConflictError("Duplicate")),
    )

    payload = {
        "name": "Duplicate Zone",
        "zone_type": "SAFE",
        "center_latitude": 12.9,
        "center_longitude": 77.5,
        "radius_meters": 100,
    }

    response = client.post("/zones/circular", json=payload, headers=admin_headers)
    assert response.status_code == 409


# =========================================================
# CREATE POLYGON - ERROR BRANCHES (Direct Call)
# =========================================================

def test_create_polygon_validation_error_direct(db_session, monkeypatch):
    def raise_validation(*args, **kwargs):
        raise ValidationError("Invalid polygon")

    monkeypatch.setattr(
        "app.routers.zone.create_polygon_zone",
        raise_validation,
    )

    payload = ZoneCreatePolygonRequest(
        name="Test",
        zone_type="SAFE",
        coordinates=[(77.0,12.0),
                     (78.0,12.0),
                     (78.0,13.0),
                     (77.0,12.0)],
    )

    with pytest.raises(HTTPException) as exc:
        create_polygon_zone_endpoint(
            payload=payload,
            db=db_session,
            _=None,
        )

    assert exc.value.status_code == 400


def test_create_polygon_conflict_error_direct(db_session, monkeypatch):
    def raise_conflict(*args, **kwargs):
        raise ConflictError("Conflict")

    monkeypatch.setattr(
        "app.routers.zone.create_polygon_zone",
        raise_conflict,
    )

    payload = ZoneCreatePolygonRequest(
        name="Test",
        zone_type="SAFE",
        coordinates=[(77.0,12.0),
                     (78.0,12.0),
                     (78.0,13.0),
                     (77.0,12.0)],
    )

    with pytest.raises(HTTPException) as exc:
        create_polygon_zone_endpoint(
            payload=payload,
            db=db_session,
            _=None,
        )

    assert exc.value.status_code == 409


# =========================================================
# UPDATE - ERROR BRANCHES (Direct Call)
# =========================================================

def test_update_zone_validation_error_direct(db_session, monkeypatch):
    def raise_validation(*args, **kwargs):
        raise ValidationError("Bad update")

    monkeypatch.setattr("app.routers.zone.update_zone", raise_validation)

    payload = ZoneUpdateRequest(name="New Name")

    with pytest.raises(HTTPException) as exc:
        update_zone_endpoint(
            zone_id=1,
            payload=payload,
            db=db_session,
            _=None,
        )

    assert exc.value.status_code == 400


def test_update_zone_conflict_error_direct(db_session, monkeypatch):
    def raise_conflict(*args, **kwargs):
        raise ConflictError("Conflict")

    monkeypatch.setattr("app.routers.zone.update_zone", raise_conflict)

    payload = ZoneUpdateRequest(name="New Name")

    with pytest.raises(HTTPException) as exc:
        update_zone_endpoint(
            zone_id=1,
            payload=payload,
            db=db_session,
            _=None,
        )

    assert exc.value.status_code == 409