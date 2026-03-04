import pytest

from app.core.enums import DeviceStatus, UserRole
from app.models.iot_device import IoTDevice
from app.models.device_assignment import DeviceAssignment
from app.models.user import User


@pytest.mark.e2e
def test_device_assignment_flow(client, admin_headers, auth_headers, db_session):
    """
    End-to-end device lifecycle.
    """

    # ---------------------------------------------------------
    # 1. Admin creates device
    # ---------------------------------------------------------
    create_payload = {
        "device_id": "WRISTBAND-001",
        "device_type": "WRISTBAND",
    }

    response = client.post(
        "/devices",
        json=create_payload,
        headers=admin_headers,
    )
    assert response.status_code == 201

    device_id = response.json()["device_id"]

    # ---------------------------------------------------------
    # 2. Assign device to tourist
    # ---------------------------------------------------------
    tourist_user = db_session.query(User).filter(
        User.role == UserRole.TOURIST
    ).first()

    assert tourist_user is not None

    response = client.post(
        f"/devices/{device_id}/assign/{tourist_user.id}",
        headers=admin_headers,
    )
    assert response.status_code == 204

    # ---------------------------------------------------------
    # 3. Update device status
    # ---------------------------------------------------------
    response = client.patch(
        f"/devices/{device_id}/status",
        json={"status": "ACTIVE"},
        headers=admin_headers,
    )
    assert response.status_code == 200

    # ---------------------------------------------------------
    # 4. Unassign device
    # ---------------------------------------------------------
    response = client.post(
        f"/devices/{device_id}/unassign",
        headers=admin_headers,
    )
    assert response.status_code == 204

    # ---------------------------------------------------------
    # 5. Validate using SAME session (no new SessionLocal)
    # ---------------------------------------------------------
    db_session.commit()
    db_session.expire_all()

    device = db_session.query(IoTDevice).filter(
        IoTDevice.device_id == device_id
    ).first()

    assert device is not None
    assert device.status == DeviceStatus.ACTIVE

    # No active assignment should exist
    assignment = db_session.query(DeviceAssignment).filter(
        DeviceAssignment.device_id == device_id,
        DeviceAssignment.unassigned_at.is_(None),
    ).first()

    assert assignment is None