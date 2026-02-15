from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.dependencies import get_db, require_tourist, require_authority
from app.models.user import User
from app.schemas.tourist_schema import TouristResponse, TouristUpdate
from app.services.tourist_service import (
    update_tourist_profile,
    get_all_tourists,
    get_tourist_by_id,
)

router = APIRouter(prefix="/tourists", tags=["Tourists"])


# -----------------------------------
# Tourist: Get Own Profile
# -----------------------------------
@router.get("/me", response_model=TouristResponse)
def get_my_profile(
    user: User = Depends(require_tourist),
):
    return user


# -----------------------------------
# Tourist: Update Own Profile
# -----------------------------------
@router.put("/me", response_model=TouristResponse)
async def update_my_profile(
    data: TouristUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_tourist),
):
    updated_user = await update_tourist_profile(
        db=db,
        tourist_id=user.id,
        full_name=data.full_name,
        phone=data.phone,
        emergency_contact=data.emergency_contact,
        blood_group=data.blood_group,
        medical_conditions=data.medical_conditions,
        allergies=data.allergies,
        date_of_birth=data.date_of_birth,
        gender=data.gender,
        nationality=data.nationality,
    )

    return updated_user


# -----------------------------------
# Authority: List All Tourists
# -----------------------------------
@router.get("/", response_model=List[TouristResponse])
def list_tourists(
    db: Session = Depends(get_db),
    _: User = Depends(require_authority),
):
    return get_all_tourists(db)


# -----------------------------------
# Authority: Get Tourist By ID
# -----------------------------------
@router.get("/{tourist_id}", response_model=TouristResponse)
def get_tourist_by_id_route(
    tourist_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_authority),
):
    tourist = get_tourist_by_id(db, tourist_id)

    if not tourist:
        raise HTTPException(status_code=404, detail="Tourist not found")

    return tourist
