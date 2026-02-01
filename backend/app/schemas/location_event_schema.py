from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class LocationEventCreate(BaseModel):
    """
    Schema used by IoT ingestion endpoints (/iot/location)
    """

    tourist_id: Optional[int] = Field(
        default=None,
        description="Tourist ID if identified, else null"
    )

    device_id: str = Field(
        ...,
        description="ESP32 or gateway device identifier"
    )

    zone_id: Optional[int] = Field(
        default=None,
        description="Zone or geofence ID"
    )

    rssi: Optional[float] = Field(
        default=None,
        description="BLE RSSI value"
    )

    latitude: Optional[float] = Field(
        default=None,
        description="GNSS latitude"
    )

    longitude: Optional[float] = Field(
        default=None,
        description="GNSS longitude"
    )

    source: str = Field(
        ...,
        description="Data source: BLE / RFID / GNSS"
    )

    sos_flag: bool = Field(
        default=False,
        description="SOS triggered or not"
    )

    timestamp: Optional[datetime] = Field(
        default=None,
        description="Event time (server fills if missing)"
    )


class LocationEventResponse(BaseModel):
    """
    Schema used for responses / admin dashboards
    """

    id: int
    tourist_id: Optional[int]
    device_id: str
    zone_id: Optional[int]
    rssi: Optional[float]
    latitude: Optional[float]
    longitude: Optional[float]
    source: str
    sos_flag: bool
    timestamp: datetime

    class Config:
        from_attributes = True
