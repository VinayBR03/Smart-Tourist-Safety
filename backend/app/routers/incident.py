from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.dependencies import (
    get_db,
    require_tourist,
    require_authority,
)
from app.models.user import User
from app.schemas.incident_schema import (
    IncidentCreate,
    IncidentResponse,
    IncidentStatusUpdate,
)
from app.services.incident_service import (
    create_incident,
    get_all_incidents,
    get_incident_by_id,
    update_incident_status,
)
from app.services.incident_service import (
    create_incident,
    get_all_incidents,
    get_incident_by_id,
    update_incident_status,
    get_incidents_by_tourist,
)


router = APIRouter(prefix="/incidents", tags=["Incidents"])

# -------------------------
# Tourist: My Incidents
# -------------------------
@router.get("/my", response_model=list[IncidentResponse])
def my_incidents(
    db: Session = Depends(get_db),
    user: User = Depends(require_tourist),
):
    return get_incidents_by_tourist(
        db=db,
        tourist_id=user.id
    )


# -------------------------
# Tourist: Create Incident
# -------------------------
@router.post("/", response_model=IncidentResponse)
def report_incident(
    data: IncidentCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_tourist),
):
    return create_incident(
        db=db,
        tourist_id=user.id,
        description=data.description,
        latitude=data.latitude,
        longitude=data.longitude,
    )


# -------------------------
# Authority: List Incidents
# -------------------------
@router.get("/", response_model=list[IncidentResponse])
def list_incidents(
    db: Session = Depends(get_db),
    _=Depends(require_authority),
):
    return get_all_incidents(db)


# -------------------------
# Authority: Incident Detail
# -------------------------
@router.get("/{incident_id}", response_model=IncidentResponse)
def incident_detail(
    incident_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_authority),
):
    return get_incident_by_id(db, incident_id)


# -------------------------
# Authority: Update Status
# -------------------------
@router.patch("/{incident_id}/status", response_model=IncidentResponse)
def change_status(
    incident_id: int,
    data: IncidentStatusUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_authority),
):
    return update_incident_status(
        db=db,
        incident_id=incident_id,
        status=data.status,
    )
