from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_iot_device, get_current_user, require_roles
from app.core.enums import UserRole

from app.models.iot_device import IoTDevice
from app.models.device_assignment import DeviceAssignment
from app.models.user import User

from app.schemas.iot_schema import (
    IoTLocationRequest,
    IoTHealthRequest,
    IoTHeartbeatRequest,
    IoTResponse,
)

from app.core.exceptions import (
    ValidationError,
    NotFoundError,
    ForbiddenError,
    ConflictError,
)

from app.services.device_service import update_heartbeat
from app.services.iot_service import handle_location_event, handle_health_event


router = APIRouter(
    prefix="/iot",
    tags=["IoT"],
)


# =========================================================
# Internal helper — resolve active device for a tourist
# =========================================================

def _get_tourist_active_device(db: Session, tourist_id: int) -> IoTDevice:
    assignment = (
        db.query(DeviceAssignment)
        .filter(
            DeviceAssignment.tourist_id == tourist_id,
            DeviceAssignment.unassigned_at.is_(None),
        )
        .order_by(DeviceAssignment.assigned_at.desc())
        .first()
    )
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active device assignment found for this tourist.",
        )
    device = (
        db.query(IoTDevice)
        .filter(IoTDevice.device_id == assignment.device_id)
        .first()
    )
    if not device:
        raise HTTPException(status_code=404, detail="Assigned device not found.")
    if device.status.value != "ACTIVE":
        raise HTTPException(status_code=403, detail="Assigned device is not active.")
    return device


# =========================================================
# Heartbeat  (IoT API key)
# =========================================================

@router.post("/heartbeat", response_model=IoTResponse, status_code=status.HTTP_200_OK)
def device_heartbeat(
    payload: IoTHeartbeatRequest,
    device: IoTDevice = Depends(get_current_iot_device),
    db: Session = Depends(get_db),
):
    try:
        update_heartbeat(
            db=db,
            device_id=device.device_id,
            battery_percentage=payload.battery_percentage,
            battery_voltage=payload.battery_voltage,
            firmware_version=payload.firmware_version,
        )
        db.commit()
        return IoTResponse(status="ok")
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))


# =========================================================
# Location Event  (IoT API key — LoRa path)
# =========================================================

@router.post("/location", response_model=IoTResponse, status_code=status.HTTP_202_ACCEPTED)
def ingest_location(
    payload: IoTLocationRequest,
    device: IoTDevice = Depends(get_current_iot_device),
    db: Session = Depends(get_db),
):
    try:
        handle_location_event(
            db=db,
            device_id=device.device_id,
            latitude=payload.latitude,
            longitude=payload.longitude,
            rssi=payload.rssi,
            sos_flag=payload.sos_flag,
            heart_rate=None,
            spo2=None,
            temperature=None,
            fall_detected=False,
            battery_percentage=None,
            battery_voltage=None,
            firmware_version=None,
            device_timestamp=payload.recorded_at,
        )
        db.commit()
        return IoTResponse(status="accepted")
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except (NotFoundError, ForbiddenError) as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ConflictError as e:
        db.rollback()
        raise HTTPException(status_code=409, detail=str(e))


# =========================================================
# Health Event  (IoT API key — LoRa path)
# =========================================================

@router.post("/health", response_model=IoTResponse, status_code=status.HTTP_202_ACCEPTED)
def ingest_health(
    payload: IoTHealthRequest,
    device: IoTDevice = Depends(get_current_iot_device),
    db: Session = Depends(get_db),
):
    try:
        handle_health_event(
            db=db,
            device_id=device.device_id,
            heart_rate=payload.heart_rate,
            spo2=payload.spo2,
            body_temperature=payload.body_temperature,
            is_alert=payload.is_alert,
            latitude=payload.latitude,
            longitude=payload.longitude,
            device_timestamp=payload.recorded_at,
        )
        db.commit()
        return IoTResponse(status="accepted")
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except (NotFoundError, ForbiddenError) as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ConflictError as e:
        db.rollback()
        raise HTTPException(status_code=409, detail=str(e))


# =========================================================
# BLE Gateway — Location  (Tourist JWT)
# =========================================================
# Phone posts on behalf of wristband when SOS received over BLE.
# Auth: tourist Bearer JWT — no IoT API key needed on phone.

@router.post("/gateway/location", response_model=IoTResponse, status_code=status.HTTP_202_ACCEPTED)
def gateway_ingest_location(
    payload: IoTLocationRequest,
    current_user: User = Depends(require_roles(UserRole.TOURIST)),
    db: Session = Depends(get_db),
):
    device = _get_tourist_active_device(db, tourist_id=current_user.id)
    try:
        handle_location_event(
            db=db,
            device_id=device.device_id,
            latitude=payload.latitude,
            longitude=payload.longitude,
            rssi=None,
            sos_flag=payload.sos_flag,
            heart_rate=None,
            spo2=None,
            temperature=None,
            fall_detected=False,
            battery_percentage=None,
            battery_voltage=None,
            firmware_version=None,
            device_timestamp=payload.recorded_at,
        )
        db.commit()
        return IoTResponse(status="accepted")
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except (NotFoundError, ForbiddenError) as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ConflictError as e:
        db.rollback()
        raise HTTPException(status_code=409, detail=str(e))


# =========================================================
# BLE Gateway — Health  (Tourist JWT)
# =========================================================
# Phone posts health data received over BLE from wristband.
# Auth: tourist Bearer JWT — device resolved from active assignment.

@router.post("/gateway/health", response_model=IoTResponse, status_code=status.HTTP_202_ACCEPTED)
def gateway_ingest_health(
    payload: IoTHealthRequest,
    current_user: User = Depends(require_roles(UserRole.TOURIST)),
    db: Session = Depends(get_db),
):
    device = _get_tourist_active_device(db, tourist_id=current_user.id)
    try:
        handle_health_event(
            db=db,
            device_id=device.device_id,
            heart_rate=payload.heart_rate,
            spo2=payload.spo2,
            body_temperature=payload.body_temperature,
            is_alert=payload.is_alert,
            latitude=payload.latitude,
            longitude=payload.longitude,
            device_timestamp=payload.recorded_at,
        )
        db.commit()
        return IoTResponse(status="accepted")
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except (NotFoundError, ForbiddenError) as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ConflictError as e:
        db.rollback()
        raise HTTPException(status_code=409, detail=str(e))
