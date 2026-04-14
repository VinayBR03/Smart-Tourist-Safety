# app/routers/device.py

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.core.dependencies import require_roles
from app.core.enums import UserRole, DeviceStatus, DeviceType

from app.models.user import User

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
    ConflictError,
)

from app.services.device_service import (
    register_device,
    update_device_status,
    assign_device_to_tourist,
    reassign_tourist_device,
    unassign_device,
    get_device,
    get_device_by_device_id,
    list_devices,
    _get_active_assignment,
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
    _: User = Depends(require_roles(UserRole.ADMIN)),
):
    """
    Assign device to tourist.
    """

    try:
        device = assign_device_to_tourist(
            db,
            device_id=device_id,
            tourist_id=tourist_id,
        )
        db.commit()
        db.refresh(device)
        return device
    except (ValidationError, NotFoundError) as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


# =========================================================
# Self-Pair Device (Tourist — called from mobile app on BLE connect)
#
# Tourist connects to wristband over BLE, reads device_id from
# BLE_CHAR_DEVICE_ID_UUID, then calls this endpoint to link it to
# their own account.
#
# - Rejects if the wristband is already assigned to a *different* tourist
#   (409 Conflict).
# - If tourist already has a different wristband assigned, that old
#   assignment is closed atomically (swap wristbands in one step).
# - Auto-activates INACTIVE devices on first pairing.
# =========================================================

@router.post(
    "/{device_id}/pair",
    status_code=status.HTTP_204_NO_CONTENT,
)
def pair_device_to_self(
    device_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.TOURIST)),
):
    """
    Tourist pairs a wristband to themselves via the mobile app.
    Triggered automatically on BLE connect.
    """
    try:
        device = get_device_by_device_id(db, device_id=device_id)

        if device.device_type != DeviceType.WRISTBAND:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only WRISTBAND devices can be self-paired.",
            )

        # Auto-activate INACTIVE device on first pairing
        if device.status == DeviceStatus.INACTIVE:
            update_device_status(
                db=db,
                device_id=device_id,
                status=DeviceStatus.ACTIVE,
                performed_by=current_user.id,
            )

        # Use reassign so existing assignment for this tourist is swapped
        # cleanly, and ConflictError fires if device belongs to someone else.
        reassign_tourist_device(
            db=db,
            tourist_id=current_user.id,
            new_device_id=device_id,
            performed_by=current_user.id,
        )

        db.commit()

    except ConflictError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except (NotFoundError, ValidationError) as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# =========================================================
# Self-Unpair Device (Tourist — called from mobile app on BLE disconnect)
#
# Closes the active DeviceAssignment for the currently authenticated tourist.
# Called automatically when BLE drops or tourist taps "Remove".
# No device_id needed in the URL — resolved from the JWT.
# =========================================================

@router.post(
    "/mine/unpair",
    status_code=status.HTTP_204_NO_CONTENT,
)
def unpair_my_device(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.TOURIST)),
):
    """
    Tourist unpairs their own wristband.
    Triggered automatically on BLE disconnect or manual Remove.
    """
    try:
        assignment = _get_active_assignment(db, tourist_id=current_user.id)
        if not assignment:
            # Already unassigned — idempotent, treat as success
            return

        unassign_device(db, device_id=assignment.device_id)
        db.commit()

    except (NotFoundError, ValidationError) as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


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
    _: User = Depends(require_roles(UserRole.ADMIN)),
):
    """
    Unassign device from current tourist.
    """

    try:
        unassign_device(
            db,
            device_id=device_id,
        )
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