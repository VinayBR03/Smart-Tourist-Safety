import pytest
from datetime import datetime, timedelta, timezone

from app.services.incident_service import (
    create_incident,
    update_incident_status,
    resolve_incident,
    escalate_incident_if_breached,
    auto_close_incident,
)

from app.services.auth_service import register_user

from app.models.incident import Incident
from app.models.incident_status_history import IncidentStatusHistory

from app.core.enums import IncidentStatus, IncidentSource, UserRole
from app.core.exceptions import ValidationError


# =========================================================
# GLOBAL SIDE-EFFECT MOCKS
# =========================================================

@pytest.fixture(autouse=True)
def mock_side_effects(mocker):
    mocker.patch("app.services.incident_service.create_notification")
    mocker.patch("app.services.incident_service.create_outbox_event")
    mocker.patch("app.services.incident_service.create_audit_log")


# =========================================================
# USER FIXTURE
# =========================================================

@pytest.fixture
def test_user(db_session):
    user = register_user(
        db=db_session,
        email="sm_test@example.com",
        password="StrongPass123!",
        role=UserRole.TOURIST,
    )
    db_session.commit()
    return user


# =========================================================
# VALID TRANSITIONS
# =========================================================

def test_valid_state_transitions(db_session, test_user):

    incident = create_incident(
        db=db_session,
        tourist_id=test_user.id,
        description="State machine test",
        source=IncidentSource.MOBILE,
        latitude=12.9,
        longitude=77.5,
    )
    db_session.commit()

    # OPEN → IN_PROGRESS
    update_incident_status(
        db=db_session,
        incident_id=incident.id,
        new_status=IncidentStatus.IN_PROGRESS,
        performed_by=test_user.id,
    )

    # IN_PROGRESS → RESOLVED
    resolve_incident(
        db=db_session,
        incident_id=incident.id,
        resolution_note="Fixed",
        performed_by=test_user.id,
    )

    # RESOLVED → CLOSED
    update_incident_status(
        db=db_session,
        incident_id=incident.id,
        new_status=IncidentStatus.CLOSED,
        performed_by=test_user.id,
    )

    db_session.commit()

    updated = db_session.get(Incident, incident.id)

    assert updated.status == IncidentStatus.CLOSED.value
    assert updated.resolved_at is not None


# =========================================================
# INVALID TRANSITIONS
# =========================================================

def test_invalid_transition_open_to_closed(db_session, test_user):

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


def test_invalid_transition_resolved_to_open(db_session, test_user):

    incident = create_incident(
        db=db_session,
        tourist_id=test_user.id,
        description="Reopen test",
        source=IncidentSource.MOBILE,
        latitude=12.9,
        longitude=77.5,
    )

    resolve_incident(
        db=db_session,
        incident_id=incident.id,
        resolution_note="Done",
        performed_by=test_user.id,
    )
    db_session.commit()

    with pytest.raises(ValidationError):
        update_incident_status(
            db=db_session,
            incident_id=incident.id,
            new_status=IncidentStatus.OPEN,
            performed_by=test_user.id,
        )


# =========================================================
# HISTORY INTEGRITY
# =========================================================

def test_history_created_for_each_transition(db_session, test_user):

    incident = create_incident(
        db=db_session,
        tourist_id=test_user.id,
        description="History validation",
        source=IncidentSource.MOBILE,
        latitude=12.9,
        longitude=77.5,
    )

    update_incident_status(
        db=db_session,
        incident_id=incident.id,
        new_status=IncidentStatus.IN_PROGRESS,
        performed_by=test_user.id,
    )

    resolve_incident(
        db=db_session,
        incident_id=incident.id,
        resolution_note="Resolved",
        performed_by=test_user.id,
    )

    db_session.commit()

    history = (
        db_session.query(IncidentStatusHistory)
        .filter_by(incident_id=incident.id)
        .all()
    )

    assert len(history) == 3  # INITIAL + IN_PROGRESS + RESOLVED

    for entry in history:
        if entry.old_status is not None:
            assert entry.old_status != entry.new_status


# =========================================================
# SLA ESCALATION
# =========================================================

def test_sla_escalation(db_session, test_user):

    incident = create_incident(
        db=db_session,
        tourist_id=test_user.id,
        description="SLA escalation",
        source=IncidentSource.MOBILE,
        latitude=12.9,
        longitude=77.5,
    )

    # simulate breach
    incident.created_at = datetime.now(timezone.utc) - timedelta(hours=2)

    db_session.commit()

    escalate_incident_if_breached(db_session, incident)
    db_session.commit()

    updated = db_session.get(Incident, incident.id)

    assert updated.status == IncidentStatus.IN_PROGRESS.value


# =========================================================
# AUTO CLOSE
# =========================================================

def test_auto_close(db_session, test_user):

    incident = create_incident(
        db=db_session,
        tourist_id=test_user.id,
        description="Auto close test",
        source=IncidentSource.MOBILE,
        latitude=12.9,
        longitude=77.5,
    )

    resolve_incident(
        db=db_session,
        incident_id=incident.id,
        resolution_note="Done",
        performed_by=test_user.id,
    )

    incident.resolved_at = datetime.now(timezone.utc) - timedelta(days=10)

    db_session.commit()

    auto_close_incident(db_session, incident)
    db_session.commit()

    updated = db_session.get(Incident, incident.id)

    assert updated.status == IncidentStatus.CLOSED.value