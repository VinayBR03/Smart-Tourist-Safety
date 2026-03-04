# app/services/incident_service.py

from datetime import datetime, timezone, timedelta
from typing import Optional, List
import math

from sqlalchemy.orm import Session
from sqlalchemy import select
from geoalchemy2.functions import ST_SetSRID, ST_Point

from app.models.incident import Incident
from app.models.incident_status_history import IncidentStatusHistory
from app.models.zone import Zone

from app.core.enums import (
    IncidentStatus,
    IncidentSource,
    AuditAction,
    EntityType,
    NotificationChannel,
    NotificationSeverity,
)

from app.core.exceptions import (
    ValidationError,
    NotFoundError,
    ConflictError,
)

from app.services.audit_service import create_audit_log
from app.services.outbox_service import create_outbox_event
from app.services.notification_service import create_notification

from app.utils.logger import get_logger

logger = get_logger(__name__)

MAX_DESCRIPTION_LENGTH = 2000


# =========================================================
# STATE MACHINE
# =========================================================

ALLOWED_TRANSITIONS = {
    IncidentStatus.OPEN: {IncidentStatus.IN_PROGRESS, IncidentStatus.RESOLVED},
    IncidentStatus.IN_PROGRESS: {IncidentStatus.RESOLVED},
    IncidentStatus.RESOLVED: {IncidentStatus.CLOSED},
    IncidentStatus.CLOSED: set(),
}


# =========================================================
# HELPERS
# =========================================================

def _validate_coordinates(latitude: float, longitude: float) -> None:
    try:
        latitude = float(latitude)
        longitude = float(longitude)
    except (TypeError, ValueError):
        raise ValidationError("Invalid coordinates")

    if not math.isfinite(latitude) or not math.isfinite(longitude):
        raise ValidationError("Invalid coordinates")

    if not (-90 <= latitude <= 90):
        raise ValidationError("Invalid latitude")

    if not (-180 <= longitude <= 180):
        raise ValidationError("Invalid longitude")


def _has_active_incident_locked(db: Session, tourist_id: int) -> bool:
    stmt = (
        select(Incident.id)
        .where(
            Incident.tourist_id == tourist_id,
            Incident.deleted_at.is_(None),
            Incident.status.in_(
                [
                    IncidentStatus.OPEN.value,
                    IncidentStatus.IN_PROGRESS.value,
                ]
            ),
        )
        .with_for_update()
        .limit(1)
    )
    return db.execute(stmt).scalar_one_or_none() is not None


# =========================================================
# CREATE INCIDENT
# =========================================================

def create_incident(
    db: Session,
    *,
    tourist_id: int,
    description: str,
    source: IncidentSource,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    zone_id: Optional[int] = None,
    is_auto_generated: bool = False,
) -> Incident:

    if not description or not description.strip():
        raise ValidationError("Description required")

    description = description.strip()

    if len(description) > MAX_DESCRIPTION_LENGTH:
        raise ValidationError("Description too long")

    if not isinstance(source, IncidentSource):
        raise ValidationError("Invalid incident source")

    if not (zone_id or (latitude is not None and longitude is not None)):
        raise ValidationError("Incident must include location or zone")

    if latitude is not None and longitude is not None:
        _validate_coordinates(latitude, longitude)

    if zone_id:
        zone = (
            db.query(Zone.id)
            .filter(
                Zone.id == zone_id,
                Zone.deleted_at.is_(None),
                Zone.is_active.is_(True),
            )
            .first()
        )
        if not zone:
            raise ValidationError("Invalid zone")

    if _has_active_incident_locked(db, tourist_id):
        raise ConflictError("Active incident already exists")

    now = datetime.now(timezone.utc)

    location_point = None
    if latitude is not None and longitude is not None:
        location_point = ST_SetSRID(ST_Point(longitude, latitude), 4326)

    incident = Incident(
        tourist_id=tourist_id,
        description=description,
        status=IncidentStatus.OPEN.value,
        source=source.value,
        zone_id=zone_id,
        location=location_point,
        is_auto_generated=is_auto_generated,
        resolved_at=None,
    )

    db.add(incident)
    db.flush()

    db.add(
        IncidentStatusHistory(
            incident_id=incident.id,
            old_status=None,
            new_status=IncidentStatus.OPEN.value,
            changed_at=now,
            changed_by=tourist_id,
        )
    )

    create_audit_log(
        db=db,
        user_id=tourist_id,
        action=AuditAction.CREATE_INCIDENT,
        entity_type=EntityType.INCIDENT,
        entity_id=incident.id,
        new_value={"status": IncidentStatus.OPEN.value},
    )

    create_outbox_event(
        db=db,
        topic="incident.created",
        payload={
            "incident_id": incident.id,
            "tourist_id": tourist_id,
        },
    )

    create_notification(
        db=db,
        user_id=None,
        event_type="INCIDENT_CREATED",
        channel=NotificationChannel.IN_APP,
        severity=NotificationSeverity.WARNING,
        related_entity_type=EntityType.INCIDENT,
        related_entity_id=incident.id,
        context={"incident_id": incident.id},
    )

    return incident


