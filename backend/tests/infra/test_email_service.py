import pytest
import smtplib
from unittest.mock import MagicMock

from app.services import email_service
from app.core.exceptions import ValidationError, ServiceUnavailableError


# ----------------------------------------------------------
# Non-production should skip
# ----------------------------------------------------------

def test_email_skipped_in_non_production(monkeypatch):
    monkeypatch.setattr(email_service.settings, "ENVIRONMENT", "development")

    # Should not raise
    email_service.send_email(
        to="user@example.com",
        subject="Test",
        body="Hello",
    )


# ----------------------------------------------------------
# Invalid Email
# ----------------------------------------------------------

def test_invalid_email_in_production(monkeypatch):
    monkeypatch.setattr(email_service.settings, "ENVIRONMENT", "production")

    with pytest.raises(ValidationError):
        email_service.send_email(
            to="invalid-email",
            subject="Test",
            body="Hello",
        )


# ----------------------------------------------------------
# Missing SMTP configuration
# ----------------------------------------------------------

def test_smtp_not_configured(monkeypatch):
    monkeypatch.setattr(email_service.settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(email_service.settings, "SMTP_HOST", None)

    with pytest.raises(ServiceUnavailableError):
        email_service.send_email(
            to="user@example.com",
            subject="Test",
            body="Hello",
        )


# ----------------------------------------------------------
# Successful Send
# ----------------------------------------------------------

def test_email_send_success(monkeypatch):
    monkeypatch.setattr(email_service.settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(email_service.settings, "SMTP_HOST", "smtp.test.com")
    monkeypatch.setattr(email_service.settings, "SMTP_PORT", 587)
    monkeypatch.setattr(email_service.settings, "SMTP_USER", None)
    monkeypatch.setattr(email_service.settings, "SMTP_PASSWORD", None)
    monkeypatch.setattr(email_service.settings, "SMTP_FROM", "noreply@test.com")
    monkeypatch.setattr(email_service.settings, "SMTP_USE_TLS", False)

    fake_server = MagicMock()
    fake_server.send_message.return_value = None

    class FakeSMTP:
        def __init__(*args, **kwargs): pass
        def ehlo(self): pass
        def starttls(self, context=None): pass
        def login(self, user, password): pass
        def send_message(self, msg): pass
        def quit(self): pass

    monkeypatch.setattr(smtplib, "SMTP", FakeSMTP)

    email_service.send_email(
        to="user@example.com",
        subject="Test",
        body="Hello",
    )


# ----------------------------------------------------------
# Retry then Fail
# ----------------------------------------------------------

def test_email_retry_failure(monkeypatch):
    monkeypatch.setattr(email_service.settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(email_service.settings, "SMTP_HOST", "smtp.test.com")
    monkeypatch.setattr(email_service.settings, "SMTP_PORT", 587)
    monkeypatch.setattr(email_service.settings, "SMTP_USER", None)
    monkeypatch.setattr(email_service.settings, "SMTP_PASSWORD", None)
    monkeypatch.setattr(email_service.settings, "SMTP_FROM", "noreply@test.com")
    monkeypatch.setattr(email_service.settings, "SMTP_USE_TLS", False)

    class FailingSMTP:
        def __init__(*args, **kwargs): pass
        def ehlo(self): pass
        def starttls(self, context=None): pass
        def login(self, user, password): pass
        def send_message(self, msg):
            raise smtplib.SMTPException("fail")
        def quit(self): pass

    monkeypatch.setattr(smtplib, "SMTP", FailingSMTP)

    with pytest.raises(ServiceUnavailableError):
        email_service.send_email(
            to="user@example.com",
            subject="Test",
            body="Hello",
        )


# ----------------------------------------------------------
# Attachment Validation
# ----------------------------------------------------------

def test_attachment_too_large(monkeypatch):
    monkeypatch.setattr(email_service.settings, "ENVIRONMENT", "production")

    with pytest.raises(ValidationError):
        email_service.send_email(
            to="user@example.com",
            subject="Test",
            body="Hello",
            attachments=[
                ("file.txt", b"x" * (email_service.MAX_ATTACHMENT_SIZE_BYTES + 1), "text/plain")
            ],
        )