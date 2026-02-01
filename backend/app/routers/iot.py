from fastapi import APIRouter, Depends, Header, HTTPException
from datetime import datetime
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_current_iot_device
from app.schemas.location_event_schema import LocationEventCreate
from app.schemas.iot_schema import IoTHeartbeat, IoTSOS
from app.models.location_event import LocationEvent
from app.models.iot_device import IoTDevice

router = APIRouter(prefix="/iot", tags=["IoT"])


@router.post("/location")
def ingest_location(
    data: LocationEventCreate,
    db: Session = Depends(get_db),
    device: IoTDevice = Depends(get_current_iot_device)
):
    event = LocationEvent(
        **data.model_dump(exclude_unset=True),
        device_id=device.device_id
    )
    db.add(event)
    db.commit()
    return {"status": "location_event_saved"}


@router.post("/heartbeat")
def heartbeat(
    data: IoTHeartbeat,
    local_kw: str,
    db: Session = Depends(get_db),
    x_api_key: str = Header(...)
):
    device = db.query(IoTDevice).filter(
        IoTDevice.device_id == data.device_id,
        IoTDevice.api_key == x_api_key
    ).first()

    if not device:
        raise HTTPException(status_code=401, detail="Invalid device or API key")

    device.status = data.status
    device.last_seen = datetime.utcnow()   # ✅ REQUIRED
    db.commit()

    return {
        "message": "heartbeat received",
        "device_id": device.device_id,
        "last_seen": device.last_seen
    }


@router.post("/sos")
def sos_event(
    data: IoTSOS,
    db: Session = Depends(get_db),
    device: IoTDevice = Depends(get_current_iot_device)
):
    event = LocationEvent(
        tourist_id=data.tourist_id,
        device_id=device.device_id,
        source="SOS",
        sos_flag=True
    )
    db.add(event)
    db.commit()
    return {"status": "sos_recorded"}
