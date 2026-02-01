from datetime import datetime
from pydantic import BaseModel


class ZoneStatusResponse(BaseModel):
    zone_id: int
    risk_level: str
    risk_score: float
    updated_at: datetime

    class Config:
        from_attributes = True
