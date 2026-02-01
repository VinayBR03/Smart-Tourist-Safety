from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.dependencies import get_db, require_tourist
from app.schemas.location_schema import LocationUpdate
from app.models.location import Location
from app.models.user import User

router = APIRouter()

@router.post("/update")
def update_location(
    data: LocationUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_tourist)
):
    location = Location(
        latitude=data.latitude,
        longitude=data.longitude,
        tourist_id=user.id
    )
    db.add(location)
    db.commit()
    return {"status": "location updated"}
