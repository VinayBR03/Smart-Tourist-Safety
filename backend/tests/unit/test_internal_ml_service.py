import pytest
from unittest.mock import MagicMock
from requests.exceptions import Timeout, RequestException

from app.services.internal_ml_service import InternalMLService
from app.core.enums import RiskLevel


# =========================================================
# Helpers
# =========================================================

class MockResponse:
    def __init__(self, json_data=None, status_code=200):
        self._json = json_data or {}
        self.status_code = status_code

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RequestException("HTTP Error")

    def json(self):
        return self._json


# =========================================================
# Basic Guards
# =========================================================

def test_disabled_engine():
    service = InternalMLService()
    service.enabled = False

    result = service.predict_zone_risk(features={})
    assert result is None


def test_invalid_domain():
    service = InternalMLService()
    service.enabled = True

    result = service._predict(domain="invalid", features={})
    assert result is None


def test_invalid_features_type():
    service = InternalMLService()
    service.enabled = True
    service.base_url = "http://fake"
    service.internal_token = "token"

    result = service._predict(domain="zone", features="not_dict")
    assert result is None


# =========================================================
# Successful Zone Prediction
# =========================================================

def test_predict_zone_risk_success(monkeypatch):
    service = InternalMLService()
    service.enabled = True
    service.base_url = "http://fake"
    service.internal_token = "token"

    mock_response = MockResponse(
        json_data={
            "status": "success",
            "prediction": {
                "risk_score": 0.8,
                "risk_level": "HIGH",
                "model_version": "ml_v1",
            },
        }
    )

    monkeypatch.setattr(
        "app.services.internal_ml_service.requests.post",
        lambda *args, **kwargs: mock_response,
    )

    result = service.predict_zone_risk(features={"a": 1})

    assert result["risk_score"] == 0.8
    assert result["risk_level"] == RiskLevel.HIGH.value


# =========================================================
# Invalid ML Response
# =========================================================

def test_invalid_response_structure(monkeypatch):
    service = InternalMLService()
    service.enabled = True
    service.base_url = "http://fake"
    service.internal_token = "token"

    mock_response = MockResponse(
        json_data={"status": "error"}
    )

    monkeypatch.setattr(
        "app.services.internal_ml_service.requests.post",
        lambda *args, **kwargs: mock_response,
    )

    result = service.predict_zone_risk(features={"a": 1})
    assert result is None


# =========================================================
# Timeout Handling
# =========================================================

def test_timeout(monkeypatch):
    service = InternalMLService()
    service.enabled = True
    service.base_url = "http://fake"
    service.internal_token = "token"

    monkeypatch.setattr(
        "app.services.internal_ml_service.requests.post",
        lambda *args, **kwargs: (_ for _ in ()).throw(Timeout()),
    )

    result = service.predict_zone_risk(features={"a": 1})
    assert result is None


# =========================================================
# Request Exception Handling
# =========================================================

def test_request_exception(monkeypatch):
    service = InternalMLService()
    service.enabled = True
    service.base_url = "http://fake"
    service.internal_token = "token"

    monkeypatch.setattr(
        "app.services.internal_ml_service.requests.post",
        lambda *args, **kwargs: (_ for _ in ()).throw(RequestException()),
    )

    result = service.predict_zone_risk(features={"a": 1})
    assert result is None


# =========================================================
# Circuit Breaker Opens
# =========================================================

def test_circuit_breaker_opens(monkeypatch):
    service = InternalMLService()
    service.enabled = True
    service.base_url = "http://fake"
    service.internal_token = "token"

    monkeypatch.setattr(
        "app.services.internal_ml_service.requests.post",
        lambda *args, **kwargs: (_ for _ in ()).throw(RequestException()),
    )

    # Trigger failures
    for _ in range(service.MAX_FAILURES + 1):
        service.predict_zone_risk(features={"a": 1})

    # Circuit should now block
    result = service.predict_zone_risk(features={"a": 1})
    assert result is None


# =========================================================
# Large Payload Blocked
# =========================================================

def test_large_payload_blocked():
    service = InternalMLService()
    service.enabled = True
    service.base_url = "http://fake"
    service.internal_token = "token"

    large_features = {"data": "x" * (service.MAX_FEATURE_PAYLOAD_BYTES + 10)}

    result = service.predict_zone_risk(features=large_features)
    assert result is None


# =========================================================
# Non-finite Risk Score
# =========================================================

def test_non_finite_risk_score(monkeypatch):
    service = InternalMLService()
    service.enabled = True
    service.base_url = "http://fake"
    service.internal_token = "token"

    mock_response = MockResponse(
        json_data={
            "status": "success",
            "prediction": {
                "risk_score": float("inf"),
                "risk_level": "HIGH",
            },
        }
    )

    monkeypatch.setattr(
        "app.services.internal_ml_service.requests.post",
        lambda *args, **kwargs: mock_response,
    )

    result = service.predict_zone_risk(features={"a": 1})
    assert result is None