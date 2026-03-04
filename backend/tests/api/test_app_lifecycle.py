import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, MagicMock

import app.main as main_module


# =========================================================
# HEALTH CHECK
# =========================================================

def test_health_check():
    client = TestClient(main_module.app)
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "running"


# =========================================================
# LIFESPAN - KAFKA + REDIS DISABLED
# =========================================================

def test_lifespan_without_optional_services(monkeypatch):

    monkeypatch.setattr(main_module.settings, "ENABLE_KAFKA", False)
    monkeypatch.setattr(main_module.settings, "ENABLE_REDIS", False)

    monkeypatch.setattr(
        main_module,
        "permanently_delete_expired_accounts",
        lambda db: None,
    )

    with TestClient(main_module.app):
        pass  # triggers startup + shutdown


# =========================================================
# LIFESPAN - KAFKA + REDIS ENABLED
# =========================================================

def test_full_lifespan_production_branches(monkeypatch):

    # ---- Simulate production-like environment ----
    monkeypatch.setattr(main_module.settings, "ENVIRONMENT", "development")
    monkeypatch.setattr(main_module.settings, "ENABLE_KAFKA", True)
    monkeypatch.setattr(main_module.settings, "ENABLE_REDIS", True)

    # ---- Mock background functions ----
    monkeypatch.setattr(
        main_module,
        "permanently_delete_expired_accounts",
        lambda db: None,
    )

    monkeypatch.setattr(
        main_module,
        "start_kafka_consumer",
        AsyncMock(return_value=None),
    )

    monkeypatch.setattr(
        main_module,
        "start_redis_listener",
        AsyncMock(return_value=None),
    )

    # ---- Run lifespan ----
    with TestClient(main_module.app):
        pass


# =========================================================
# STARTUP FAILURE BRANCHES
# =========================================================

def test_kafka_start_failure(monkeypatch):

    monkeypatch.setattr(main_module.settings, "ENABLE_KAFKA", True)
    monkeypatch.setattr(main_module.settings, "ENABLE_REDIS", False)

    monkeypatch.setattr(
        main_module,
        "start_kafka_consumer",
        AsyncMock(side_effect=Exception("Kafka failed")),
    )

    monkeypatch.setattr(
        main_module,
        "permanently_delete_expired_accounts",
        lambda db: None,
    )

    with TestClient(main_module.app):
        pass


def test_redis_start_failure(monkeypatch):

    monkeypatch.setattr(main_module.settings, "ENABLE_KAFKA", False)
    monkeypatch.setattr(main_module.settings, "ENABLE_REDIS", True)

    monkeypatch.setattr(
        main_module,
        "start_redis_listener",
        AsyncMock(side_effect=Exception("Redis failed")),
    )

    monkeypatch.setattr(
        main_module,
        "permanently_delete_expired_accounts",
        lambda db: None,
    )

    with TestClient(main_module.app):
        pass


# =========================================================
# ENGINE DISPOSE COVERAGE
# =========================================================

def test_engine_dispose_called(monkeypatch):

    monkeypatch.setattr(main_module.settings, "ENABLE_KAFKA", False)
    monkeypatch.setattr(main_module.settings, "ENABLE_REDIS", False)

    monkeypatch.setattr(
        main_module,
        "permanently_delete_expired_accounts",
        lambda db: None,
    )

    dispose_mock = MagicMock()
    monkeypatch.setattr(main_module.engine, "dispose", dispose_mock)

    with TestClient(main_module.app):
        pass

    assert dispose_mock.called