# tests/test_zone_predictor.py

import pytest
from inference.zone_predictor import ZonePredictor


class DummyZoneModel:
    metadata = {
        "model_version": "v1",
        "model_type": "logistic"
    }

    def predict(self, features):
        return {
            "risk_score": 0.75,
            "risk_level": "HIGH"
        }


def test_zone_predictor_success(monkeypatch):

    from model_registry import model_registry

    monkeypatch.setattr(
        model_registry,
        "get_zone_model",
        lambda: DummyZoneModel()
    )

    predictor = ZonePredictor()

    features = {
        "incident_count": 5,
        "sos_count": 1,
        "event_count": 20,
        "previous_risk_score": 0.4,
        "window_minutes": 30,
    }

    result = predictor.predict(features)

    assert result["risk_level"] == "HIGH"
    assert 0 <= result["risk_score"] <= 1


def test_zone_missing_feature():
    predictor = ZonePredictor()

    with pytest.raises(ValueError):
        predictor.predict({"incident_count": 1})  # incomplete


def test_zone_invalid_numeric(monkeypatch):
    from model_registry import model_registry

    monkeypatch.setattr(
        model_registry,
        "get_zone_model",
        lambda: object()
    )

    predictor = ZonePredictor()

    features = {
        "incident_count": "bad",
        "sos_count": 1,
        "event_count": 2,
        "previous_risk_score": 0.2,
        "window_minutes": 30,
    }

    with pytest.raises(ValueError):
        predictor.predict(features)


def test_zone_model_not_loaded(monkeypatch):
    from model_registry import model_registry

    monkeypatch.setattr(
        model_registry,
        "get_zone_model",
        lambda: None
    )

    predictor = ZonePredictor()

    features = {
        "incident_count": 1,
        "sos_count": 1,
        "event_count": 2,
        "previous_risk_score": 0.2,
        "window_minutes": 30,
    }

    with pytest.raises(RuntimeError):
        predictor.predict(features)