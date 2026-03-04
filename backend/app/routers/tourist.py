# app/routers/tourist.py

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import require_roles
from app.core.enums import UserRole

from app.models.user import User

from app.services.tourist_service import (
    get_tourist_by_id,
    update_tourist_profile,
    get_profile_photo_key,
    request_account_deletion,
)

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
        return {"updated": True, "user_id": updated.id}
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


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