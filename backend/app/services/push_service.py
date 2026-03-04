import requests
import time
import random
from typing import Optional

from app.core.config import settings
from app.core.exceptions import ValidationError, ServiceUnavailableError
from app.core.logging_config import get_correlation_id
from app.utils.logger import get_logger


logger = get_logger(__name__)


FCM_TIMEOUT_SECONDS = 5
MAX_RETRIES = 3
RETRY_BACKOFF_BASE = 2
MAX_BACKOFF_SECONDS = 20  # 🔒 cap growth

MAX_TITLE_LENGTH = 120
MAX_BODY_LENGTH = 500
MAX_DEVICE_TOKEN_LENGTH = 2048


# =========================================================
# Public Push Sender
# =========================================================

def send_push(
    *,
    user_id: int,
    title: str,
    body: str,
    device_token: Optional[str] = None,
) -> None:

    if not settings.ENABLE_PUSH:
        logger.info(
            "Push skipped (feature disabled)",
            extra={
                "extra_data": {
                    "user_id": user_id,
                    "correlation_id": get_correlation_id(),
                }
            },
        )
        return

    if settings.ENVIRONMENT.lower() != "production":
        logger.info(
            "Push skipped (non-production)",
            extra={
                "extra_data": {
                    "user_id": user_id,
                    "correlation_id": get_correlation_id(),
                }
            },
        )
        return

    _validate_configuration()
    device_token = _validate_inputs(user_id, title, body, device_token)

    payload = {
        "to": device_token,
        "notification": {
            "title": title[:MAX_TITLE_LENGTH],
            "body": body[:MAX_BODY_LENGTH],
        },
        "priority": "high",
    }

    headers = {
        "Authorization": f"key={settings.FCM_SERVER_KEY}",
        "Content-Type": "application/json",
    }

    attempt = 0

    while attempt < MAX_RETRIES:
        try:
            response = requests.post(
                settings.FCM_SEND_URL,
                json=payload,
                headers=headers,
                timeout=FCM_TIMEOUT_SECONDS,
            )

            if response.status_code == 200:
                try:
                    data = response.json()
                    if data.get("failure"):
                        raise ServiceUnavailableError("Push rejected by provider")
                except ValueError:
                    raise ServiceUnavailableError("Invalid push provider response")

                logger.info(
                    "Push sent successfully",
                    extra={
                        "extra_data": {
                            "user_id": user_id,
                            "attempt": attempt + 1,
                            "correlation_id": get_correlation_id(),
                        }
                    },
                )
                return

            if 400 <= response.status_code < 500:
                logger.warning(
                    "Push rejected by FCM (client error)",
                    extra={
                        "extra_data": {
                            "user_id": user_id,
                            "status_code": response.status_code,
                            "correlation_id": get_correlation_id(),
                        }
                    },
                )
                raise ServiceUnavailableError("Push rejected by provider")

            raise requests.RequestException("FCM server error")

        except requests.Timeout:
            attempt += 1
            logger.warning(
                "Push timeout",
                extra={
                    "extra_data": {
                        "user_id": user_id,
                        "attempt": attempt,
                        "correlation_id": get_correlation_id(),
                    }
                },
            )

        except requests.RequestException:
            attempt += 1
            logger.warning(
                "Push network/server error",
                extra={
                    "extra_data": {
                        "user_id": user_id,
                        "attempt": attempt,
                        "correlation_id": get_correlation_id(),
                    }
                },
            )

        except Exception:
            logger.exception(
                "Unexpected push failure",
                extra={
                    "extra_data": {
                        "user_id": user_id,
                        "correlation_id": get_correlation_id(),
                    }
                },
            )
            raise ServiceUnavailableError("Push service unavailable")

        if attempt >= MAX_RETRIES:
            raise ServiceUnavailableError("Push service unavailable")

        sleep_seconds = min(
            (RETRY_BACKOFF_BASE ** attempt),
            MAX_BACKOFF_SECONDS,
        ) + random.uniform(0, 0.5)

        time.sleep(sleep_seconds)


# =========================================================
# Validation Helpers
# =========================================================

def _validate_configuration() -> None:
    if not settings.FCM_SERVER_KEY or not settings.FCM_SEND_URL:
        raise ServiceUnavailableError("Push configuration incomplete")


def _validate_inputs(
    user_id: int,
    title: str,
    body: str,
    device_token: Optional[str],
) -> str:

    if not isinstance(user_id, int) or user_id <= 0:
        raise ValidationError("Invalid user_id")

    if not device_token or not isinstance(device_token, str):
        raise ValidationError("Device token required")

    device_token = device_token.strip()

    if not device_token:
        raise ValidationError("Device token required")

    if len(device_token) > MAX_DEVICE_TOKEN_LENGTH:
        raise ValidationError("Device token too long")

    if not title or not isinstance(title, str):
        raise ValidationError("Push title required")

    if not body or not isinstance(body, str):
        raise ValidationError("Push body required")

    return device_token