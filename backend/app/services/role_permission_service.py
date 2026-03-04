from typing import Iterable, Set
from sqlalchemy.orm import Session

from app.models.user import User
from app.core.enums import UserRole, AuditAction, EntityType
from app.core.exceptions import ValidationError, ForbiddenError
from app.core.logging_config import get_correlation_id
from app.services.audit_service import create_audit_log
from app.utils.logger import get_logger


logger = get_logger(__name__)


# =========================================================
# Internal Helpers
# =========================================================

def _resolve_role_value(role) -> str:
    if isinstance(role, UserRole):
        return role.value
    return role


# =========================================================
# Core Role Enforcement
# =========================================================

def require_role(
    db: Session,
    *,
    user: User,
    allowed_roles: Iterable[UserRole],
) -> None:

    if db is None:
        raise ValidationError("Database session required")

    if not user:
        raise ForbiddenError("Authentication required")

    if user.deleted_at is not None:
        raise ForbiddenError("User account deleted")

    if not user.is_active:
        raise ForbiddenError("Inactive account")

    if not user.role:
        raise ForbiddenError("Invalid user role")

    if not allowed_roles:
        raise ValidationError("Allowed roles cannot be empty")

    allowed_values: Set[str] = set()

    for role in allowed_roles:
        if not isinstance(role, UserRole):
            raise ValidationError("Invalid role in allowed_roles")
        allowed_values.add(role.value)

    user_role_value = _resolve_role_value(user.role)

    if user_role_value not in allowed_values:

        _audit_access_denied(
            db=db,
            user=user,
            required_roles=allowed_values,
            entity_type=EntityType.SYSTEM,
            entity_id=None,
        )

        raise ForbiddenError("Access denied")


# =========================================================
# Common Role Shortcuts
# =========================================================

def require_admin(
    db: Session,
    *,
    user: User,
) -> None:

    require_role(
        db=db,
        user=user,
        allowed_roles=[UserRole.ADMIN],
    )


def require_authority_or_admin(
    db: Session,
    *,
    user: User,
) -> None:

    require_role(
        db=db,
        user=user,
        allowed_roles=[
            UserRole.AUTHORITY,
            UserRole.ADMIN,
        ],
    )


def require_tourist(
    db: Session,
    *,
    user: User,
) -> None:

    require_role(
        db=db,
        user=user,
        allowed_roles=[UserRole.TOURIST],
    )


# =========================================================
# Ownership Enforcement
# =========================================================

def require_self_or_admin(
    db: Session,
    *,
    current_user: User,
    target_user_id: int,
) -> None:

    if db is None:
        raise ValidationError("Database session required")

    if not current_user:
        raise ForbiddenError("Authentication required")

    if current_user.deleted_at is not None:
        raise ForbiddenError("User account deleted")

    if not current_user.is_active:
        raise ForbiddenError("Inactive account")

    if not current_user.role:
        raise ForbiddenError("Invalid user role")

    user_role_value = _resolve_role_value(current_user.role)

    if user_role_value == UserRole.ADMIN.value:
        return

    if current_user.id != target_user_id:

        _audit_access_denied(
            db=db,
            user=current_user,
            required_roles={UserRole.ADMIN.value},
            entity_type=EntityType.USER,
            entity_id=target_user_id,
        )

        raise ForbiddenError("Access denied")


# =========================================================
# Internal Audit Helper
# =========================================================

def _audit_access_denied(
    *,
    db: Session,
    user: User,
    required_roles: Set[str],
    entity_type: EntityType,
    entity_id: int | None,
) -> None:

    create_audit_log(
        db=db,
        user_id=user.id,
        action=AuditAction.ACCESS_DENIED,
        entity_type=entity_type,
        entity_id=entity_id,
        new_value={
            "required_roles": sorted(list(required_roles)),
            "actual_role": _resolve_role_value(user.role),
        },
    )

    logger.warning(
        "RBAC violation",
        extra={
            "extra_data": {
                "user_id": user.id,
                "actual_role": _resolve_role_value(user.role),
                "required_roles": sorted(list(required_roles)),
                "correlation_id": get_correlation_id(),
            }
        },
    )