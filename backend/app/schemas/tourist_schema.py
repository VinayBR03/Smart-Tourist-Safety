from pydantic import BaseModel
from typing import Optional

class TouristResponse(BaseModel):
    id: int
    email: str
    full_name: Optional[str]
    phone: Optional[str]
    emergency_contact: Optional[str]

    class Config:
        from_attributes = True


class TouristUpdate(BaseModel):
    full_name: Optional[str]
    phone: Optional[str]
    emergency_contact: Optional[str]
