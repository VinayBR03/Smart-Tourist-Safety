from datetime import datetime, timezone
from typing import Optional, List

from sqlalchemy.orm import Session
from sqlalchemy import select

from app.models.incident import Incident
from app.models.incident_assignment import IncidentAssignment
from app.models.user import User

from app.core.enums import (
    AuditAction,
    EntityType,
    UserRole,
    IncidentStatus,
)

from app.core.exceptions import (
    NotFoundError,
    ValidationError,
    ConflictError,
)

from app.services.audit_service import create_audit_log
from app.services.outbox_service import create_outbox_event
from app.services.blockchain_service import log_assignment
from app.utils.logger import get_logger


logger = get_logger(__name__)


# =========================================================
# Helpers
# =========================================================

def _validate_id(value: int, field: str):
    if not isinstance(value, int) or value <= 0:
        raise ValidationError(f"Invalid {field}")


def _get_incident_locked(db: Session, incident_id: int) -> Incident:

    stmt = (
        select(Incident)
        .where(Incident.id == incident_id)
        .with_for_update()
    )

    incident = db.execute(stmt).scalar_one_or_none()

    if not incident:
        raise NotFoundError("Incident")

    if incident.status in (
        IncidentStatus.RESOLVED.value,
        IncidentStatus.CLOSED.value,
    ):
        raise ValidationError("Cannot assign resolved or closed incident")

    return incident


def _get_authority_locked(db: Session, authority_id: int) -> User:

    stmt = (
        select(User)
        .where(
            User.id == authority_id,
            User.role == UserRole.AUTHORITY.value,
            User.deleted_at.is_(None),
            User.is_active.is_(True),
        )
        .with_for_update()
    )

    authority = db.execute(stmt).scalar_one_or_none()

    if not authority:
        raise NotFoundError("Authority")

    return authority


def _get_active_assignment_locked(
    db: Session,
    incident_id: int,
) -> Optional[IncidentAssignment]:

    stmt = (
        select(IncidentAssignment)
        .where(
            IncidentAssignment.incident_id == incident_id,
            IncidentAssignment.unassigned_at.is_(None),
        )
        .with_for_update()
    )

    return db.execute(stmt).scalar_one_or_none()


# =========================================================
# Assign Incident
# =========================================================

def assign_incident(
    db: Session,
    *,
    incident_id: int,
    authority_id: int,
    performed_by: Optional[int] = None,
) -> IncidentAssignment:

    _validate_id(incident_id, "incident_id")
    _validate_id(authority_id, "authority_id")

    incident = _get_incident_locked(db, incident_id)
    _get_authority_locked(db, authority_id)

    existing = _get_active_assignment_locked(db, incident_id)
    if existing:
        raise ConflictError("Incident already assigned")

    assignment = IncidentAssignment(
        incident_id=incident_id,
        authority_id=authority_id,
    )

    db.add(assignment)
    db.flush()

    if incident.status == IncidentStatus.OPEN.value:
        incident.status = IncidentStatus.IN_PROGRESS.value

    create_audit_log(
        db=db,
        user_id=performed_by,
        action=AuditAction.ASSIGN_INCIDENT,
        entity_type=EntityType.ASSIGNMENT,
        entity_id=assignment.id,
        new_value={
            "incident_id": incident_id,
            "authority_id": authority_id,
        },
    )

    create_outbox_event(
        db=db,
        topic="incident.assigned",
        payload={
            "incident_id": incident_id,
            "authority_id": authority_id,
        },
    )

    logger.info("Incident assigned", extra={"incident_id": incident_id})

    tx = log_assignment(incident_id, authority_id, performed_by or 0, "ASSIGN")
    assignment.blockchain_tx_hash = tx

    return assignment


# =========================================================
# Reassign Incident
# =========================================================

def reassign_incident(
    db: Session,
    *,
    incident_id: int,
    new_authority_id: int,
    performed_by: Optional[int] = None,
) -> IncidentAssignment:

    _validate_id(incident_id, "incident_id")
    _validate_id(new_authority_id, "authority_id")

    _get_incident_locked(db, incident_id)
    _get_authority_locked(db, new_authority_id)

    current = _get_active_assignment_locked(db, incident_id)

    if not current:
        raise ValidationError("Incident not currently assigned")

    if current.authority_id == new_authority_id:
        return current

    now = datetime.now(timezone.utc)
    old_authority_id = current.authority_id

    current.unassigned_at = now

    new_assignment = IncidentAssignment(
        incident_id=incident_id,
        authority_id=new_authority_id,
    )

    db.add(new_assignment)
    db.flush()

    create_audit_log(
        db=db,
        user_id=performed_by,
        action=AuditAction.REASSIGN_INCIDENT,
        entity_type=EntityType.ASSIGNMENT,
        entity_id=new_assignment.id,
        old_value={"authority_id": old_authority_id},
        new_value={"authority_id": new_authority_id},
    )

    create_outbox_event(
        db=db,
        topic="incident.reassigned",
        payload={
            "incident_id": incident_id,
            "old_authority_id": old_authority_id,
            "new_authority_id": new_authority_id,
        },
    )

    logger.info("Incident reassigned", extra={"incident_id": incident_id})
    
    tx = log_assignment(incident_id, new_authority_id, performed_by or 0, "REASSIGN")
    new_assignment.blockchain_tx_hash = tx

    return new_assignment


# =========================================================
# Unassign Incident
# =========================================================

def unassign_incident(
    db: Session,
    *,
    incident_id: int,
    performed_by: Optional[int] = None,
) -> None:

    _validate_id(incident_id, "incident_id")

    _get_incident_locked(db, incident_id)

    current = _get_active_assignment_locked(db, incident_id)

    if not current:
        return

    now = datetime.now(timezone.utc)
    authority_id = current.authority_id

    current.unassigned_at = now

    create_audit_log(
        db=db,
        user_id=performed_by,
        action=AuditAction.UNASSIGN_INCIDENT,
        entity_type=EntityType.ASSIGNMENT,
        entity_id=current.id,
        old_value={"authority_id": authority_id},
        new_value={"authority_id": None},
    )

    create_outbox_event(
        db=db,
        topic="incident.unassigned",
        payload={
            "incident_id": incident_id,
            "authority_id": authority_id,
        },
    )

    logger.info("Incident unassigned", extra={"incident_id": incident_id})

    tx = log_assignment(incident_id, authority_id, performed_by or 0, "UNASSIGN")
    current.blockchain_tx_hash = tx

# =========================================================
# Authority Workload
# =========================================================

def get_authority_workload(
    db: Session,
    *,
    authority_id: int,
) -> List[IncidentAssignment]:

    _validate_id(authority_id, "authority_id")

    authority = (
        db.query(User.id)
        .filter(
            User.id == authority_id,
            User.role == UserRole.AUTHORITY.value,
            User.deleted_at.is_(None),
            User.is_active.is_(True),
        )
        .first()
    )

    if not authority:
        raise NotFoundError("Authority")

    return (
        db.query(IncidentAssignment)
        .filter(
            IncidentAssignment.authority_id == authority_id,
            IncidentAssignment.unassigned_at.is_(None),
        )
        .order_by(IncidentAssignment.assigned_at.desc())
        .all()
    )