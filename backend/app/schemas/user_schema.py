from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import date


# --------------------------------
# User Registration (Public = Tourist Only)
# --------------------------------
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    role: str

    full_name: Optional[str] = None
    phone: Optional[str] = None
    emergency_contact: Optional[str] = None

    blood_group: Optional[str] = None
    medical_conditions: Optional[str] = None
    allergies: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    nationality: Optional[str] = None


# --------------------------------
# Login
# --------------------------------
class UserLogin(BaseModel):
    email: EmailStr
    password: str


# --------------------------------
# Basic Tourist Profile (JWT response)
# --------------------------------
class TouristProfile(BaseModel):
    id: int
    email: EmailStr
    role: str

    class Config:
        from_attributes = True
