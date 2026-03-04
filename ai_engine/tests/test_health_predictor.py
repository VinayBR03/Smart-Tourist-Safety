# tests/test_health_predictor.py

import pytest

from inference.health_predictor import HealthPredictor


class DummyHealthModel:
    metadata = {
        "model_version": "v1",
        "model_type": "rf"
    }

    def predict(self, features):
        return {
            "risk_score": 0.2,
            "risk_level": "LOW"
        }


def test_health_predictor_success(monkeypatch):

    from model_registry import model_registry

    monkeypatch.setattr(
        model_registry,
        "get_health_model",
        lambda: DummyHealthModel()
    )

    predictor = HealthPredictor()

    features = {
        "heart_rate": 90,
        "spo2": 97,
        "temperature": 36.5,
        "movement_variance": 0.2,
        "previous_health_score": 0.3,
    }

    result = predictor.predict(features)

    assert result["risk_level"] == "LOW"
    assert 0 <= result["risk_score"] <= 1


def test_health_invalid_type():
    predictor = HealthPredictor()

    with pytest.raises(ValueError):
        predictor.predict("not_dict")


def test_health_model_not_loaded(monkeypatch):
    from model_registry import model_registry

    monkeypatch.setattr(
        model_registry,
        "get_health_model",
        lambda: None
    )

    predictor = HealthPredictor()

    features = {
        "heart_rate": 90,
        "spo2": 97,
        "temperature": 36.5,
        "movement_variance": 0.2,
        "previous_health_score": 0.3,
    }

    with pytest.raises(RuntimeError):
        predictor.predict(features)