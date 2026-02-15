from sqlalchemy.orm import Session
from fastapi import HTTPException
from typing import List
from datetime import date, datetime, timedelta

from app.models.user import User
from app.models.location_event import LocationEvent
from app.core.websocket_manager import manager
from app.utils.helpers import hash_password


# =========================================================
# 🔵 Activity Status Logic
# =========================================================
def _calculate_activity_status(last_seen: datetime | None) -> str:
    """
    Determines tourist activity status based on last location event.
    """

    if not last_seen:
        return "offline"

    now = datetime.utcnow()
    diff = now - last_seen

    if diff <= timedelta(minutes=5):
        return "active"
    elif diff <= timedelta(minutes=15):
        return "delayed"
    else:
        return "offline"


def _attach_activity_status(db: Session, tourist: User) -> User:
    """
    Fetch latest location event and attach dynamic activity_status attribute.
    """

    last_event = (
        db.query(LocationEvent)
        .filter(LocationEvent.tourist_id == tourist.id)
        .order_by(LocationEvent.timestamp.desc())
        .first()
    )

    last_seen = last_event.timestamp if last_event else None
    tourist.activity_status = _calculate_activity_status(last_seen)

    return tourist


# =========================================================
# 🟢 Create Tourist
# =========================================================
async def create_tourist(
    db: Session,
    email: str,
    password: str,
    full_name: str | None = None,
    phone: str | None = None,
    emergency_contact: str | None = None,
    blood_group: str | None = None,
    medical_conditions: str | None = None,
    allergies: str | None = None,
    date_of_birth: date | None = None,
    gender: str | None = None,
    nationality: str | None = None,
) -> User:

    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    tourist = User(
        email=email,
        password=hash_password(password),
        role="tourist",
        full_name=full_name,
        phone=phone,
        emergency_contact=emergency_contact,
        blood_group=blood_group,
        medical_conditions=medical_conditions,
        allergies=allergies,
        date_of_birth=date_of_birth,
        gender=gender,
        nationality=nationality,
    )

    db.add(tourist)
    db.commit()
    db.refresh(tourist)

    # Attach activity status
    tourist = _attach_activity_status(db, tourist)

    # 🔴 WebSocket broadcast
    await manager.broadcast({
        "type": "tourist_created",
        "data": {
            "id": tourist.id,
            "email": tourist.email,
            "full_name": tourist.full_name,
            "phone": tourist.phone,
            "emergency_contact": tourist.emergency_contact,
            "blood_group": tourist.blood_group,
            "medical_conditions": tourist.medical_conditions,
            "allergies": tourist.allergies,
            "date_of_birth": str(tourist.date_of_birth) if tourist.date_of_birth else None,
            "gender": tourist.gender,
            "nationality": tourist.nationality,
            "activity_status": tourist.activity_status,
        }
    })

    return tourist


# =========================================================
# 🟡 Get All Tourists (Authority)
# =========================================================
def get_all_tourists(db: Session) -> List[User]:

    tourists = (
        db.query(User)
        .filter(User.role == "tourist")
        .order_by(User.id.desc())
        .all()
    )

    return [_attach_activity_status(db, t) for t in tourists]


# =========================================================
# 🔵 Get Tourist By ID
# =========================================================
def get_tourist_by_id(db: Session, tourist_id: int) -> User:

    tourist = (
        db.query(User)
        .filter(User.id == tourist_id, User.role == "tourist")
        .first()
    )

    if not tourist:
        raise HTTPException(status_code=404, detail="Tourist not found")

    return _attach_activity_status(db, tourist)


# =========================================================
# 🟣 Update Tourist Profile
# =========================================================
async def update_tourist_profile(
    db: Session,
    tourist_id: int,
    full_name: str | None = None,
    phone: str | None = None,
    emergency_contact: str | None = None,
    blood_group: str | None = None,
    medical_conditions: str | None = None,
    allergies: str | None = None,
    date_of_birth: date | None = None,
    gender: str | None = None,
    nationality: str | None = None,
) -> User:

    tourist = get_tourist_by_id(db, tourist_id)

    if full_name is not None:
        tourist.full_name = full_name
    if phone is not None:
        tourist.phone = phone
    if emergency_contact is not None:
        tourist.emergency_contact = emergency_contact
    if blood_group is not None:
        tourist.blood_group = blood_group
    if medical_conditions is not None:
        tourist.medical_conditions = medical_conditions
    if allergies is not None:
        tourist.allergies = allergies
    if date_of_birth is not None:
        tourist.date_of_birth = date_of_birth
    if gender is not None:
        tourist.gender = gender
    if nationality is not None:
        tourist.nationality = nationality

    db.commit()
    db.refresh(tourist)

    tourist = _attach_activity_status(db, tourist)

    # 🔴 WebSocket broadcast
    await manager.broadcast({
        "type": "tourist_updated",
        "data": {
            "id": tourist.id,
            "full_name": tourist.full_name,
            "phone": tourist.phone,
            "emergency_contact": tourist.emergency_contact,
            "blood_group": tourist.blood_group,
            "medical_conditions": tourist.medical_conditions,
            "allergies": tourist.allergies,
            "date_of_birth": str(tourist.date_of_birth) if tourist.date_of_birth else None,
            "gender": tourist.gender,
            "nationality": tourist.nationality,
            "activity_status": tourist.activity_status,
        }
    })

    return tourist
