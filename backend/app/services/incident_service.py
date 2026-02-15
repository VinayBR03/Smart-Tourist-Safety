# app/services/incident_service.py

from sqlalchemy.orm import Session
from fastapi import HTTPException
from typing import List
from datetime import datetime

from app.models.incident import Incident
from app.core.websocket_manager import manager


VALID_STATUSES = {"open", "in_progress", "resolved"}


# --------------------------------
# Create Incident (Tourist)
# --------------------------------
async def create_incident(
    db: Session,
    tourist_id: int,
    description: str,
    latitude: float,
    longitude: float,
) -> Incident:

    incident = Incident(
        description=description,
        latitude=latitude,
        longitude=longitude,
        tourist_id=tourist_id,
        status="open",
        created_at=datetime.utcnow(),
    )

    db.add(incident)
    db.commit()
    db.refresh(incident)

    # 🔴 REAL-TIME BROADCAST
    await manager.broadcast({
        "type": "incident_created",
        "data": serialize_incident(incident)
    })

    return incident


# --------------------------------
# Authority: Get All Incidents
# --------------------------------
def get_all_incidents(db: Session) -> List[Incident]:
    return (
        db.query(Incident)
        .order_by(Incident.created_at.desc())
        .all()
    )


# --------------------------------
# Authority: Get Incident By ID
# --------------------------------
def get_incident_by_id(db: Session, incident_id: int) -> Incident:

    incident = (
        db.query(Incident)
        .filter(Incident.id == incident_id)
        .first()
    )

    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    return incident


# --------------------------------
# Authority: Update Status
# --------------------------------
async def update_incident_status(
    db: Session,
    incident_id: int,
    status: str,
) -> Incident:

    if status not in VALID_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Allowed: {VALID_STATUSES}",
        )

    incident = get_incident_by_id(db, incident_id)

    incident.status = status
    incident.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(incident)

    # 🔴 REAL-TIME BROADCAST
    await manager.broadcast({
        "type": "incident_updated",
        "data": serialize_incident(incident)
    })

    return incident


# --------------------------------
# Tourist: Get My Incidents
# --------------------------------
def get_incidents_by_tourist(
    db: Session,
    tourist_id: int,
) -> List[Incident]:

    return (
        db.query(Incident)
        .filter(Incident.tourist_id == tourist_id)
        .order_by(Incident.created_at.desc())
        .all()
    )


# --------------------------------
# Helper: Serialize Incident
# --------------------------------
def serialize_incident(incident: Incident) -> dict:
    return {
        "id": incident.id,
        "description": incident.description,
        "latitude": incident.latitude,
        "longitude": incident.longitude,
        "tourist_id": incident.tourist_id,
        "status": incident.status,
        "created_at": incident.created_at.isoformat() if incident.created_at else None,
        "updated_at": incident.updated_at.isoformat() if getattr(incident, "updated_at", None) else None,
    }
