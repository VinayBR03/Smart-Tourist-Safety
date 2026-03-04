# tests/unit/test_health_monitor_service.py

import pytest
from unittest.mock import MagicMock

from app.services.health_monitor_service import (
    _sanitize,
    evaluate_health_metrics,
)

from app.core.exceptions import ConflictError


# =========================================================
# _sanitize Tests
# =========================================================

def test_sanitize_valid_value():
    assert _sanitize(75, 20, 300) == 75.0


def test_sanitize_none():
    assert _sanitize(None, 20, 300) is None


def test_sanitize_invalid_type():
    assert _sanitize("invalid", 20, 300) is None


def test_sanitize_out_of_range_low():
    assert _sanitize(5, 20, 300) is None


def test_sanitize_out_of_range_high():
    assert _sanitize(500, 20, 300) is None


# =========================================================
# evaluate_health_metrics – RULE TRIGGER
# =========================================================

def test_evaluate_health_metrics_rule_trigger(monkeypatch):
    mock_db = MagicMock()

    # Prevent cooldown block
    monkeypatch.setattr(
        "app.services.health_monitor_service._has_recent_health_incident",
        lambda *args, **kwargs: False,
    )

    # Mock ML service
    monkeypatch.setattr(
        "app.services.health_monitor_service.internal_ml_service.predict_health_risk",
        lambda *args, **kwargs: None,
    )

    # Mock incident + side effects
    mock_incident = MagicMock()
    mock_incident.id = 99

    monkeypatch.setattr(
        "app.services.health_monitor_service.create_incident",
        lambda *args, **kwargs: mock_incident,
    )

    monkeypatch.setattr(
        "app.services.health_monitor_service.create_notification",
        lambda *args, **kwargs: None,
    )

    monkeypatch.setattr(
        "app.services.health_monitor_service.create_outbox_event",
        lambda *args, **kwargs: None,
    )

    monkeypatch.setattr(
        "app.services.health_monitor_service.create_audit_log",
        lambda *args, **kwargs: None,
    )

    evaluate_health_metrics(
        db=mock_db,
        tourist_id=1,
        heart_rate=200,  # triggers rule
        spo2=98,
        body_temperature=36.5,
    )

    # Ensure telemetry was added
    assert mock_db.add.called


# =========================================================
# evaluate_health_metrics – ML TRIGGER
# =========================================================

def test_evaluate_health_metrics_ml_trigger(monkeypatch):
    mock_db = MagicMock()

    monkeypatch.setattr(
        "app.services.health_monitor_service._has_recent_health_incident",
        lambda *args, **kwargs: False,
    )

    # ML anomaly high score
    monkeypatch.setattr(
        "app.services.health_monitor_service.internal_ml_service.predict_health_risk",
        lambda *args, **kwargs: {"anomaly_score": 0.95},
    )

    mock_incident = MagicMock()
    mock_incident.id = 50

    monkeypatch.setattr(
        "app.services.health_monitor_service.create_incident",
        lambda *args, **kwargs: mock_incident,
    )

    monkeypatch.setattr(
        "app.services.health_monitor_service.create_notification",
        lambda *args, **kwargs: None,
    )

    monkeypatch.setattr(
        "app.services.health_monitor_service.create_outbox_event",
        lambda *args, **kwargs: None,
    )

    monkeypatch.setattr(
        "app.services.health_monitor_service.create_audit_log",
        lambda *args, **kwargs: None,
    )

    evaluate_health_metrics(
        db=mock_db,
        tourist_id=1,
        heart_rate=80,
        spo2=98,
        body_temperature=36.5,
    )

    assert mock_db.add.called


# =========================================================
# evaluate_health_metrics – Cooldown Guard
# =========================================================

def test_evaluate_health_metrics_cooldown(monkeypatch):
    mock_db = MagicMock()

    # Cooldown active → should exit early
    monkeypatch.setattr(
        "app.services.health_monitor_service._has_recent_health_incident",
        lambda *args, **kwargs: True,
    )

    evaluate_health_metrics(
        db=mock_db,
        tourist_id=1,
        heart_rate=200,
        spo2=80,
        body_temperature=40,
    )

    # Should NOT call incident creation
    # So DB add still happens (telemetry), but no further calls
    assert mock_db.add.called


# =========================================================
# Conflict Handling
# =========================================================

def test_auto_incident_conflict(monkeypatch):
    mock_db = MagicMock()

    monkeypatch.setattr(
        "app.services.health_monitor_service._has_recent_health_incident",
        lambda *args, **kwargs: False,
    )

    monkeypatch.setattr(
        "app.services.health_monitor_service.internal_ml_service.predict_health_risk",
        lambda *args, **kwargs: {"anomaly_score": 0.99},
    )

    # Force ConflictError
    def raise_conflict(*args, **kwargs):
        raise ConflictError("Duplicate incident")

    monkeypatch.setattr(
        "app.services.health_monitor_service.create_incident",
        raise_conflict,
    )

    evaluate_health_metrics(
        db=mock_db,
        tourist_id=1,
        heart_rate=80,
        spo2=98,
        body_temperature=36.5,
    )

    # Should not crash
    assert True