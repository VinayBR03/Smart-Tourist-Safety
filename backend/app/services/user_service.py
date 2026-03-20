from sqlalchemy.orm import Session
from sqlalchemy import select

from app.models.user import User

from app.core.enums import (
    UserRole,
    AuditAction,
    EntityType
)

from app.core.exceptions import (
    NotFoundError,
    ValidationError,
    ConflictError
)

from app.core.security import hash_password

from app.services.audit_service import create_audit_log



# =========================================================
# Get All Users
# =========================================================

def get_all_users(db: Session):

    stmt = (
        select(User)
        .where(User.deleted_at.is_(None))
        .order_by(User.created_at.desc())
    )

    users = db.execute(stmt).scalars().all()

    return users



# =========================================================
# Get User By ID
# =========================================================

def get_user_by_id(
    db: Session,
    user_id: int
):

    stmt = (
        select(User)
        .where(
            User.id == user_id,
            User.deleted_at.is_(None)
        )
    )

    user = db.execute(stmt).scalar_one_or_none()

    if not user:
        raise NotFoundError("User")

    return user



# =========================================================
# Create Authority User
# =========================================================

def create_authority_user(
    db: Session,
    *,
    email: str,
    password: str,
    name: str
):

    email = email.strip().lower()

    if not email:
        raise ValidationError("Email required")

    if len(password) < 8:
        raise ValidationError("Password must be at least 8 characters")


    # -----------------------------------------------------
    # Check existing
    # -----------------------------------------------------

    existing = (
        db.query(User)
        .filter(
            User.email == email,
            User.deleted_at.is_(None)
        )
        .first()
    )

    if existing:
        raise ConflictError("Email already registered")


    # -----------------------------------------------------
    # Create authority
    # -----------------------------------------------------

    password_hash = hash_password(password)

    user = User(
        email=email,
        password_hash=password_hash,
        full_name=name,
        role=UserRole.AUTHORITY,
        is_active=True,
        is_verified=True
    )

    db.add(user)
    db.flush()


    # -----------------------------------------------------
    # Audit
    # -----------------------------------------------------

    create_audit_log(
        db=db,
        user_id=user.id,
        action=AuditAction.CREATE_USER,
        entity_type=EntityType.USER,
        entity_id=user.id
    )


    return user



# =========================================================
# Update User Status
# =========================================================

def update_user_status(
    db: Session,
    *,
    user_id: int,
    is_active: bool
):

    user = (
        db.query(User)
        .filter(
            User.id == user_id,
            User.deleted_at.is_(None)
        )
        .first()
    )

    if not user:
        raise NotFoundError("User")

    user.is_active = is_active

    db.flush()


    # -----------------------------------------------------
    # Audit
    # -----------------------------------------------------

    create_audit_log(
        db=db,
        user_id=user.id,
        action=AuditAction.UPDATE_PROFILE,
        entity_type=EntityType.USER,
        entity_id=user.id
    )

    return user