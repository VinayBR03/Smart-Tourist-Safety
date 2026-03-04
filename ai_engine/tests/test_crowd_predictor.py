# tests/test_crowd_predictor.py

import pytest

from inference.crowd_predictor import CrowdPredictor


class DummyCrowdModel:
    metadata = {
        "model_version": "v1",
        "model_type": "isolation"
    }

    def predict(self, features):
        return {
            "risk_score": 0.9,
            "risk_level": "HIGH"
        }


def test_crowd_predictor_success(monkeypatch):

    from model_registry import model_registry

    monkeypatch.setattr(
        model_registry,
        "get_crowd_model",
        lambda: DummyCrowdModel()
    )

    predictor = CrowdPredictor()

    features = {
        "event_count": 200,
        "unique_devices": 150,
        "avg_dwell_time": 30,
        "movement_entropy": 0.8,
    }

    result = predictor.predict(features)

    assert result["risk_level"] == "HIGH"
    assert 0 <= result["risk_score"] <= 1


def test_crowd_invalid_type():
    predictor = CrowdPredictor()

    with pytest.raises(ValueError):
        predictor.predict("not_dict")


def test_crowd_model_not_loaded(monkeypatch):
    from model_registry import model_registry

    monkeypatch.setattr(
        model_registry,
        "get_crowd_model",
        lambda: None
    )

    predictor = CrowdPredictor()

    features = {
        "event_count": 200,
        "unique_devices": 150,
        "avg_dwell_time": 30,
        "movement_entropy": 0.8,
    }

    with pytest.raises(RuntimeError):
        predictor.predict(features)