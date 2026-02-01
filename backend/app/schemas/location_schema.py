from pydantic import BaseModel

class LocationUpdate(BaseModel):
    latitude: float
    longitude: float
