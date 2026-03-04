import smtplib
import ssl
import re
import time
import uuid
import random
from email.message import EmailMessage
from typing import Optional, List, Tuple
from contextlib import contextmanager

from app.core.config import settings
from app.core.exceptions import ValidationError, ServiceUnavailableError
from app.core.logging_config import get_correlation_id
from app.utils.logger import get_logger


logger = get_logger(__name__)


EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

SMTP_TIMEOUT_SECONDS = 10
MAX_RETRIES = 3
RETRY_BACKOFF_BASE = 2
MAX_BACKOFF_SECONDS = 30  # 🔒 cap exponential growth

MAX_ATTACHMENT_SIZE_BYTES = 10_000_000
MAX_TOTAL_ATTACHMENT_SIZE_BYTES = 25_000_000
MAX_BODY_SIZE_BYTES = 1_000_000  # 🔒 1MB body cap


# =========================================================
# Validation
# =========================================================

def _validate_email(email: str) -> None:
    if not email or not isinstance(email, str):
        raise ValidationError("Invalid email format")

    email = email.strip().lower()

    if not EMAIL_REGEX.match(email):
        raise ValidationError("Invalid email format")


def _sanitize_subject(subject: str) -> str:
    if not subject or not isinstance(subject, str):
        raise ValidationError("Invalid email subject")

    if "\n" in subject or "\r" in subject:
        raise ValidationError("Invalid email subject")

    return subject.strip()[:255]


def _validate_body_size(body: Optional[str]) -> None:
    if body and len(body.encode("utf-8")) > MAX_BODY_SIZE_BYTES:
        raise ValidationError("Email body too large")


def _validate_attachments(
    attachments: Optional[List[Tuple[str, bytes, str]]]
) -> None:
    if not attachments:
        return

    total_size = 0

    for filename, content, mime_type in attachments:
        if not filename or not isinstance(filename, str):
            raise ValidationError("Invalid attachment filename")

        if not isinstance(content, (bytes, bytearray)):
            raise ValidationError("Attachment content must be bytes")

        if not mime_type or "/" not in mime_type:
            raise ValidationError("Invalid attachment MIME type")

        size = len(content)

        if size > MAX_ATTACHMENT_SIZE_BYTES:
            raise ValidationError("Attachment exceeds maximum allowed size")

        total_size += size

    if total_size > MAX_TOTAL_ATTACHMENT_SIZE_BYTES:
        raise ValidationError("Total attachment size exceeds limit")


# =========================================================
# SMTP Connection Context Manager
# =========================================================

@contextmanager
def _smtp_connection():
    server = None
    try:
        if not settings.SMTP_HOST:
            raise ServiceUnavailableError("SMTP not configured")

        if settings.SMTP_PORT == 465:
            context = ssl.create_default_context()
            server = smtplib.SMTP_SSL(
                settings.SMTP_HOST,
                settings.SMTP_PORT,
                context=context,
                timeout=SMTP_TIMEOUT_SECONDS,
            )
        else:
            server = smtplib.SMTP(
                settings.SMTP_HOST,
                settings.SMTP_PORT,
                timeout=SMTP_TIMEOUT_SECONDS,
            )
            server.ehlo()

            if settings.SMTP_USE_TLS:
                server.starttls(context=ssl.create_default_context())
                server.ehlo()

        if settings.SMTP_USER and settings.SMTP_PASSWORD:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)

        yield server

    finally:
        if server:
            try:
                server.quit()
            except Exception:
                pass


# =========================================================
# Secure Message Builder
# =========================================================

def _build_message(
    *,
    to: str,
    subject: str,
    body: str,
    html_body: Optional[str] = None,
    attachments: Optional[List[Tuple[str, bytes, str]]] = None,
) -> EmailMessage:

    if not settings.SMTP_FROM:
        raise ServiceUnavailableError("SMTP_FROM not configured")

    msg = EmailMessage()

    msg["From"] = settings.SMTP_FROM
    msg["To"] = to
    msg["Subject"] = _sanitize_subject(subject)
    msg["Message-ID"] = f"<{uuid.uuid4()}@{settings.SMTP_HOST}>"

    msg.set_content(body or "")

    if html_body:
        msg.add_alternative(html_body, subtype="html")

    if attachments:
        for filename, content, mime_type in attachments:
            maintype, subtype = mime_type.split("/", 1)
            msg.add_attachment(
                content,
                maintype=maintype,
                subtype=subtype,
                filename=filename,
            )

    return msg


# =========================================================
# Public Sender
# =========================================================

def send_email(
    *,
    to: str,
    subject: str,
    body: str,
    html_body: Optional[str] = None,
    attachments: Optional[List[Tuple[str, bytes, str]]] = None,
) -> None:

    if settings.ENVIRONMENT.lower() != "production":
        logger.info(
            "Email skipped (non-production)",
            extra={
                "extra_data": {
                    "recipient": to,
                    "correlation_id": get_correlation_id(),
                }
            },
        )
        return

    _validate_email(to)
    _validate_attachments(attachments)
    _validate_body_size(body)
    _validate_body_size(html_body)

    msg = _build_message(
        to=to,
        subject=subject,
        body=body,
        html_body=html_body,
        attachments=attachments,
    )

    attempt = 0

    while attempt < MAX_RETRIES:
        try:
            with _smtp_connection() as server:
                server.send_message(msg)

            logger.info(
                "Email sent successfully",
                extra={
                    "extra_data": {
                        "recipient": to,
                        "attempt": attempt + 1,
                        "correlation_id": get_correlation_id(),
                    }
                },
            )
            return

        except smtplib.SMTPException as e:
            attempt += 1

            logger.warning(
                "SMTP attempt failed",
                extra={
                    "extra_data": {
                        "recipient": to,
                        "attempt": attempt,
                        "error_type": type(e).__name__,
                        "correlation_id": get_correlation_id(),
                    }
                },
            )

            if attempt >= MAX_RETRIES:
                raise ServiceUnavailableError("Email service unavailable")

            sleep_seconds = min(
                (RETRY_BACKOFF_BASE ** attempt),
                MAX_BACKOFF_SECONDS,
            ) + random.uniform(0, 0.5)

            time.sleep(sleep_seconds)

        except Exception as e:
            logger.exception(
                "Unexpected email failure",
                extra={
                    "extra_data": {
                        "recipient": to,
                        "error_type": type(e).__name__,
                        "correlation_id": get_correlation_id(),
                    }
                },
            )
            raise ServiceUnavailableError("Email service unavailable")