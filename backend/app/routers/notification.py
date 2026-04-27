from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.core.enums import UserRole

from app.models.user import User

from app.schemas.notification_schema import (
    NotificationResponse,
    NotificationSummaryResponse,
    NotificationUnreadCountResponse,
    NotificationMarkReadRequest,
)

from app.core.exceptions import (
    NotFoundError,
    ForbiddenError,
    ValidationError,
)

from app.services.notification_service import (
    get_notifications_for_user,
    get_notification_by_id,
    mark_notification_as_read,
    get_unread_count,
)


router = APIRouter(
    prefix="/notifications",
    tags=["Notifications"],
)


# =========================================================
# List My Notifications
# =========================================================

@router.get(
    "",
    response_model=List[NotificationSummaryResponse],
    status_code=status.HTTP_200_OK,
)
def list_my_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_notifications_for_user(
        db=db,
        user_id=current_user.id,
    )


# =========================================================
# Unread Count
# =========================================================

@router.get(
    "/unread-count",
    response_model=NotificationUnreadCountResponse,
    status_code=status.HTTP_200_OK,
)
def unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    count = get_unread_count(
        db=db,
        user_id=current_user.id,
    )

    return NotificationUnreadCountResponse(unread_count=count)


# =========================================================
# Get Notification Detail
# =========================================================

@router.get(
    "/{notification_id}",
    response_model=NotificationResponse,
    status_code=status.HTTP_200_OK,
)
def get_notification_detail(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        notification = get_notification_by_id(
            db=db,
            notification_id=notification_id,
        )

        # Ownership enforcement
        if notification.user_id != current_user.id:
            raise ForbiddenError("Access denied")

        return notification

    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )
    except ForbiddenError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e),
        )


# =========================================================
# Mark Notification as Read
# =========================================================

@router.post(
    "/{notification_id}/read",
    response_model=NotificationResponse,
    status_code=status.HTTP_200_OK,
)
def mark_as_read(
    notification_id: int,
    _: NotificationMarkReadRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        notification = mark_notification_as_read(
            db=db,
            notification_id=notification_id,
            user_id=current_user.id,
        )
        db.commit()
        db.refresh(notification)
        return notification

    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )
    except ForbiddenError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


# =========================================================
# Admin: List System Notifications (Optional)
# =========================================================

@router.get(
    "/admin/system",
    response_model=List[NotificationSummaryResponse],
    status_code=status.HTTP_200_OK,
)
def list_system_notifications(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
):
    return get_notifications_for_user(
        db=db,
        user_id=None,  # system-wide notifications
    )