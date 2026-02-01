from pydantic import BaseModel, Field


class IoTHeartbeat(BaseModel):
    device_id: str = Field(..., description="ESP32 device ID")
    status: str = Field(..., description="active / inactive")


class IoTSOS(BaseModel):
    device_id: str
    tourist_id: int | None = None
    message: str | None = None
