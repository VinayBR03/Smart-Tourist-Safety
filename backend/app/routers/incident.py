# app/router/incident.py

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.core.enums import UserRole

from app.models.user import User

from app.schemas.incident_schema import (
    IncidentCreateRequest,
    IncidentStatusUpdateRequest,
    IncidentResolveRequest,
    IncidentResponse,
    IncidentSummaryResponse,
)

from app.schemas.incident_status_history_schema import (
    IncidentStatusHistoryResponse,
    IncidentTimelineResponse,
)

from app.services.notification_service import publish_after_commit
from app.core.exceptions import (
    NotFoundError,
    ValidationError,
    ConflictError,
    ForbiddenError,
)

from app.services.incident_service import (
    create_incident,
    get_incident_by_id,
    list_incidents,
    update_incident_status,
    resolve_incident,
    get_incident_timeline,
)


router = APIRouter(
    prefix="/incidents",
    tags=["Incidents"],
)


# =========================================================
# Create Incident
# =========================================================

@router.post(
    "",
    response_model=IncidentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_new_incident(
    payload: IncidentCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Tourist creates manual incident.
    IoT-generated incidents are created internally via service layer.
    """

    try:
        incident=create_incident(
            db=db,
            tourist_id=current_user.id,
            description=payload.description,
            source=payload.source,
            latitude=payload.latitude,
            longitude=payload.longitude,
            zone_id=payload.zone_id,
            is_auto_generated=payload.is_auto_generated,
        )
        db.commit()
        publish_after_commit(db)
        db.refresh(incident)
        return incident

    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    except ConflictError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        )

@router.get(
    "/me",
    response_model=List[IncidentSummaryResponse],
    status_code=status.HTTP_200_OK,
)
def get_my_incidents(
    limit: int = 50,
    offset: int = 0,
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.TOURIST)),
):
    """
    Tourist fetches only their own incidents.
    Supports pagination and optional status filtering.
    """
    from sqlalchemy import select, desc
    from app.models.incident import Incident

    stmt = (
        select(Incident)
        .where(Incident.tourist_id == current_user.id)
        .order_by(desc(Incident.created_at))
    )

    if status_filter:
        stmt = stmt.where(Incident.status == status_filter)

    stmt = stmt.offset(offset).limit(min(limit, 100))

    incidents = db.execute(stmt).scalars().all()
    return incidents


# =========================================================
# List Incidents (Admin / Authority)
# =========================================================

@router.get(
    "",
    response_model=List[IncidentSummaryResponse],
    status_code=status.HTTP_200_OK,
)
def fetch_incidents(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.AUTHORITY)),
):
    """
    List all incidents.
    Restricted to Admin and Authority roles.
    """

    return list_incidents(db)


# =========================================================
# Get Incident By ID
# =========================================================

@router.get(
    "/{incident_id}",
    response_model=IncidentResponse,
    status_code=status.HTTP_200_OK,
)
def fetch_incident(
    incident_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Tourist can only view own incidents.
    Authority/Admin can view all.
    """

    try:
        incident = get_incident_by_id(
            db,
            incident_id=incident_id,
        )

        # Tourist ownership enforcement
        if (
            current_user.role == UserRole.TOURIST
            and incident.tourist_id != current_user.id
        ):
            raise ForbiddenError("Access denied")

        return incident

    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incident not found",
        )

    except ForbiddenError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e),
        )


# =========================================================
# Update Incident Status (Non-Terminal Only)
# =========================================================

@router.patch(
    "/{incident_id}/status",
    response_model=IncidentResponse,
    status_code=status.HTTP_200_OK,
)
def change_incident_status(
    incident_id: int,
    payload: IncidentStatusUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.ADMIN, UserRole.AUTHORITY)
    ),
):
    """
    Update non-terminal status transitions.
    Resolution must go through resolve endpoint.
    """

    try:
        incident=update_incident_status(
            db=db,
            incident_id=incident_id,
            new_status=payload.status,
            performed_by=current_user.id,
        )
        db.commit()
        publish_after_commit(db)
        db.refresh(incident)
        return incident


    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incident not found",
        )

    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    except ConflictError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        )


# =========================================================
# Resolve Incident (Terminal State)
# =========================================================

@router.post(
    "/{incident_id}/resolve",
    response_model=IncidentResponse,
    status_code=status.HTTP_200_OK,
)
def resolve_existing_incident(
    incident_id: int,
    payload: IncidentResolveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.ADMIN, UserRole.AUTHORITY)
    ),
):
    """
    Resolve or close incident.
    Cannot be done through generic status update.
    """

    try:
        incident = resolve_incident(
            db=db,
            incident_id=incident_id,
            resolution_note=payload.resolution_note,
            performed_by=current_user.id,
        )

        db.commit()
        publish_after_commit(db)
        db.refresh(incident)
        return incident


    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incident not found",
        )

    except ConflictError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        )


# =========================================================
# Incident Timeline
# =========================================================

@router.get(
    "/{incident_id}/timeline",
    response_model=List[IncidentTimelineResponse],
    status_code=status.HTTP_200_OK,
)
def fetch_timeline(
    incident_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieve immutable status transition history.
    Tourist can only view own incidents.
    """

    try:
        incident = get_incident_by_id(
            db,
            incident_id=incident_id,
        )

        if (
            current_user.role == UserRole.TOURIST
            and incident.tourist_id != current_user.id
        ):
            raise ForbiddenError("Access denied")

        return get_incident_timeline(
            db,
            incident_id=incident_id,
        )

    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incident not found",
        )

    except ForbiddenError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e),
        )