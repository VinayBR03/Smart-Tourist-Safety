from sqlalchemy.orm import Session
from app.models.user import User

def update_tourist_profile(
    db: Session,
    user: User,
    data
):
    if data.full_name is not None:
        user.full_name = data.full_name
    if data.phone is not None:
        user.phone = data.phone
    if data.emergency_contact is not None:
        user.emergency_contact = data.emergency_contact

    db.commit()
    db.refresh(user)
    return user
