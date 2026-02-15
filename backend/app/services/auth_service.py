from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException
from datetime import datetime
from typing import Optional

from app.models.user import User
from app.utils.helpers import hash_password, verify_password


# --------------------------------
# Create User (Register)
# --------------------------------
def create_user(
    db: Session,
    email: str,
    password: str,
    role: str,
    full_name: Optional[str] = None,
    phone: Optional[str] = None,
    emergency_contact: Optional[str] = None,
    blood_group: Optional[str] = None,
    medical_conditions: Optional[str] = None,
    allergies: Optional[str] = None,
    date_of_birth: Optional[str] = None,
    gender: Optional[str] = None,
    nationality: Optional[str] = None,
):
    try:
        # Convert date string → date object if provided
        dob_value = None
        if date_of_birth:
            dob_value = datetime.strptime(date_of_birth, "%Y-%m-%d").date()

        user = User(
            email=email,
            password=hash_password(password),
            role=role,
            full_name=full_name,
            phone=phone,
            emergency_contact=emergency_contact,
            blood_group=blood_group,
            medical_conditions=medical_conditions,
            allergies=allergies,
            date_of_birth=dob_value,
            gender=gender,
            nationality=nationality,
        )

        db.add(user)
        db.commit()
        db.refresh(user)

        return user

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Email already registered"
        )


# --------------------------------
# Authenticate User (Login)
# --------------------------------
def authenticate(db: Session, email: str, password: str):

    user = db.query(User).filter(User.email == email).first()

    if not user:
        return None

    if not verify_password(password, user.password):
        return None

    return user
