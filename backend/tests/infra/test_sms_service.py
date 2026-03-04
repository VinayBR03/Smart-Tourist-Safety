import pytest
import requests
from unittest.mock import MagicMock

from app.services import sms_service
from app.core.exceptions import ValidationError, ServiceUnavailableError


# ----------------------------------------------------------
# Feature Disabled
# ----------------------------------------------------------

def test_sms_skipped_when_disabled(monkeypatch):
    monkeypatch.setattr(sms_service.settings, "ENABLE_SMS", False)

    sms_service.send_sms(
        phone="+919999999999",
        message="Hello"
    )


# ----------------------------------------------------------
# Non-production Skip
# ----------------------------------------------------------

def test_sms_skipped_non_production(monkeypatch):
    monkeypatch.setattr(sms_service.settings, "ENABLE_SMS", True)
    monkeypatch.setattr(sms_service.settings, "ENVIRONMENT", "development")

    sms_service.send_sms(
        phone="+919999999999",
        message="Hello"
    )


# ----------------------------------------------------------
# Missing Configuration
# ----------------------------------------------------------

def test_sms_missing_configuration(monkeypatch):
    monkeypatch.setattr(sms_service.settings, "ENABLE_SMS", True)
    monkeypatch.setattr(sms_service.settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(sms_service.settings, "SMS_PROVIDER_URL", None)
    monkeypatch.setattr(sms_service.settings, "SMS_ACCOUNT_SID", None)
    monkeypatch.setattr(sms_service.settings, "SMS_AUTH_TOKEN", None)
    monkeypatch.setattr(sms_service.settings, "SMS_FROM_NUMBER", None)

    with pytest.raises(ServiceUnavailableError):
        sms_service.send_sms(
            phone="+919999999999",
            message="Hello"
        )


# ----------------------------------------------------------
# Invalid Phone
# ----------------------------------------------------------

def test_invalid_phone(monkeypatch):
    monkeypatch.setattr(sms_service.settings, "ENABLE_SMS", True)
    monkeypatch.setattr(sms_service.settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(sms_service.settings, "SMS_PROVIDER_URL", "url")
    monkeypatch.setattr(sms_service.settings, "SMS_ACCOUNT_SID", "sid")
    monkeypatch.setattr(sms_service.settings, "SMS_AUTH_TOKEN", "token")
    monkeypatch.setattr(sms_service.settings, "SMS_FROM_NUMBER", "+911234567890")

    with pytest.raises(ValidationError):
        sms_service.send_sms(
            phone="invalid-phone",
            message="Hello"
        )


# ----------------------------------------------------------
# Invalid Message
# ----------------------------------------------------------

def test_invalid_message(monkeypatch):
    monkeypatch.setattr(sms_service.settings, "ENABLE_SMS", True)
    monkeypatch.setattr(sms_service.settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(sms_service.settings, "SMS_PROVIDER_URL", "url")
    monkeypatch.setattr(sms_service.settings, "SMS_ACCOUNT_SID", "sid")
    monkeypatch.setattr(sms_service.settings, "SMS_AUTH_TOKEN", "token")
    monkeypatch.setattr(sms_service.settings, "SMS_FROM_NUMBER", "+911234567890")

    with pytest.raises(ValidationError):
        sms_service.send_sms(
            phone="+919999999999",
            message="   "
        )


# ----------------------------------------------------------
# Success Path
# ----------------------------------------------------------

def test_sms_success(monkeypatch):
    monkeypatch.setattr(sms_service.settings, "ENABLE_SMS", True)
    monkeypatch.setattr(sms_service.settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(sms_service.settings, "SMS_PROVIDER_URL", "url")
    monkeypatch.setattr(sms_service.settings, "SMS_ACCOUNT_SID", "sid")
    monkeypatch.setattr(sms_service.settings, "SMS_AUTH_TOKEN", "token")
    monkeypatch.setattr(sms_service.settings, "SMS_FROM_NUMBER", "+911234567890")

    fake_response = MagicMock()
    fake_response.status_code = 200
    fake_response.json.return_value = {}

    monkeypatch.setattr(requests, "post", lambda *args, **kwargs: fake_response)

    sms_service.send_sms(
        phone="+919999999999",
        message="Hello"
    )


# ----------------------------------------------------------
# Provider Returns Error Status
# ----------------------------------------------------------

def test_sms_provider_error_status(monkeypatch):
    monkeypatch.setattr(sms_service.settings, "ENABLE_SMS", True)
    monkeypatch.setattr(sms_service.settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(sms_service.settings, "SMS_PROVIDER_URL", "url")
    monkeypatch.setattr(sms_service.settings, "SMS_ACCOUNT_SID", "sid")
    monkeypatch.setattr(sms_service.settings, "SMS_AUTH_TOKEN", "token")
    monkeypatch.setattr(sms_service.settings, "SMS_FROM_NUMBER", "+911234567890")

    fake_response = MagicMock()
    fake_response.status_code = 500

    monkeypatch.setattr(requests, "post", lambda *args, **kwargs: fake_response)

    with pytest.raises(ServiceUnavailableError):
        sms_service.send_sms(
            phone="+919999999999",
            message="Hello"
        )


# ----------------------------------------------------------
# Provider JSON Error Field
# ----------------------------------------------------------

def test_sms_provider_json_error(monkeypatch):
    monkeypatch.setattr(sms_service.settings, "ENABLE_SMS", True)
    monkeypatch.setattr(sms_service.settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(sms_service.settings, "SMS_PROVIDER_URL", "url")
    monkeypatch.setattr(sms_service.settings, "SMS_ACCOUNT_SID", "sid")
    monkeypatch.setattr(sms_service.settings, "SMS_AUTH_TOKEN", "token")
    monkeypatch.setattr(sms_service.settings, "SMS_FROM_NUMBER", "+911234567890")

    fake_response = MagicMock()
    fake_response.status_code = 200
    fake_response.json.return_value = {"error": "provider-error"}

    monkeypatch.setattr(requests, "post", lambda *args, **kwargs: fake_response)

    with pytest.raises(ServiceUnavailableError):
        sms_service.send_sms(
            phone="+919999999999",
            message="Hello"
        )


# ----------------------------------------------------------
# Timeout Retry → Fail
# ----------------------------------------------------------

def test_sms_timeout_retry(monkeypatch):
    monkeypatch.setattr(sms_service.settings, "ENABLE_SMS", True)
    monkeypatch.setattr(sms_service.settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(sms_service.settings, "SMS_PROVIDER_URL", "url")
    monkeypatch.setattr(sms_service.settings, "SMS_ACCOUNT_SID", "sid")
    monkeypatch.setattr(sms_service.settings, "SMS_AUTH_TOKEN", "token")
    monkeypatch.setattr(sms_service.settings, "SMS_FROM_NUMBER", "+911234567890")

    def timeout(*args, **kwargs):
        raise requests.Timeout()

    monkeypatch.setattr(requests, "post", timeout)
    monkeypatch.setattr(sms_service.time, "sleep", lambda x: None)

    with pytest.raises(ServiceUnavailableError):
        sms_service.send_sms(
            phone="+919999999999",
            message="Hello"
        )


# ----------------------------------------------------------
# Network Retry → Fail
# ----------------------------------------------------------

def test_sms_network_retry(monkeypatch):
    monkeypatch.setattr(sms_service.settings, "ENABLE_SMS", True)
    monkeypatch.setattr(sms_service.settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(sms_service.settings, "SMS_PROVIDER_URL", "url")
    monkeypatch.setattr(sms_service.settings, "SMS_ACCOUNT_SID", "sid")
    monkeypatch.setattr(sms_service.settings, "SMS_AUTH_TOKEN", "token")
    monkeypatch.setattr(sms_service.settings, "SMS_FROM_NUMBER", "+911234567890")

    def network_error(*args, **kwargs):
        raise requests.RequestException()

    monkeypatch.setattr(requests, "post", network_error)
    monkeypatch.setattr(sms_service.time, "sleep", lambda x: None)

    with pytest.raises(ServiceUnavailableError):
        sms_service.send_sms(
            phone="+919999999999",
            message="Hello"
        )