# =========================================================
# GET INCIDENT BY ID
# =========================================================

def get_incident_by_id(
    db: Session,
    *,
    incident_id: int,
) -> Incident:

    stmt = (
        select(Incident)
        .where(
            Incident.id == incident_id,
            Incident.deleted_at.is_(None),
        )
    )

    incident = db.execute(stmt).scalar_one_or_none()

    if not incident:
        raise NotFoundError("Incident")

    return incident


# =========================================================
# LIST INCIDENTS
# =========================================================

def list_incidents(db: Session) -> List[Incident]:

    stmt = (
        select(Incident)
        .where(Incident.deleted_at.is_(None))
        .order_by(Incident.created_at.desc())
    )

    return db.execute(stmt).scalars().all()


# =========================================================
# UPDATE STATUS
# =========================================================

def update_incident_status(
    db: Session,
    *,
    incident_id: int,
    new_status: IncidentStatus,
    performed_by: int,
) -> Incident:

    if not isinstance(new_status, IncidentStatus):
        raise ValidationError("Invalid status")

    stmt = (
        select(Incident)
        .where(
            Incident.id == incident_id,
            Incident.deleted_at.is_(None),
        )
        .with_for_update()
    )

    incident = db.execute(stmt).scalar_one_or_none()

    if not incident:
        raise NotFoundError("Incident")

    current_status = IncidentStatus(incident.status)

    if current_status == new_status:
        return incident

    allowed = ALLOWED_TRANSITIONS.get(current_status, set())
    if new_status not in allowed:
        raise ValidationError("Invalid status transition")

    now = datetime.now(timezone.utc)

    incident.status = new_status.value
    incident.updated_at = now

    if new_status == IncidentStatus.RESOLVED:
        incident.resolved_at = now

    db.add(
        IncidentStatusHistory(
            incident_id=incident.id,
            old_status=current_status.value,
            new_status=new_status.value,
            changed_at=now,
            changed_by=performed_by,
        )
    )

    create_outbox_event(
        db=db,
        topic="incident.updated",
        payload={
            "incident_id": incident.id,
            "status": new_status.value,
        },
    )

    return incident


# =========================================================
# RESOLVE
# =========================================================

def resolve_incident(
    db: Session,
    *,
    incident_id: int,
    resolution_note: Optional[str],
    performed_by: int,
) -> Incident:

    incident = update_incident_status(
        db=db,
        incident_id=incident_id,
        new_status=IncidentStatus.RESOLVED,
        performed_by=performed_by,
    )

    if resolution_note:
        incident.description += f"\n\nResolution: {resolution_note.strip()}"

    create_outbox_event(
        db=db,
        topic="incident.resolved",
        payload={"incident_id": incident.id},
    )

    return incident


# =========================================================
# SLA ESCALATION
# =========================================================

def escalate_incident_if_breached(
    db: Session,
    incident: Incident,
    breach_minutes: int = 60,
) -> None:

    if incident.status != IncidentStatus.OPEN.value:
        return

    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(minutes=breach_minutes)

    if incident.created_at < cutoff:
        update_incident_status(
            db=db,
            incident_id=incident.id,
            new_status=IncidentStatus.IN_PROGRESS,
            performed_by=incident.tourist_id,
        )


# =========================================================
# AUTO CLOSE
# =========================================================

def auto_close_incident(
    db: Session,
    incident: Incident,
    close_after_days: int = 7,
) -> None:

    if incident.status != IncidentStatus.RESOLVED.value:
        return

    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=close_after_days)

    if incident.resolved_at and incident.resolved_at < cutoff:
        update_incident_status(
            db=db,
            incident_id=incident.id,
            new_status=IncidentStatus.CLOSED,
            performed_by=incident.tourist_id,
        )


# =========================================================
# GET INCIDENT TIMELINE
# =========================================================

def get_incident_timeline(
    db: Session,
    *,
    incident_id: int,
) -> List[IncidentStatusHistory]:

    stmt = (
        select(IncidentStatusHistory)
        .where(IncidentStatusHistory.incident_id == incident_id)
        .order_by(IncidentStatusHistory.changed_at.asc())
    )

    return db.execute(stmt).scalars().all()