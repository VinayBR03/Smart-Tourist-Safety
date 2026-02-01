from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models.incident import Incident

VALID_STATUSES = {"open", "in_progress", "resolved"}


def create_incident(
    db: Session,
    tourist_id: int,
    description: str,
    latitude: float,
    longitude: float
):
    incident = Incident(
        description=description,
        latitude=latitude,
        longitude=longitude,
        tourist_id=tourist_id
    )
    db.add(incident)
    db.commit()
    db.refresh(incident)
    return incident


def get_all_incidents(db: Session):
    return (
        db.query(Incident)
        .order_by(Incident.created_at.desc())
        .all()
    )


def get_incident_by_id(db: Session, incident_id: int):
    incident = (
        db.query(Incident)
        .filter(Incident.id == incident_id)
        .first()
    )
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return incident


def update_incident_status(
    db: Session,
    incident_id: int,
    status: str
):
    if status not in VALID_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Allowed: {VALID_STATUSES}"
        )

    incident = get_incident_by_id(db, incident_id)
    incident.status = status

    db.commit()
    db.refresh(incident)
    return incident
