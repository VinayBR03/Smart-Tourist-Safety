import pytest
from datetime import datetime, timezone, timedelta

from app.services.incident_service import (
    create_incident,
    escalate_incident_if_breached,
    resolve_incident,
    auto_close_incident,
    update_incident_status,
)

from app.services.auth_service import register_user

from app.models.incident import Incident
from app.models.incident_status_history import IncidentStatusHistory

from app.core.enums import (
    IncidentStatus,
    IncidentSource,
    UserRole,
)

from app.core.exceptions import ValidationError, ConflictError


# =========================================================
# GLOBAL MOCKS FOR SIDE EFFECT SERVICES
# =========================================================

@pytest.fixture(autouse=True)
def mock_side_effect_services(mocker):
    mocker.patch("app.services.incident_service.create_notification")
    mocker.patch("app.services.incident_service.create_outbox_event")
    mocker.patch("app.services.incident_service.create_audit_log")


# =========================================================
# VALID USER FIXTURE (REAL SERVICE)
# =========================================================

@pytest.fixture
def test_user(db_session):
    user = register_user(
        db=db_session,
        email="incident_test@example.com",
        password="StrongPass123!",
        role=UserRole.TOURIST,
    )
    db_session.commit()
    return user


# =========================================================
# CREATE INCIDENT
# =========================================================

def test_create_incident_success(db_session, test_user):

    incident = create_incident(
        db=db_session,
        tourist_id=test_user.id,
        description="Test incident",
        source=IncidentSource.MOBILE,
        latitude=12.9,
        longitude=77.5,
    )

    db_session.commit()

    saved = db_session.get(Incident, incident.id)

    assert saved is not None
    assert saved.status == IncidentStatus.OPEN.value
    assert saved.source == IncidentSource.MOBILE.value
    assert saved.created_at is not None


def test_create_incident_duplicate_active_blocked(db_session, test_user):

    create_incident(
        db=db_session,
        tourist_id=test_user.id,
        description="First incident",
        source=IncidentSource.MOBILE,
        latitude=12.9,
        longitude=77.5,
    )
    db_session.commit()

    with pytest.raises(ConflictError):
        create_incident(
            db=db_session,
            tourist_id=test_user.id,
            description="Second incident",
            source=IncidentSource.MOBILE,
            latitude=12.9,
            longitude=77.5,
        )


# =========================================================
# STATUS TRANSITION
# =========================================================

def test_update_status_valid_transition(db_session, test_user):

    incident = create_incident(
        db=db_session,
        tourist_id=test_user.id,
        description="Transition test",
        source=IncidentSource.MOBILE,
        latitude=12.9,
        longitude=77.5,
    )
    db_session.commit()

    update_incident_status(
        db=db_session,
        incident_id=incident.id,
        new_status=IncidentStatus.IN_PROGRESS,
        performed_by=test_user.id,
    )
    db_session.commit()

    updated = db_session.get(Incident, incident.id)

    assert updated.status == IncidentStatus.IN_PROGRESS.value


def test_invalid_status_transition_blocked(db_session, test_user):

    incident = create_incident(
        db=db_session,
        tourist_id=test_user.id,
        description="Invalid transition test",
        source=IncidentSource.MOBILE,
        latitude=12.9,
        longitude=77.5,
    )
    db_session.commit()

    with pytest.raises(ValidationError):
        update_incident_status(
            db=db_session,
            incident_id=incident.id,
            new_status=IncidentStatus.CLOSED,
            performed_by=test_user.id,
        )


# =========================================================
# RESOLVE INCIDENT
# =========================================================

def test_resolve_incident_success(db_session, test_user):

    incident = create_incident(
        db=db_session,
        tourist_id=test_user.id,
        description="Resolve test",
        source=IncidentSource.MOBILE,
        latitude=12.9,
        longitude=77.5,
    )
    db_session.commit()

    resolve_incident(
        db=db_session,
        incident_id=incident.id,
        resolution_note="Issue fixed",
        performed_by=test_user.id,
    )
    db_session.commit()

    updated = db_session.get(Incident, incident.id)

    assert updated.status == IncidentStatus.RESOLVED.value
    assert updated.resolved_at is not None
    assert "Resolution:" in updated.description


# =========================================================
# AUTO CLOSE INCIDENT
# =========================================================

def test_auto_close_incident(db_session, test_user):

    incident = create_incident(
        db=db_session,
        tourist_id=test_user.id,
        description="Auto close test",
        source=IncidentSource.MOBILE,
        latitude=12.9,
        longitude=77.5,
    )
    db_session.commit()

    resolve_incident(
        db=db_session,
        incident_id=incident.id,
        resolution_note=None,
        performed_by=test_user.id,
    )
    db_session.commit()

    incident.resolved_at = datetime.now(timezone.utc) - timedelta(days=10)
    db_session.commit()

    auto_close_incident(db_session, incident)
    db_session.commit()

    updated = db_session.get(Incident, incident.id)

    assert updated.status == IncidentStatus.CLOSED.value


# =========================================================
# ESCALATE INCIDENT
# =========================================================

def test_escalate_incident_breached(db_session, test_user):

    incident = create_incident(
        db=db_session,
        tourist_id=test_user.id,
        description="Escalation test",
        source=IncidentSource.MOBILE,
        latitude=12.9,
        longitude=77.5,
    )
    db_session.commit()

    incident.created_at = datetime.now(timezone.utc) - timedelta(hours=2)
    db_session.commit()

    escalate_incident_if_breached(db_session, incident)
    db_session.commit()

    updated = db_session.get(Incident, incident.id)

    assert updated.status == IncidentStatus.IN_PROGRESS.value


# =========================================================
# STATUS HISTORY CREATED
# =========================================================

def test_status_history_created(db_session, test_user):

    incident = create_incident(
        db=db_session,
        tourist_id=test_user.id,
        description="History test",
        source=IncidentSource.MOBILE,
        latitude=12.9,
        longitude=77.5,
    )
    db_session.commit()

    update_incident_status(
        db=db_session,
        incident_id=incident.id,
        new_status=IncidentStatus.IN_PROGRESS,
        performed_by=test_user.id,
    )
    db_session.commit()

    history = (
        db_session.query(IncidentStatusHistory)
        .filter_by(incident_id=incident.id)
        .all()
    )

    assert len(history) >= 2