import pytest
from app.core.enums import UserRole


# =========================================================
# TOURIST: UPDATE OWN LOCATION
# =========================================================


def test_tourist_can_update_location(client, auth_headers):
    payload = {
        "latitude": 12.9716,
        "longitude": 77.5946,
        "accuracy_meters": 5,
        "battery_percentage": 80,
    }

    response = client.post(
        "/locations/me",
        json=payload,
        headers=auth_headers,
    )

    assert response.status_code == 200
    data = response.json()

    assert data["latitude"] == round(payload["latitude"], 7)
    assert data["longitude"] == round(payload["longitude"], 7)
    assert data["battery_percentage"] == 80


def test_tourist_update_invalid_latitude(client, auth_headers):
    payload = {
        "latitude": 200,  # invalid
        "longitude": 77.5,
    }

    response = client.post(
        "/locations/me",
        json=payload,
        headers=auth_headers,
    )

    assert response.status_code == 422


def test_tourist_update_unrealistic_movement(
    client, auth_headers
):
    # First valid update
    client.post(
        "/locations/me",
        json={"latitude": 12.0, "longitude": 77.0},
        headers=auth_headers,
    )

    # Immediate teleport far away
    response = client.post(
        "/locations/me",
        json={"latitude": -80.0, "longitude": -170.0},
        headers=auth_headers,
    )

    # Should fail due to speed guard
    assert response.status_code == 400


# =========================================================
# TOURIST: GET OWN LOCATION
# =========================================================


def test_tourist_can_get_latest_location(client, auth_headers):
    client.post(
        "/locations/me",
        json={"latitude": 10.0, "longitude": 20.0},
        headers=auth_headers,
    )

    response = client.get(
        "/locations/me",
        headers=auth_headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["latitude"] == 10.0
    assert data["longitude"] == 20.0


def test_tourist_get_location_not_found(client, auth_headers):
    response = client.get(
        "/locations/me",
        headers=auth_headers,
    )

    assert response.status_code == 404


# =========================================================
# AUTHORITY: LIVE LOCATIONS
# =========================================================


def test_authority_can_fetch_live_locations(
    client, authority_headers, auth_headers
):
    # Create one tourist location
    client.post(
        "/locations/me",
        json={"latitude": 12.1, "longitude": 77.1},
        headers=auth_headers,
    )

    response = client.get(
        "/locations/live",
        headers=authority_headers,
    )

    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_tourist_cannot_fetch_live_locations(
    client, auth_headers
):
    response = client.get(
        "/locations/live",
        headers=auth_headers,
    )

    assert response.status_code == 403


# =========================================================
# AUTHORITY: ZONE PRESENCE
# =========================================================


def test_authority_can_fetch_zone_presence(
    client, authority_headers
):
    response = client.get(
        "/locations/zone-presence",
        headers=authority_headers,
    )

    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_tourist_cannot_fetch_zone_presence(
    client, auth_headers
):
    response = client.get(
        "/locations/zone-presence",
        headers=auth_headers,
    )

    assert response.status_code == 403