from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_iot_device

from app.models.iot_device import IoTDevice

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
from app.services.iot_service import handle_location_event


router = APIRouter(
    prefix="/iot",
    tags=["IoT"],
)


# =========================================================
# Heartbeat
# =========================================================

@router.post(
    "/heartbeat",
    response_model=IoTResponse,
    status_code=status.HTTP_200_OK,
)
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

        return IoTResponse(status="ok")

    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))


# =========================================================
# Location Event
# =========================================================

@router.post(
    "/location",
    response_model=IoTResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
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

        return IoTResponse(status="accepted")

    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except (NotFoundError, ForbiddenError) as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ConflictError as e:
        raise HTTPException(status_code=409, detail=str(e))


# =========================================================
# Health Event
# =========================================================

@router.post(
    "/health",
    response_model=IoTResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def ingest_health(
    payload: IoTHealthRequest,
    device: IoTDevice = Depends(get_current_iot_device),
    db: Session = Depends(get_db),
):

    try:
        handle_location_event(
            db=db,
            device_id=device.device_id,
            latitude=payload.latitude,
            longitude=payload.longitude,
            rssi=None,
            sos_flag=False,
            heart_rate=payload.heart_rate,
            spo2=payload.spo2,
            temperature=payload.body_temperature,
            fall_detected=False,
            battery_percentage=None,
            battery_voltage=None,
            firmware_version=None,
            device_timestamp=payload.recorded_at,
        )

        return IoTResponse(status="accepted")

    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except (NotFoundError, ForbiddenError) as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ConflictError as e:
        raise HTTPException(status_code=409, detail=str(e))