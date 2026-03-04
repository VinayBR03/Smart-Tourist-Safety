import pytest
import requests
from unittest.mock import MagicMock

from app.services import push_service
from app.core.exceptions import ValidationError, ServiceUnavailableError


# ----------------------------------------------------------
# Feature Disabled
# ----------------------------------------------------------

def test_push_skipped_when_disabled(monkeypatch):
    monkeypatch.setattr(push_service.settings, "ENABLE_PUSH", False)

    push_service.send_push(
        user_id=1,
        title="Hello",
        body="World",
        device_token="token123",
    )


# ----------------------------------------------------------
# Non-production Skip
# ----------------------------------------------------------

def test_push_skipped_non_production(monkeypatch):
    monkeypatch.setattr(push_service.settings, "ENABLE_PUSH", True)
    monkeypatch.setattr(push_service.settings, "ENVIRONMENT", "development")

    push_service.send_push(
        user_id=1,
        title="Hello",
        body="World",
        device_token="token123",
    )


# ----------------------------------------------------------
# Missing Configuration
# ----------------------------------------------------------

def test_push_missing_configuration(monkeypatch):
    monkeypatch.setattr(push_service.settings, "ENABLE_PUSH", True)
    monkeypatch.setattr(push_service.settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(push_service.settings, "FCM_SERVER_KEY", None)
    monkeypatch.setattr(push_service.settings, "FCM_SEND_URL", None)

    with pytest.raises(ServiceUnavailableError):
        push_service.send_push(
            user_id=1,
            title="Hello",
            body="World",
            device_token="token123",
        )


# ----------------------------------------------------------
# Input Validation Failures
# ----------------------------------------------------------

def test_invalid_user_id(monkeypatch):
    monkeypatch.setattr(push_service.settings, "ENABLE_PUSH", True)
    monkeypatch.setattr(push_service.settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(push_service.settings, "FCM_SERVER_KEY", "key")
    monkeypatch.setattr(push_service.settings, "FCM_SEND_URL", "url")

    with pytest.raises(ValidationError):
        push_service.send_push(
            user_id=0,
            title="Hello",
            body="World",
            device_token="token123",
        )


def test_invalid_device_token(monkeypatch):
    monkeypatch.setattr(push_service.settings, "ENABLE_PUSH", True)
    monkeypatch.setattr(push_service.settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(push_service.settings, "FCM_SERVER_KEY", "key")
    monkeypatch.setattr(push_service.settings, "FCM_SEND_URL", "url")

    with pytest.raises(ValidationError):
        push_service.send_push(
            user_id=1,
            title="Hello",
            body="World",
            device_token="",
        )


# ----------------------------------------------------------
# Success Path
# ----------------------------------------------------------

def test_push_success(monkeypatch):
    monkeypatch.setattr(push_service.settings, "ENABLE_PUSH", True)
    monkeypatch.setattr(push_service.settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(push_service.settings, "FCM_SERVER_KEY", "key")
    monkeypatch.setattr(push_service.settings, "FCM_SEND_URL", "url")

    fake_response = MagicMock()
    fake_response.status_code = 200
    fake_response.json.return_value = {"success": 1}

    monkeypatch.setattr(requests, "post", lambda *args, **kwargs: fake_response)

    push_service.send_push(
        user_id=1,
        title="Hello",
        body="World",
        device_token="token123",
    )


# ----------------------------------------------------------
# Provider Rejection (JSON failure)
# ----------------------------------------------------------

def test_push_provider_failure(monkeypatch):
    monkeypatch.setattr(push_service.settings, "ENABLE_PUSH", True)
    monkeypatch.setattr(push_service.settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(push_service.settings, "FCM_SERVER_KEY", "key")
    monkeypatch.setattr(push_service.settings, "FCM_SEND_URL", "url")

    fake_response = MagicMock()
    fake_response.status_code = 200
    fake_response.json.return_value = {"failure": 1}

    monkeypatch.setattr(requests, "post", lambda *args, **kwargs: fake_response)

    with pytest.raises(ServiceUnavailableError):
        push_service.send_push(
            user_id=1,
            title="Hello",
            body="World",
            device_token="token123",
        )


# ----------------------------------------------------------
# Client Error (400)
# ----------------------------------------------------------

def test_push_client_error(monkeypatch):
    monkeypatch.setattr(push_service.settings, "ENABLE_PUSH", True)
    monkeypatch.setattr(push_service.settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(push_service.settings, "FCM_SERVER_KEY", "key")
    monkeypatch.setattr(push_service.settings, "FCM_SEND_URL", "url")

    fake_response = MagicMock()
    fake_response.status_code = 400

    monkeypatch.setattr(requests, "post", lambda *args, **kwargs: fake_response)

    with pytest.raises(ServiceUnavailableError):
        push_service.send_push(
            user_id=1,
            title="Hello",
            body="World",
            device_token="token123",
        )


# ----------------------------------------------------------
# Timeout Retry → Fail
# ----------------------------------------------------------

def test_push_timeout_retry(monkeypatch):
    monkeypatch.setattr(push_service.settings, "ENABLE_PUSH", True)
    monkeypatch.setattr(push_service.settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(push_service.settings, "FCM_SERVER_KEY", "key")
    monkeypatch.setattr(push_service.settings, "FCM_SEND_URL", "url")

    def timeout(*args, **kwargs):
        raise requests.Timeout()

    monkeypatch.setattr(requests, "post", timeout)
    monkeypatch.setattr(push_service.time, "sleep", lambda x: None)

    with pytest.raises(ServiceUnavailableError):
        push_service.send_push(
            user_id=1,
            title="Hello",
            body="World",
            device_token="token123",
        )


# ----------------------------------------------------------
# Server Error Retry → Fail
# ----------------------------------------------------------

def test_push_server_error_retry(monkeypatch):
    monkeypatch.setattr(push_service.settings, "ENABLE_PUSH", True)
    monkeypatch.setattr(push_service.settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(push_service.settings, "FCM_SERVER_KEY", "key")
    monkeypatch.setattr(push_service.settings, "FCM_SEND_URL", "url")

    def server_error(*args, **kwargs):
        raise requests.RequestException()

    monkeypatch.setattr(requests, "post", server_error)
    monkeypatch.setattr(push_service.time, "sleep", lambda x: None)

    with pytest.raises(ServiceUnavailableError):
        push_service.send_push(
            user_id=1,
            title="Hello",
            body="World",
            device_token="token123",
        )