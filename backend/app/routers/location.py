from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from geoalchemy2.shape import to_shape

from app.core.database import get_db
from app.core.dependencies import require_roles
from app.core.enums import UserRole

from app.models.user import User
from app.models.location import Location

from app.schemas.location_schema import (
    LocationUpdateRequest,
    LocationResponse,
    ZoneLivePresence,
)

from app.core.exceptions import (
    ValidationError,
    NotFoundError,
)

from app.services.location_service import (
    update_user_location,
    get_latest_location_for_user,
    get_live_locations,
    get_zone_presence_summary,
)

router = APIRouter(
    prefix="/locations",
    tags=["Locations"],
)


# =========================================================
# Serializer Helper
# =========================================================

def serialize_location(location: Location) -> dict:
    point = to_shape(location.coordinates)

    return {
        "tourist_id": location.tourist_id,
        "latitude": round(point.y, 7),
        "longitude": round(point.x, 7),
        "accuracy_meters": location.accuracy_meters,
        "battery_percentage": location.battery_percentage,
        "updated_at": location.updated_at,
    }


# =========================================================
# Tourist: Update Own Location
# =========================================================

@router.post(
    "/me",
    response_model=LocationResponse,
    status_code=status.HTTP_200_OK,
)
def update_my_location(
    payload: LocationUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.TOURIST)),
):
    try:
        location = update_user_location(
            db=db,
            user_id=current_user.id,
            latitude=payload.latitude,
            longitude=payload.longitude,
            accuracy_meters=payload.accuracy_meters,
            battery_percentage=payload.battery_percentage,
        )

        return serialize_location(location)

    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


# =========================================================
# Tourist: Get Own Latest Location
# =========================================================

@router.get(
    "/me",
    response_model=LocationResponse,
    status_code=status.HTTP_200_OK,
)
def get_my_latest_location(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.TOURIST)),
):
    try:
        location = get_latest_location_for_user(
            db=db,
            user_id=current_user.id,
        )

        return serialize_location(location)

    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found",
        )


# =========================================================
# Authority: Live Map
# =========================================================

@router.get(
    "/live",
    response_model=List[LocationResponse],
    status_code=status.HTTP_200_OK,
)
def fetch_live_locations(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.AUTHORITY, UserRole.ADMIN)),
):
    locations = get_live_locations(db=db)

    return [serialize_location(loc) for loc in locations]


# =========================================================
# Authority: Zone Presence Summary
# =========================================================

@router.get(
    "/zone-presence",
    response_model=List[ZoneLivePresence],
    status_code=status.HTTP_200_OK,
)
def fetch_zone_presence(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.AUTHORITY, UserRole.ADMIN)),
):
    return get_zone_presence_summary(db=db)