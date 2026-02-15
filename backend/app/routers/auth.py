from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.dependencies import get_db
from app.schemas.user_schema import UserCreate, UserLogin
from app.services.auth_service import create_user, authenticate
from app.utils.jwt import create_token

router = APIRouter()

@router.post("/register")
def register(data: UserCreate, db: Session = Depends(get_db)):
    user = create_user(db, data.email, data.password, data.role, full_name=data.full_name, phone=data.phone, emergency_contact=data.emergency_contact, blood_group=data.blood_group, medical_conditions=data.medical_conditions, allergies=data.allergies, date_of_birth=data.date_of_birth, gender=data.gender, nationality=data.nationality)
    return {"id": user.id, "email": user.email}

@router.post("/login")
def login(data: UserLogin, db: Session = Depends(get_db)):
    user = authenticate(db, data.email, data.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_token({
        "sub": user.email,
        "role": user.role
    })
    return {"access_token": token}
