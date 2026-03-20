from fastapi import APIRouter, Depends, status, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.config import settings

from app.schemas.auth_schema import (
    RegisterRequest,
    LoginRequest,
    TokenResponse,
    RefreshTokenRequest,
    LogoutRequest,
    AuthenticatedUserResponse,
)

from app.services.auth_service import (
    register_user,
    authenticate_user,
    refresh_access_token,
    revoke_refresh_token,
)

from app.core.dependencies import get_current_user
from app.models.user import User

from app.core.enums import UserRole
from app.core.exceptions import (
    ValidationError,
    UnauthorizedError,
    ForbiddenError,
    ConflictError,
)

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)

# =========================================================
# Register (Tourist Only)
# =========================================================

@router.post(
    "/register",
    response_model=AuthenticatedUserResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(
    payload: RegisterRequest,
    db: Session = Depends(get_db),
):
    try:
        # Only TOURIST allowed
        if payload.role != UserRole.TOURIST:
            raise ForbiddenError("Only tourist registration is allowed.")

        user = register_user(
            db=db,
            email=payload.email,
            password=payload.password,
            role=UserRole.TOURIST,
        )

        return user

    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))

    except ConflictError as e:
        raise HTTPException(status_code=409, detail=str(e))

    except ForbiddenError as e:
        raise HTTPException(status_code=403, detail=str(e))


# =========================================================
# Login
# =========================================================

@router.post(
    "/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
)
def login(
    payload: LoginRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    try:
        access_token, refresh_token = authenticate_user(
            db=db,
            email=payload.email,
            password=payload.password,
            device_info=payload.device_info,
            ip_address=request.client.host,
        )

        db.commit()

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        }

    except UnauthorizedError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials.",
        )

    except ForbiddenError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e),
        )


# =========================================================
# Refresh Token
# =========================================================

@router.post(
    "/refresh",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
)
def refresh_token(
    payload: RefreshTokenRequest,
    db: Session = Depends(get_db),
):
    try:
        access_token, refresh_token = refresh_access_token(
            db=db,
            refresh_token=payload.refresh_token,
        )

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        }

    except UnauthorizedError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token.",
        )


# =========================================================
# Logout
# =========================================================

@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
)
def logout(
    payload: LogoutRequest,
    db: Session = Depends(get_db),
):
    try:
        revoke_refresh_token(
            db=db,
            refresh_token=payload.refresh_token,
        )

        db.commit()

        return

    except UnauthorizedError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid refresh token.",
        )


# =========================================================
# Current User
# =========================================================

@router.get(
    "/me",
    response_model=AuthenticatedUserResponse,
    status_code=status.HTTP_200_OK,
)
def get_me(
    current_user: User = Depends(get_current_user),
):
    return current_user