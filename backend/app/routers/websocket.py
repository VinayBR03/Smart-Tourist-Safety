from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token
from app.core.enums import UserRole
from app.models.user import User
from app.core.websocket_manager import websocket_manager
from app.utils.logger import get_logger


router = APIRouter(tags=["WebSocket"])
logger = get_logger(__name__)


# =========================================================
# Authentication Helper
# =========================================================

def authenticate_websocket(token: str, db: Session) -> User:

    if not token:
        raise Exception("Missing token")

    payload = decode_access_token(token)

    user_id = payload.get("sub")
    role = payload.get("role")
    token_version = payload.get("token_version")

    if user_id is None or role is None or token_version is None:
        raise Exception("Invalid token payload")

    user = db.query(User).filter(User.id == int(user_id)).first()

    if not user:
        raise Exception("User not found")

    if not user.is_active:
        raise Exception("User inactive")

    if not user.is_verified:
        raise Exception("User not verified")

    if user.deleted_at is not None:
        raise Exception("User deleted")

    if user.token_version != token_version:
        raise Exception("Session invalidated")

    if user.role.value != role:
        raise Exception("Role mismatch")

    return user


# =========================================================
# Tourist Notification Socket
# =========================================================

@router.websocket("/ws/notifications")
async def notification_socket(
    websocket: WebSocket,
    db: Session = Depends(get_db),
):

    token = websocket.query_params.get("token")

    # 🔐 Authenticate BEFORE accept (important for tests)
    try:
        user = authenticate_websocket(token, db)
    except Exception:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    # ✅ Accept only if authenticated
    await websocket.accept()

    await websocket_manager.connect(
        user_id=user.id,
        role=user.role.value,
        websocket=websocket,
    )

    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await websocket_manager.disconnect(websocket)


# =========================================================
# Authority Live Dashboard Socket
# =========================================================

@router.websocket("/ws/authority/live")
async def authority_socket(
    websocket: WebSocket,
    db: Session = Depends(get_db),
):

    token = websocket.query_params.get("token")

    try:
        user = authenticate_websocket(token, db)

        if user.role not in (UserRole.AUTHORITY, UserRole.ADMIN):
            raise Exception("Unauthorized role")

    except Exception:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await websocket.accept()

    await websocket_manager.connect(
        user_id=user.id,
        role=user.role.value,
        websocket=websocket,
    )

    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await websocket_manager.disconnect(websocket)