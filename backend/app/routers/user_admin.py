from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Dict, Any

from app.core.database import get_db
from app.core.dependencies import require_roles

from app.core.enums import UserRole
from app.models.user import User

from app.core.exceptions import (
    NotFoundError,
    ValidationError,
    ConflictError
)

from app.services.user_service import (
    get_all_users,
    get_user_by_id,
    create_authority_user,
    update_user_status
)

router = APIRouter(
    prefix="/users",
    tags=["User Management"]
)


# =========================================================
# Get Current User
# =========================================================

@router.get(
    "/me",
    status_code=status.HTTP_200_OK
)
def get_current_user_profile(
    current_user: User = Depends(
        require_roles(
            UserRole.ADMIN,
            UserRole.AUTHORITY,
            UserRole.TOURIST
        )
    )
):
    """
    Fetch the currently authenticated user's profile.
    """
    return current_user


# =========================================================
# List Users
# =========================================================

@router.get(
    "",
    status_code=status.HTTP_200_OK
)
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN))
):
    """
    Fetch all users in the system.
    Only ADMIN users can access this endpoint.
    """

    return get_all_users(db)


# =========================================================
# Get User By ID
# =========================================================

@router.get(
    "/{user_id}",
    status_code=status.HTTP_200_OK
)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN))
):
    """
    Fetch a specific user by ID.
    """

    try:

        return get_user_by_id(
            db=db,
            user_id=user_id
        )

    except NotFoundError:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )


# =========================================================
# Create Authority User
# =========================================================

@router.post(
    "/authority",
    status_code=status.HTTP_201_CREATED
)
def create_authority(
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN))
):
    """
    Create a new authority user.
    Only ADMIN can create authorities.
    """

    try:

        email = payload.get("email")
        password = payload.get("password")
        name = payload.get("name")

        if not email or not password or not name:
            raise ValidationError("Missing required fields")

        user = create_authority_user(
            db=db,
            email=email,
            password=password,
            name=name
        )

        return user

    except ValidationError as e:

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

    except ConflictError as e:

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e)
        )


# =========================================================
# Update User Status
# =========================================================

@router.patch(
    "/{user_id}/status",
    status_code=status.HTTP_200_OK
)
def update_status(
    user_id: int,
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN))
):
    """
    Activate or deactivate a user.
    """

    try:

        is_active = payload.get("is_active")

        if is_active is None:
            raise ValidationError("is_active field required")

        user = update_user_status(
            db=db,
            user_id=user_id,
            is_active=is_active
        )

        return {
            "updated": True,
            "user_id": user.id
        }

    except NotFoundError:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    except ValidationError as e:

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )