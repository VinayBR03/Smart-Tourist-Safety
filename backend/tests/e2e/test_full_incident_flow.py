import pytest

from app.core.enums import IncidentStatus
from app.models.incident import Incident


@pytest.mark.e2e
def test_full_incident_flow(client, auth_headers, authority_headers, db_session):
    """
    Full end-to-end incident lifecycle:

    Tourist:
        - Create incident

    Authority:
        - Move to IN_PROGRESS
        - Resolve incident

    Validate final DB state.
    """

    # ---------------------------------------------------------
    # 1. Tourist creates incident
    # ---------------------------------------------------------
    create_payload = {
        "description": "Heart rate abnormal",
        "source": "MOBILE",
        "latitude": 12.9716,
        "longitude": 77.5946,
    }

    response = client.post(
        "/incidents",
        json=create_payload,
        headers=auth_headers,
    )

    assert response.status_code == 201

    incident_id = response.json()["id"]

    # ---------------------------------------------------------
    # 2. Move to IN_PROGRESS (Authority)
    # ---------------------------------------------------------
    response = client.patch(
        f"/incidents/{incident_id}/status",
        json={"status": "IN_PROGRESS"},
        headers=authority_headers,
    )

    assert response.status_code == 200

    # ---------------------------------------------------------
    # 3. Resolve incident (Authority)
    # ---------------------------------------------------------
    response = client.post(
        f"/incidents/{incident_id}/resolve",
        json={"resolution_note": "Handled successfully"},
        headers=authority_headers,
    )

    assert response.status_code == 200

    # ---------------------------------------------------------
    # 4. Validate final DB state
    # ---------------------------------------------------------
    db = db_session

    incident = db.get(Incident, incident_id)

    assert incident is not None
    assert incident.status == IncidentStatus.RESOLVED