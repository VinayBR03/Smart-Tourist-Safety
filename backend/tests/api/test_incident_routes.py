import pytest
from app.core.enums import IncidentStatus, IncidentSource
from unittest.mock import patch

@pytest.fixture(autouse=True)
def mock_notifications():
    with patch("app.services.incident_service.create_notification") as mock:
        mock.return_value = None
        yield

# =========================================================
# CREATE INCIDENT (Tourist)
# =========================================================


def test_tourist_can_create_incident(client, auth_headers):
    payload = {
        "description": "Medical emergency happened",
        "latitude": 12.9716,
        "longitude": 77.5946,
        "source": IncidentSource.MOBILE.name,
        "is_auto_generated": False,
    }

    response = client.post(
        "/incidents",
        json=payload,
        headers=auth_headers,
    )

    assert response.status_code == 201
    data = response.json()
    assert data["status"] == IncidentStatus.OPEN.name
    assert data["description"] == payload["description"]


def test_duplicate_active_incident_blocked(client, auth_headers):
    payload = {
        "description": "Emergency 1",
        "latitude": 10.0,
        "longitude": 20.0,
        "source": IncidentSource.MOBILE.name,
        "is_auto_generated": False,
    }

    client.post("/incidents", json=payload, headers=auth_headers)

    response = client.post(
        "/incidents",
        json=payload,
        headers=auth_headers,
    )

    assert response.status_code == 409


def test_invalid_incident_payload(client, auth_headers):
    payload = {
        "description": "abc",  # too short
        "source": IncidentSource.MOBILE.name,
    }

    response = client.post(
        "/incidents",
        json=payload,
        headers=auth_headers,
    )

    assert response.status_code == 422


# =========================================================
# LIST INCIDENTS (Admin / Authority)
# =========================================================


def test_authority_can_list_incidents(client, authority_headers):
    response = client.get(
        "/incidents",
        headers=authority_headers,
    )

    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_tourist_cannot_list_incidents(client, auth_headers):
    response = client.get(
        "/incidents",
        headers=auth_headers,
    )

    assert response.status_code == 403


# =========================================================
# GET INCIDENT BY ID
# =========================================================


def test_tourist_can_view_own_incident(client, auth_headers):
    create_res = client.post(
        "/incidents",
        json={
            "description": "Road accident occurred",
            "latitude": 12.0,
            "longitude": 77.0,
            "source": IncidentSource.MOBILE.name,
        },
        headers=auth_headers,
    )

    incident_id = create_res.json()["id"]

    response = client.get(
        f"/incidents/{incident_id}",
        headers=auth_headers,
    )

    assert response.status_code == 200


def test_tourist_cannot_view_others_incident(
    client, auth_headers, create_user
):
    # Create second tourist
    other_user = create_user(email="other@test.com")

    # Create incident with first tourist
    create_res = client.post(
        "/incidents",
        json={
            "description": "Test incident",
            "latitude": 1.0,
            "longitude": 1.0,
            "source": IncidentSource.MOBILE.name,
        },
        headers=auth_headers,
    )

    incident_id = create_res.json()["id"]

    # Login as second user
    from app.core.security import create_access_token

    token = create_access_token(
        user_id=other_user.id,
        role=other_user.role.value,
        token_version=other_user.token_version,
    )

    headers = {"Authorization": f"Bearer {token}"}

    response = client.get(
        f"/incidents/{incident_id}",
        headers=headers,
    )

    assert response.status_code == 403


# =========================================================
# UPDATE STATUS
# =========================================================


def test_authority_can_update_incident_status(
    client, auth_headers, authority_headers
):
    create_res = client.post(
        "/incidents",
        json={
            "description": "Fire reported",
            "latitude": 5.0,
            "longitude": 5.0,
            "source": IncidentSource.MOBILE.name,
        },
        headers=auth_headers,
    )

    incident_id = create_res.json()["id"]

    response = client.patch(
        f"/incidents/{incident_id}/status",
        json={"status": IncidentStatus.IN_PROGRESS.name},
        headers=authority_headers,
    )

    assert response.status_code == 200
    assert response.json()["status"] == IncidentStatus.IN_PROGRESS.name


def test_invalid_status_transition(
    client, auth_headers, authority_headers
):
    create_res = client.post(
        "/incidents",
        json={
            "description": "Test invalid transition",
            "latitude": 6.0,
            "longitude": 6.0,
            "source": IncidentSource.MOBILE.name,
        },
        headers=auth_headers,
    )

    incident_id = create_res.json()["id"]

    # Cannot jump directly to CLOSED
    response = client.patch(
        f"/incidents/{incident_id}/status",
        json={"status": IncidentStatus.CLOSED.name},
        headers=authority_headers,
    )

    assert response.status_code in (400, 422)


# =========================================================
# RESOLVE INCIDENT
# =========================================================


def test_authority_can_resolve_incident(
    client, auth_headers, authority_headers
):
    create_res = client.post(
        "/incidents",
        json={
            "description": "Flood alert",
            "latitude": 3.0,
            "longitude": 3.0,
            "source": IncidentSource.MOBILE.name,
        },
        headers=auth_headers,
    )

    incident_id = create_res.json()["id"]

    # First move to IN_PROGRESS
    client.patch(
        f"/incidents/{incident_id}/status",
        json={"status": IncidentStatus.IN_PROGRESS.name},
        headers=authority_headers,
    )

    response = client.post(
        f"/incidents/{incident_id}/resolve",
        json={"resolution_note": "Issue handled"},
        headers=authority_headers,
    )

    assert response.status_code == 200
    assert response.json()["status"] == IncidentStatus.RESOLVED.name


