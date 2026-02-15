from datetime import datetime
from pydantic import BaseModel


class LocationUpdate(BaseModel):
    latitude: float
    longitude: float


class LocationResponse(BaseModel):
    latitude: float
    longitude: float
    updated_at: datetime

    class Config:
        from_attributes = True
