from fastapi import APIRouter
from app.services.notification_service import send_notification

router = APIRouter()

@router.post("/send")
def notify(user_id: int, message: str):
    send_notification(user_id, message)
    return {"status": "sent"}
