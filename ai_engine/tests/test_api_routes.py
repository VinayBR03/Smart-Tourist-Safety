# tests/test_api_routes.py

from fastapi.testclient import TestClient
from main import app


class DummyEngine:
    def predict(self, *, domain, features):
        return {
            "status": "success",
            "domain": domain,
            "prediction": {
                "risk_score": 0.5,
                "risk_level": "MEDIUM"
            }
        }

    def health_check(self):
        return {
            "status": "ok",
            "supported_domains": ["zone", "health", "crowd"]
        }


def test_predict_route(monkeypatch):

    monkeypatch.setattr(
        "api.routes.ai_engine",
        DummyEngine()
    )

    client = TestClient(app)

    response = client.post(
        "/predict",
        json={
            "domain": "zone",
            "features": {
                "incident_count": 2,
                "sos_count": 1,
                "event_count": 10,
                "previous_risk_score": 0.3,
                "window_minutes": 30
            }
        }
    )

    assert response.status_code == 200

    data = response.json()

    assert data["status"] == "success"
    assert data["domain"] == "zone"
    assert 0 <= data["prediction"]["risk_score"] <= 1


def test_health_endpoint():
    client = TestClient(app)

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"