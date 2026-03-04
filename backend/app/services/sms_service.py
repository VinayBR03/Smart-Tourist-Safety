from typing import Optional
import requests
import time
import random
import re

from app.core.config import settings
from app.core.exceptions import ValidationError, ServiceUnavailableError
from app.core.logging_config import get_correlation_id
from app.utils.logger import get_logger


logger = get_logger(__name__)


SMS_TIMEOUT_SECONDS = 5
MAX_RETRIES = 3
RETRY_BACKOFF_BASE = 2
MAX_BACKOFF_SECONDS = 20

MAX_SMS_LENGTH = 1000
MAX_PHONE_LENGTH = 16

PHONE_REGEX = re.compile(r"^\+?[1-9]\d{6,14}$")


# =========================================================
# Public SMS Sender
# =========================================================

def send_sms(
    *,
    phone: Optional[str],
    message: str,
) -> None:

    if not settings.ENABLE_SMS:
        logger.info(
            "SMS skipped (feature disabled)",
            extra={
                "extra_data": {
                    "phone": phone,
                    "correlation_id": get_correlation_id(),
                }
            },
        )
        return

    if settings.ENVIRONMENT.lower() != "production":
        logger.info(
            "SMS skipped (non-production)",
            extra={
                "extra_data": {
                    "phone": phone,
                    "correlation_id": get_correlation_id(),
                }
            },
        )
        return

    _validate_configuration()
    phone = _validate_phone(phone)
    _validate_message(message)

    payload = {
        "From": settings.SMS_FROM_NUMBER,
        "To": phone,
        "Body": message[:MAX_SMS_LENGTH],
    }

    attempt = 0

    while attempt < MAX_RETRIES:
        try:
            response = requests.post(
                settings.SMS_PROVIDER_URL,
                auth=(settings.SMS_ACCOUNT_SID, settings.SMS_AUTH_TOKEN),
                data=payload,
                timeout=SMS_TIMEOUT_SECONDS,
            )

            if response.status_code not in (200, 201):
                raise ServiceUnavailableError("SMS provider returned error")

            try:
                data = response.json()
                if isinstance(data, dict) and data.get("error"):
                    raise ServiceUnavailableError("SMS provider error")
            except ValueError:
                pass

            logger.info(
                "SMS sent successfully",
                extra={
                    "extra_data": {
                        "phone": phone,
                        "attempt": attempt + 1,
                        "correlation_id": get_correlation_id(),
                    }
                },
            )

            return

        except requests.Timeout:
            attempt += 1
            logger.warning(
                "SMS timeout",
                extra={
                    "extra_data": {
                        "phone": phone,
                        "attempt": attempt,
                        "correlation_id": get_correlation_id(),
                    }
                },
            )

        except requests.RequestException:
            attempt += 1
            logger.warning(
                "SMS network error",
                extra={
                    "extra_data": {
                        "phone": phone,
                        "attempt": attempt,
                        "correlation_id": get_correlation_id(),
                    }
                },
            )

        except Exception:
            logger.exception(
                "Unexpected SMS failure",
                extra={
                    "extra_data": {
                        "phone": phone,
                        "correlation_id": get_correlation_id(),
                    }
                },
            )
            raise ServiceUnavailableError("SMS service unavailable")

        if attempt >= MAX_RETRIES:
            raise ServiceUnavailableError("SMS service unavailable")

        sleep_seconds = min(
            (RETRY_BACKOFF_BASE ** attempt),
            MAX_BACKOFF_SECONDS,
        ) + random.uniform(0, 0.5)

        time.sleep(sleep_seconds)


# =========================================================
# Validation Helpers
# =========================================================

def _validate_configuration() -> None:
    if not all(
        [
            settings.SMS_PROVIDER_URL,
            settings.SMS_ACCOUNT_SID,
            settings.SMS_AUTH_TOKEN,
            settings.SMS_FROM_NUMBER,
        ]
    ):
        raise ServiceUnavailableError("SMS configuration incomplete")


def _validate_phone(phone: Optional[str]) -> str:
    if not phone or not isinstance(phone, str):
        raise ValidationError("Invalid phone number")

    phone = phone.strip()

    if len(phone) > MAX_PHONE_LENGTH:
        raise ValidationError("Invalid phone number")

    if not PHONE_REGEX.match(phone):
        raise ValidationError("Invalid phone number format")

    return phone


def _validate_message(message: str) -> None:
    if not message or not isinstance(message, str):
        raise ValidationError("SMS message required")

    if len(message.strip()) == 0:
        raise ValidationError("SMS message cannot be empty")