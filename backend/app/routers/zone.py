# app/routers/zone.py

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.core.enums import UserRole

from app.models.user import User

from app.schemas.zone_schema import (
    ZoneCreateCircularRequest,
    ZoneCreatePolygonRequest,
    ZoneUpdateRequest,
    ZoneResponse,
    ZoneStatusResponse,
    ZoneWithStatusResponse,
    ZoneRiskHistoryResponse,
)

from app.core.exceptions import (
    NotFoundError,
    ValidationError,
    ConflictError,
)

from app.services.zone_service import (
    create_circular_zone,
    create_polygon_zone,
    update_zone,
    get_zone_by_id,
    list_zones,
    get_zone_status,
    get_zone_risk_history,
)


router = APIRouter(
    prefix="/zones",
    tags=["Zones"],
)


# =========================================================
# Create Circular Zone (Admin Only)
# =========================================================

@router.post(
    "/circular",
    response_model=ZoneResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_circular_zone_endpoint(
    payload: ZoneCreateCircularRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
):
    try:
        circle = create_circular_zone(
            db=db,
            name=payload.name,
            zone_type=payload.zone_type,
            center_latitude=payload.center_latitude,
            center_longitude=payload.center_longitude,
            radius_meters=payload.radius_meters,
        )
        db.commit()
        db.refresh(circle)
        return circle
    
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
# Create Polygon Zone (Admin Only)
# =========================================================

@router.post(
    "/polygon",
    response_model=ZoneResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_polygon_zone_endpoint(
    payload: ZoneCreatePolygonRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
):
    try:
        polygon = create_polygon_zone(
            db=db,
            name=payload.name,
            zone_type=payload.zone_type,
            coordinates=payload.coordinates,
        )
        db.commit()
        db.refresh(polygon)
        return polygon
    
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
# List Zones (Admin / Authority)
# =========================================================

@router.get(
    "",
    response_model=List[ZoneResponse],
    status_code=status.HTTP_200_OK,
)
def fetch_zones(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return list_zones(db)


# =========================================================
# Get Zone By ID
# =========================================================

@router.get(
    "/{zone_id}",
    response_model=ZoneWithStatusResponse,
    status_code=status.HTTP_200_OK,
)
def fetch_zone(
    zone_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.AUTHORITY)),
):
    try:
        return get_zone_by_id(db, zone_id=zone_id)
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Zone not found",
        )


# =========================================================
# Update Zone (Admin Only)
# =========================================================

@router.patch(
    "/{zone_id}",
    response_model=ZoneResponse,
    status_code=status.HTTP_200_OK,
)
def update_zone_endpoint(
    zone_id: int,
    payload: ZoneUpdateRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
):
    try:
        return update_zone(
            db=db,
            zone_id=zone_id,
            name=payload.name,
            zone_type=payload.zone_type,
            is_active=payload.is_active,
        )
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Zone not found",
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
# Get Current Zone Risk Status
# =========================================================

@router.get(
    "/{zone_id}/status",
    response_model=ZoneStatusResponse,
    status_code=status.HTTP_200_OK,
)
def fetch_zone_status(
    zone_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.AUTHORITY)),
):
    try:
        return get_zone_status(db, zone_id=zone_id)
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Zone not found",
        )


# =========================================================
# Get Zone Risk History
# =========================================================

@router.get(
    "/{zone_id}/risk-history",
    response_model=List[ZoneRiskHistoryResponse],
    status_code=status.HTTP_200_OK,
)
def fetch_zone_risk_history(
    zone_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.AUTHORITY)),
):
    try:
        return get_zone_risk_history(db, zone_id=zone_id)
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Zone not found",
        )