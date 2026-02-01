from pydantic import BaseModel
from datetime import datetime


class IncidentCreate(BaseModel):
    description: str
    latitude: float
    longitude: float


class IncidentResponse(BaseModel):
    id: int
    description: str
    latitude: float
    longitude: float
    tourist_id: int
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class IncidentStatusUpdate(BaseModel):
    status: str
