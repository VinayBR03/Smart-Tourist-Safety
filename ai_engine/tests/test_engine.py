# tests/test_engine.py

import pytest
from inference.engine import AIInferenceEngine


def test_engine_success_zone(monkeypatch):

    class DummyPredictor:
        def predict(self, features):
            return {"risk_score": 0.5, "risk_level": "MEDIUM"}

    engine = AIInferenceEngine()

    # Patch predictors
    engine._router["zone"] = DummyPredictor().predict

    response = engine.predict(
        domain="zone",
        features={"a": 1}
    )

    assert response["status"] == "success"
    assert response["domain"] == "zone"
    assert "prediction" in response
    assert 0 <= response["prediction"]["risk_score"] <= 1


def test_engine_invalid_domain():
    engine = AIInferenceEngine()

    response = engine.predict(
        domain="invalid",
        features={"a": 1}
    )

    assert response["status"] == "error"
    assert "Unsupported domain" in response["message"]


def test_engine_invalid_features():
    engine = AIInferenceEngine()

    response = engine.predict(
        domain="zone",
        features="not_a_dict"
    )

    assert response["status"] == "error"
    assert "Features must be a dictionary" in response["message"]

def test_engine_runtime_error(monkeypatch):

    class BadPredictor:
        def predict(self, features):
            raise RuntimeError("Model failure")

    engine = AIInferenceEngine()
    engine._router["zone"] = BadPredictor().predict

    response = engine.predict(domain="zone", features={})

    assert response["status"] == "error"


def test_engine_value_error(monkeypatch):

    class BadPredictor:
        def predict(self, features):
            raise ValueError("Invalid")

    engine = AIInferenceEngine()
    engine._router["zone"] = BadPredictor().predict

    response = engine.predict(domain="zone", features={})

    assert response["status"] == "error"