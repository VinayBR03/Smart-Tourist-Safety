from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.dependencies import get_db, require_tourist, require_authority
from app.models.user import User
from app.schemas.tourist_schema import TouristResponse, TouristUpdate
from app.services.tourist_service import update_tourist_profile

router = APIRouter(prefix="/tourists", tags=["Tourists"])


# -------------------------
# Tourist: Get Own Profile
# -------------------------
@router.get("/me", response_model=TouristResponse)
def get_my_profile(
    user: User = Depends(require_tourist)
):
    return user


# -------------------------
# Tourist: Update Own Profile
# -------------------------
@router.put("/me", response_model=TouristResponse)
def update_my_profile(
    data: TouristUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_tourist)
):
    return update_tourist_profile(db, user, data)


# -------------------------
# Authority: List Tourists
# -------------------------
@router.get("/", response_model=list[TouristResponse])
def list_tourists(
    db: Session = Depends(get_db),
    _: User = Depends(require_authority)
):
    return db.query(User).filter(User.role == "tourist").all()


# -------------------------
# Authority: Get Tourist by ID
# -------------------------
@router.get("/{tourist_id}", response_model=TouristResponse)
def get_tourist_by_id(
    tourist_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_authority)
):
    tourist = (
        db.query(User)
        .filter(User.id == tourist_id, User.role == "tourist")
        .first()
    )

    if not tourist:
        raise HTTPException(status_code=404, detail="Tourist not found")

    return tourist
