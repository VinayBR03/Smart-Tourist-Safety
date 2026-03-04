# app/core/middleware.py

import time
import uuid
from typing import Callable

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.exceptions import AppError
from app.core.logging_config import (
    set_correlation_id,
    get_logger,
)
from app.core.config import settings


logger = get_logger(__name__)


class AppMiddleware(BaseHTTPMiddleware):
    """
    Enterprise middleware layer.

    Responsibilities:
    - Correlation ID injection
    - Request timing
    - Structured error translation
    - Centralized exception handling
    """

    async def dispatch(
        self,
        request: Request,
        call_next: Callable,
    ):

        # Skip WebSocket handling
        if request.scope["type"] != "http":
            return await call_next(request)

        start_time = time.perf_counter()

        # =========================================================
        # Correlation ID Handling
        # =========================================================

        correlation_id = (
            request.headers.get("X-Correlation-ID")
            or str(uuid.uuid4())
        )

        set_correlation_id(correlation_id)

        try:
            response = await call_next(request)

        # =========================================================
        # Business Errors
        # =========================================================

        except AppError as exc:

            logger.warning(
                "AppError occurred",
                extra={
                    "extra_data": {
                        "error_code": exc.error_code,
                        "path": request.url.path,
                        "method": request.method,
                    }
                },
            )

            return JSONResponse(
                status_code=exc.status_code,
                content=exc.to_dict(),
                headers={"X-Correlation-ID": correlation_id},
            )

        # =========================================================
        # Unhandled Exceptions
        # =========================================================

        except Exception as exc:

            logger.exception(
                "Unhandled exception",
                extra={
                    "extra_data": {
                        "path": request.url.path,
                        "method": request.method,
                    }
                },
            )

            # Show detailed errors only in debug
            if settings.DEBUG:
                message = str(exc)
            else:
                message = "An unexpected error occurred"

            return JSONResponse(
                status_code=500,
                content={
                    "error": "INTERNAL_ERROR",
                    "message": message,
                },
                headers={"X-Correlation-ID": correlation_id},
            )

        # =========================================================
        # Request Logging
        # =========================================================

        duration_ms = int((time.perf_counter() - start_time) * 1000)

        logger.info(
            "Request completed",
            extra={
                "extra_data": {
                    "method": request.method,
                    "path": request.url.path,
                    "status_code": response.status_code,
                    "duration_ms": duration_ms,
                }
            },
        )

        response.headers["X-Correlation-ID"] = correlation_id

        return response