# =========================================================
# TIMELINE
# =========================================================


def test_tourist_can_view_own_timeline(
    client, auth_headers, authority_headers
):
    create_res = client.post(
        "/incidents",
        json={
            "description": "Timeline test",
            "latitude": 8.0,
            "longitude": 8.0,
            "source": IncidentSource.MOBILE.name,
        },
        headers=auth_headers,
    )

    incident_id = create_res.json()["id"]

    # Authority updates status
    client.patch(
        f"/incidents/{incident_id}/status",
        json={"status": IncidentStatus.IN_PROGRESS.name},
        headers=authority_headers,
    )

    response = client.get(
        f"/incidents/{incident_id}/timeline",
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_create_incident_validation_error(client, auth_headers, monkeypatch):
    def raise_validation(*args, **kwargs):
        from app.core.exceptions import ValidationError
        raise ValidationError("Invalid")

    monkeypatch.setattr(
        "app.routers.incident.create_incident",
        raise_validation,
    )

    payload = {
        "description": "Valid description",
        "latitude": 10.0,
        "longitude": 10.0,
        "source": IncidentSource.MOBILE.name,
    }

    response = client.post("/incidents", json=payload, headers=auth_headers)

    assert response.status_code == 400

def test_create_incident_conflict_error(client, auth_headers, monkeypatch):
    def raise_conflict(*args, **kwargs):
        from app.core.exceptions import ConflictError
        raise ConflictError("Duplicate")

    monkeypatch.setattr(
        "app.routers.incident.create_incident",
        raise_conflict,
    )

    payload = {
        "description": "Valid description",
        "latitude": 10.0,
        "longitude": 10.0,
        "source": IncidentSource.MOBILE.name,
    }

    response = client.post("/incidents", json=payload, headers=auth_headers)

    assert response.status_code == 409

def test_fetch_incident_not_found(client, auth_headers, monkeypatch):
    def raise_not_found(*args, **kwargs):
        from app.core.exceptions import NotFoundError
        raise NotFoundError("Missing")

    monkeypatch.setattr(
        "app.routers.incident.get_incident_by_id",
        raise_not_found,
    )

    response = client.get("/incidents/999", headers=auth_headers)

    assert response.status_code == 404

def test_fetch_incident_not_found(client, auth_headers, monkeypatch):
    def raise_not_found(*args, **kwargs):
        from app.core.exceptions import NotFoundError
        raise NotFoundError("Missing")

    monkeypatch.setattr(
        "app.routers.incident.get_incident_by_id",
        raise_not_found,
    )

    response = client.get("/incidents/999", headers=auth_headers)

    assert response.status_code == 404

def test_update_status_not_found(client, authority_headers, monkeypatch):
    def raise_not_found(*args, **kwargs):
        from app.core.exceptions import NotFoundError
        raise NotFoundError("Missing")

    monkeypatch.setattr(
        "app.routers.incident.update_incident_status",
        raise_not_found,
    )

    response = client.patch(
        "/incidents/1/status",
        json={"status": IncidentStatus.IN_PROGRESS.name},
        headers=authority_headers,
    )

    assert response.status_code == 404

def test_update_status_conflict(client, authority_headers, monkeypatch):
    def raise_conflict(*args, **kwargs):
        from app.core.exceptions import ConflictError
        raise ConflictError("Conflict")

    monkeypatch.setattr(
        "app.routers.incident.update_incident_status",
        raise_conflict,
    )

    response = client.patch(
        "/incidents/1/status",
        json={"status": IncidentStatus.IN_PROGRESS.name},
        headers=authority_headers,
    )

    assert response.status_code == 409

def test_resolve_not_found(client, authority_headers, monkeypatch):
    def raise_not_found(*args, **kwargs):
        from app.core.exceptions import NotFoundError
        raise NotFoundError("Missing")

    monkeypatch.setattr(
        "app.routers.incident.resolve_incident",
        raise_not_found,
    )

    response = client.post(
        "/incidents/1/resolve",
        json={"resolution_note": "Done"},
        headers=authority_headers,
    )

    assert response.status_code == 404

def test_resolve_conflict(client, authority_headers, monkeypatch):
    def raise_conflict(*args, **kwargs):
        from app.core.exceptions import ConflictError
        raise ConflictError("Conflict")

    monkeypatch.setattr(
        "app.routers.incident.resolve_incident",
        raise_conflict,
    )

    response = client.post(
        "/incidents/1/resolve",
        json={"resolution_note": "Done"},
        headers=authority_headers,
    )

    assert response.status_code == 409

def test_timeline_not_found(client, auth_headers, monkeypatch):
    def raise_not_found(*args, **kwargs):
        from app.core.exceptions import NotFoundError
        raise NotFoundError("Missing")

    monkeypatch.setattr(
        "app.routers.incident.get_incident_by_id",
        raise_not_found,
    )

    response = client.get("/incidents/1/timeline", headers=auth_headers)

    assert response.status_code == 404