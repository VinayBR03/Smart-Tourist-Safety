from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import date


class TouristResponse(BaseModel):
    id: int
    email: EmailStr
    role:str

    full_name: Optional[str]
    phone: Optional[str]
    emergency_contact: Optional[str]

    blood_group: Optional[str]
    medical_conditions: Optional[str]
    allergies: Optional[str]
    date_of_birth: Optional[date]
    gender: Optional[str]
    nationality: Optional[str]

    # 🔥 NEW FIELD
    activity_status: Optional[str] = None

    class Config:
        from_attributes = True


class TouristUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    emergency_contact: Optional[str] = None
    blood_group: Optional[str] = None
    medical_conditions: Optional[str] = None
    allergies: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    nationality: Optional[str] = None
