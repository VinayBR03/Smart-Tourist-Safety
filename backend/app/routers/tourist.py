# app/routers/tourist.py

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select, desc

from app.core.database import get_db
from app.core.dependencies import require_roles, get_current_user
from app.core.enums import UserRole

from app.models.user import User
from app.models.health_telemetry import HealthTelemetry

from app.services.tourist_service import (
    get_tourist_by_id,
    update_tourist_profile,
    get_profile_photo_key,
    request_account_deletion,
)

from app.schemas.health_schema import HealthTelemetryResponse

from app.core.exceptions import (
    NotFoundError,
    ValidationError,
    ForbiddenError,
)


router = APIRouter(
    prefix="/tourists",
    tags=["Tourists"],
)


# =========================================================
# Get Own Profile
# =========================================================

@router.get(
    "/me",
    status_code=status.HTTP_200_OK,
)
def get_my_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.TOURIST)),
):
    """
    Tourist fetches own profile.
    """

    return get_tourist_by_id(db, tourist_id=current_user.id)


# =========================================================
# Get Tourist Health History
# GET /tourists/{tourist_id}/health
# Called by: HealthMonitoringPage via getTouristHealthHistory()
# =========================================================

@router.get(
    "/{tourist_id}/health",
    response_model=list[HealthTelemetryResponse],
    status_code=status.HTTP_200_OK,
)
def get_tourist_health_history(
    tourist_id: int,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns paginated health telemetry history for a tourist.
    Tourists can only access their own records.
    Authority and Admin can access any tourist's records.
    """

    is_authority_or_admin = current_user.role in (
        UserRole.AUTHORITY,
        UserRole.ADMIN,
    )

    if not is_authority_or_admin and current_user.id != tourist_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied.",
        )

    stmt = (
        select(HealthTelemetry)
        .where(HealthTelemetry.tourist_id == tourist_id)
        .order_by(desc(HealthTelemetry.recorded_at))
        .limit(min(limit, 200))
    )

    return db.execute(stmt).scalars().all()


# =========================================================
# Get Tourist (Admin / Authority)
# =========================================================

@router.get(
    "/{tourist_id}",
    status_code=status.HTTP_200_OK,
)
def fetch_tourist(
    tourist_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.AUTHORITY)),
):
    """
    Fetch tourist details with activity status.
    """

    try:
        return get_tourist_by_id(db, tourist_id=tourist_id)
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tourist not found.",
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


# =========================================================
# Update Own Profile
# =========================================================

@router.patch(
    "/me",
    status_code=status.HTTP_200_OK,
)
def update_my_profile(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.TOURIST)),
):
    """
    Tourist updates allowed profile fields.
    """

    try:
        updated = update_tourist_profile(
            db,
            tourist_id=current_user.id,
            updates=payload,
        )
        db.refresh(updated)
        from app.routers.auth import _user_to_response
        return _user_to_response(updated)
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except NotFoundError:
        raise HTTPException(status_code=404, detail="Tourist not found.")

# =========================================================
# Get Profile Photo Key
# =========================================================

@router.get(
    "/me/profile-photo",
    status_code=status.HTTP_200_OK,
)
def get_my_profile_photo(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.TOURIST)),
):
    """
    Fetch latest profile photo S3 key.
    """

    key = get_profile_photo_key(
        db,
        tourist_id=current_user.id,
    )

    return {"s3_key": key}


# =========================================================
# Request Account Deletion
# =========================================================

@router.post(
    "/me/request-deletion",
    status_code=status.HTTP_204_NO_CONTENT,
)
def request_deletion(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.TOURIST)),
):
    """
    Tourist initiates account deletion workflow.
    """

    try:
        request_account_deletion(
            db,
            tourist_id=current_user.id,
        )
    except ForbiddenError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e),
        )