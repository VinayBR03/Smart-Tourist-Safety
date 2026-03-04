# app/utils/logger.py

import logging
import sys
from logging.handlers import RotatingFileHandler
from typing import Final

from app.core.config import settings


# =========================================================
# Constants
# =========================================================

LOG_LEVEL: Final[str] = settings.LOG_LEVEL if hasattr(settings, "LOG_LEVEL") else "INFO"
LOG_FILE: Final[str] = getattr(settings, "LOG_FILE", "app.log")
MAX_LOG_FILE_SIZE: Final[int] = 10 * 1024 * 1024  # 10MB
BACKUP_COUNT: Final[int] = 5


# =========================================================
# JSON Formatter (Structured Logging)
# =========================================================

class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        log_record = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        if record.exc_info:
            log_record["exception"] = self.formatException(record.exc_info)

        return str(log_record)


# =========================================================
# Logger Setup
# =========================================================

def _create_console_handler() -> logging.Handler:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    return handler


def _create_file_handler() -> logging.Handler:
    handler = RotatingFileHandler(
        LOG_FILE,
        maxBytes=MAX_LOG_FILE_SIZE,
        backupCount=BACKUP_COUNT,
    )
    handler.setFormatter(JsonFormatter())
    return handler


def get_logger(name: str) -> logging.Logger:
    logger = logging.getLogger(name)

    if logger.handlers:
        return logger  # Prevent duplicate handlers

    logger.setLevel(LOG_LEVEL)

    logger.addHandler(_create_console_handler())
    logger.addHandler(_create_file_handler())

    logger.propagate = False

    return logger