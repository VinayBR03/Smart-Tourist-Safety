# app/core/exceptions.py

from typing import Optional, Dict, Any


class AppError(Exception):
    """
    Base application exception.
    Raised inside services.
    Translated to HTTP response in middleware layer.
    """

    def __init__(
        self,
        *,
        message: str,
        error_code: str,
        status_code: int = 400,
        details: Optional[Dict[str, Any]] = None,
    ):
        self.message = message
        self.error_code = error_code
        self.status_code = status_code
        self.details = details or {}
        super().__init__(message)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "error": self.error_code,
            "message": self.message,
            "details": self.details,
        }


# =========================================================
# Authentication & Authorization
# =========================================================

class UnauthorizedError(AppError):
    def __init__(self, message: str = "Invalid credentials"):
        super().__init__(
            message=message,
            error_code="AUTH_UNAUTHORIZED",
            status_code=401,
        )


class ForbiddenError(AppError):
    def __init__(self, message: str = "Access denied"):
        super().__init__(
            message=message,
            error_code="AUTH_FORBIDDEN",
            status_code=403,
        )


# =========================================================
# Resource Errors
# =========================================================

class NotFoundError(AppError):
    def __init__(self, resource: str = "Resource"):
        super().__init__(
            message=f"{resource} not found",
            error_code="RESOURCE_NOT_FOUND",
            status_code=404,
        )


class ConflictError(AppError):
    def __init__(self, message: str):
        super().__init__(
            message=message,
            error_code="RESOURCE_CONFLICT",
            status_code=409,
        )


# =========================================================
# Validation
# =========================================================

class ValidationError(AppError):
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            error_code="VALIDATION_ERROR",
            status_code=422,
            details=details,
        )


# =========================================================
# Infrastructure
# =========================================================

class ServiceUnavailableError(AppError):
    def __init__(self, message: str = "Service unavailable"):
        super().__init__(
            message=message,
            error_code="SERVICE_UNAVAILABLE",
            status_code=503,
        )


class InternalServerError(AppError):
    def __init__(self, message: str = "Internal server error"):
        super().__init__(
            message=message,
            error_code="INTERNAL_ERROR",
            status_code=500,
        )