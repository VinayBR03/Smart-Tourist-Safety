# app/core/logging_config.py

import logging
import sys
import json
from datetime import datetime, timezone
from typing import Any, Dict
from contextvars import ContextVar

from app.core.config import settings


# =========================================================
# Correlation ID Context
# =========================================================

correlation_id_ctx: ContextVar[str] = ContextVar(
    "correlation_id",
    default="unknown",
)


def set_correlation_id(correlation_id: str) -> None:
    correlation_id_ctx.set(correlation_id)


def get_correlation_id() -> str:
    return correlation_id_ctx.get()


# =========================================================
# JSON Formatter (Production)
# =========================================================

class JSONFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:

        log_record: Dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "correlation_id": get_correlation_id(),
            "module": record.module,
            "line": record.lineno,
        }

        if record.exc_info:
            log_record["exception"] = self.formatException(record.exc_info)

        # Proper support for logger.info(..., extra={"extra_data": {...}})
        if hasattr(record, "extra_data"):
            log_record["extra"] = record.extra_data

        return json.dumps(log_record)


# =========================================================
# Pretty Formatter (Development)
# =========================================================

class DevFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:

        base = (
            f"[{record.levelname}] "
            f"[{get_correlation_id()}] "
            f"{record.name}:{record.lineno} - "
            f"{record.getMessage()}"
        )

        if record.exc_info:
            base += "\n" + self.formatException(record.exc_info)

        return base


# =========================================================
# Logger Setup
# =========================================================

_logging_initialized = False


def setup_logging() -> None:

    handler = logging.StreamHandler(sys.stdout)

    # Determine level based on environment
    if settings.ENVIRONMENT == "production":
        logging_level = logging.INFO
        formatter = JSONFormatter()
    else:
        logging_level = logging.DEBUG
        formatter = DevFormatter()

    handler.setFormatter(formatter)

    root_logger = logging.getLogger()

    # Reset handlers (important for tests)
    root_logger.handlers.clear()

    root_logger.setLevel(logging_level)

    root_logger.addHandler(handler)


# =========================================================
# Logger Factory
# =========================================================

def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)