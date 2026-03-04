from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.core.enums import UserRole

from app.models.user import User

from app.schemas.media_schema import (
    MediaUploadRequest,
    MediaUploadResponse,
    MediaConfirmRequest,
    MediaResponse,
    IncidentMediaSummary,
)

from app.core.exceptions import (
    ValidationError,
    NotFoundError,
    ForbiddenError,
)

from app.services.media_service import (
    generate_presigned_upload,
    confirm_media_upload,
    get_media_by_id,
    list_media_for_incident,
    list_media_for_user,
)


router = APIRouter(
    prefix="/media",
    tags=["Media"],
)


# =========================================================
# Generate Presigned Upload URL
# =========================================================

@router.post(
    "/upload",
    response_model=MediaUploadResponse,
)
def generate_upload_url(
    payload: MediaUploadRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return generate_presigned_upload(
            db=db,
            user_id=current_user.id,
            user_role=current_user.role,
            media_type=payload.media_type,
            content_type=payload.content_type,
            file_size_bytes=payload.file_size_bytes,
            incident_id=payload.incident_id,
        )

    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))

    except ForbiddenError:
        raise HTTPException(status_code=403, detail="Access denied")


# =========================================================
# Confirm Upload
# =========================================================

@router.post(
    "/confirm",
    response_model=MediaResponse,
)
def confirm_upload(
    payload: MediaConfirmRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return confirm_media_upload(
            db=db,
            user_id=current_user.id,
            media_type=payload.media_type,
            s3_key=payload.s3_key,
            incident_id=payload.incident_id,
        )

    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))

    except NotFoundError:
        raise HTTPException(status_code=404, detail="Upload not found")

    except ForbiddenError:
        raise HTTPException(status_code=403, detail="Access denied")


# =========================================================
# List My Media
# =========================================================

@router.get(
    "/me",
    response_model=List[MediaResponse],
)
def list_my_media(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.TOURIST)),
):
    return list_media_for_user(
        db=db,
        user_id=current_user.id,
    )


# =========================================================
# Get Single Media
# =========================================================

@router.get(
    "/{media_id}",
    response_model=MediaResponse,
)
def fetch_media(
    media_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        media = get_media_by_id(db=db, media_id=media_id)

        # Ownership enforcement
        if (
            media.uploaded_by != current_user.id
            and current_user.role not in {UserRole.ADMIN, UserRole.AUTHORITY}
        ):
            raise ForbiddenError("Access denied")

        return media

    except NotFoundError:
        raise HTTPException(status_code=404, detail="Media not found")

    except ForbiddenError:
        raise HTTPException(status_code=403, detail="Access denied")


# =========================================================
# List Incident Media
# =========================================================

@router.get(
    "/incident/{incident_id}",
    response_model=List[IncidentMediaSummary],
)
def list_incident_media_endpoint(
    incident_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        media_list = list_media_for_incident(
            db=db,
            incident_id=incident_id,
        )

        # Tourist can only view their own incident media
        if current_user.role == UserRole.TOURIST:
            media_list = [
                m for m in media_list
                if m.uploaded_by == current_user.id
            ]

        return media_list

    except NotFoundError:
        raise HTTPException(status_code=404, detail="Incident not found")