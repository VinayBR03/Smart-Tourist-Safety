# app/routers/device.py

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select as sa_select
from typing import List

from app.core.database import get_db
from app.core.dependencies import require_roles, get_current_user
from app.core.enums import UserRole

from app.models.user import User
from app.models.device_assignment import DeviceAssignment

from app.schemas.device_schema import (
    DeviceRegisterRequest,
    DeviceRegisterResponse,
    DeviceStatusUpdateRequest,
    DeviceResponse,
    DeviceSummaryResponse,
)

from app.core.exceptions import (
    NotFoundError,
    ValidationError,
    ForbiddenError,
)

from app.services.device_service import (
    register_device,
    update_device_status,
    assign_device_to_tourist,
    unassign_device,
    get_device,
    list_devices,
)


router = APIRouter(
    prefix="/devices",
    tags=["Devices"],
)


# =========================================================
# Register Device (Admin Only)
# =========================================================

@router.post(
    "",
    response_model=DeviceRegisterResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_device(
    payload: DeviceRegisterRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
):
    """
    Register new IoT device.
    Returns API key ONCE.
    """

    try:
        device = register_device(db, payload=payload)
        db.commit()
        db.refresh(device)
        return device
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


# =========================================================
# List Devices (Admin / Authority)
# =========================================================

@router.get(
    "",
    response_model=List[DeviceSummaryResponse],
    status_code=status.HTTP_200_OK,
)
def get_devices(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.AUTHORITY)),
):
    """
    List active devices.
    """

    return list_devices(db)


@router.get(
    "/mine",
    response_model=List[DeviceSummaryResponse],
    status_code=status.HTTP_200_OK,
)
def get_my_device(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns wristband(s) assigned to the currently authenticated tourist.
    Used by the mobile app's Devices screen.
    """
    from app.models.device_assignment import DeviceAssignment
    from app.models.iot_device import IoTDevice
    from sqlalchemy import select as sa_select

    stmt = (
        sa_select(IoTDevice)
        .join(
            DeviceAssignment,
            DeviceAssignment.device_id == IoTDevice.device_id,
        )
        .where(
            DeviceAssignment.tourist_id == current_user.id,
            DeviceAssignment.unassigned_at.is_(None),
            IoTDevice.is_deleted.is_(False),
        )
    )

    devices = db.execute(stmt).scalars().all()
    return devices


# =========================================================
# Get Device By ID
# =========================================================

@router.get(
    "/{device_id}",
    response_model=DeviceResponse,
    status_code=status.HTTP_200_OK,
)
def fetch_device(
    device_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.AUTHORITY)),
):
    """
    Fetch device details.
    """

    try:
        return get_device(db, device_id=device_id)
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found.",
        )


# =========================================================
# Update Device Status (Admin Only)
# =========================================================

@router.patch(
    "/{device_id}/status",
    response_model=DeviceResponse,
    status_code=status.HTTP_200_OK,
)
def change_device_status(
    device_id: str,
    payload: DeviceStatusUpdateRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
):
    """
    Update device lifecycle status.
    """

    try:
        device = update_device_status(
            db,
            device_id=device_id,
            status=payload.status,
            performed_by=_.id,
        )

        db.commit()
        db.refresh(device)

        return device
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found.",
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except ForbiddenError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e),
        )


# =========================================================
# Assign Device To Tourist (Admin Only)
# =========================================================

@router.post(
    "/{device_id}/assign/{tourist_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def assign_device(
    device_id: str,
    tourist_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Assign device to tourist.
    """

    if current_user.role == UserRole.TOURIST and current_user.id != tourist_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tourists can only assign devices to themselves.",
        )

    try:
        assign_device_to_tourist(
            db,
            device_id=device_id,
            tourist_id=tourist_id,
        )
        db.commit()
    except (ValidationError, NotFoundError) as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


# =========================================================
# Unassign Device (Admin Only)
# =========================================================

@router.post(
    "/{device_id}/unassign",
    status_code=status.HTTP_204_NO_CONTENT,
)
def unassign_device_endpoint(
    device_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Unassign device from current tourist.
    """

    try:
        unassign_device(
            db,
            device_id=device_id,
        )
        db.commit()
    except NotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found.",
        )
    except ValidationError as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )