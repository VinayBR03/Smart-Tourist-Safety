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
    ChangePasswordRequest,
)

from app.services.auth_service import (
    register_user,
    authenticate_user,
    refresh_access_token,
    revoke_refresh_token,
    change_password,
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

def _user_to_response(user: User) -> dict:
    """Shared serializer — same shape as GET /auth/me"""
    lang = user.preferred_language
    if hasattr(lang, 'value'):
        lang_str = lang.value
    elif isinstance(lang, str):
        lang_str = lang.lower()
    else:
        lang_str = "en"

    return {
        "id":                 user.id,
        "email":              user.email,
        "role":               user.role,
        "is_active":          user.is_active,
        "is_verified":        user.is_verified,
        "full_name":          user.full_name,
        "phone":              user.phone,
        "nationality":        user.nationality,
        "blood_group":        user.blood_group,
        "medical_conditions": user.medical_conditions,
        "allergies":          user.allergies,
        "preferred_language": lang_str,
        "gender":             user.gender,
        "date_of_birth":      str(user.date_of_birth) if user.date_of_birth else None,
        "emergency_contact":  user.emergency_contact,
        "last_login":         user.last_login,
        "created_at":         user.created_at,
        "updated_at":         user.updated_at,
    }

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
    lang = current_user.preferred_language
    if hasattr(lang, 'value'):
        lang_str = lang.value
    elif isinstance(lang, str):
        lang_str = lang.lower()
    else:
        lang_str = "en"

    dob = current_user.date_of_birth
    dob_str = dob.strftime("%Y-%m-%d") if dob else None
    return {
        "id":                 current_user.id,
        "email":              current_user.email,
        "role":               current_user.role,
        "is_active":          current_user.is_active,
        "is_verified":        current_user.is_verified,
        "full_name":          current_user.full_name,
        "phone":              current_user.phone,
        "gender":             current_user.gender,
        "date_of_birth":      dob_str,
        "nationality":        current_user.nationality,
        "emergency_contact":  current_user.emergency_contact,
        "blood_group":        current_user.blood_group,
        "medical_conditions": current_user.medical_conditions,
        "allergies":          current_user.allergies,
        "preferred_language": lang_str,
        "last_login":         current_user.last_login,
        "created_at":         current_user.created_at,
        "updated_at":         current_user.updated_at,
    }

# =========================================================
# Change Password
# =========================================================

@router.post(
    "/change-password",
    status_code=status.HTTP_204_NO_CONTENT,
)
def change_password_endpoint(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        change_password(
            db=db,
            user_id=current_user.id,
            current_password=payload.current_password,
            new_password=payload.new_password,
        )
        db.commit()
        return

    except UnauthorizedError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
        )

    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )