from fastapi import Depends, HTTPException, status, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.models.user import User
from app.models.iot_device import IoTDevice

# -------------------------
# Security Scheme
# -------------------------
security = HTTPBearer()

# -------------------------
# Database Dependency
# -------------------------
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# -------------------------
# Current User (JWT)
# -------------------------
def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    token = credentials.credentials

    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM]
        )
        email: str | None = payload.get("sub")

        if not email:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload"
            )

    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )

    user = db.query(User).filter(User.email == email).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )

    return user

# -------------------------
# Role Guards
# -------------------------
def require_tourist(
    user: User = Depends(get_current_user)
) -> User:
    if user.role != "tourist":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tourist access required"
        )
    return user


def require_authority(
    user: User = Depends(get_current_user)
) -> User:
    if user.role != "authority":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Authority access required"
        )
    return user

# -------------------------
# IoT Device Authentication
# -------------------------
def get_current_iot_device(
    x_api_key: str = Header(...),
    db: Session = Depends(SessionLocal)
) -> IoTDevice:
    device = (
        db.query(IoTDevice)
        .filter(IoTDevice.api_key == x_api_key)
        .first()
    )

    if not device or device.status != "active":
        raise HTTPException(
            status_code=401,
            detail="Invalid or inactive IoT device"
        )

    return device