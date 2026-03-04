import pytest
from unittest.mock import MagicMock

from app.services.risk_engine_service import (
    _clamp_score,
    _resolve_risk_level,
    compute_rule_based_risk,
    update_zone_status,
    persist_zone_risk,
)

from app.core.enums import RiskLevel
from app.core.exceptions import NotFoundError, ValidationError


# =========================================================
# Clamp Score
# =========================================================

def test_clamp_score_valid():
    assert _clamp_score(0.5) == 0.5


def test_clamp_score_overflow():
    assert _clamp_score(5) == 1.0


def test_clamp_score_negative():
    assert _clamp_score(-5) == 0.0


def test_clamp_score_invalid():
    assert _clamp_score("invalid") == 0.0


# =========================================================
# Resolve Risk Level
# =========================================================

def test_resolve_risk_level_low():
    assert _resolve_risk_level(0.1) == RiskLevel.LOW


def test_resolve_risk_level_medium():
    assert _resolve_risk_level(0.5) == RiskLevel.MEDIUM


def test_resolve_risk_level_high():
    assert _resolve_risk_level(0.9) == RiskLevel.HIGH


# =========================================================
# Rule-Based Risk
# =========================================================

def test_compute_rule_based_risk_success(monkeypatch):
    mock_db = MagicMock()

    mock_zone = MagicMock()
    mock_zone.deleted_at = None
    mock_zone.is_active = True

    mock_db.query().filter().first.return_value = mock_zone

    monkeypatch.setattr(
        "app.services.risk_engine_service.extract_zone_features",
        lambda *args, **kwargs: {
            "incident_count": 1,
            "sos_count": 1,
            "event_count": 50,
        },
    )

    monkeypatch.setattr(
        "app.services.risk_engine_service.normalize_features",
        lambda *args, **kwargs: kwargs.get("features") or args[0],
    )

    score, level, features = compute_rule_based_risk(
        mock_db,
        zone_id=1,
    )

    assert isinstance(score, float)
    assert isinstance(level, RiskLevel)
    assert features["incident_count"] == 1


def test_compute_rule_based_risk_zone_not_found():
    mock_db = MagicMock()
    mock_db.query().filter().first.return_value = None

    with pytest.raises(NotFoundError):
        compute_rule_based_risk(mock_db, zone_id=99)


# =========================================================
# ML Downgrade Block
# =========================================================

def test_ml_downgrade_block(monkeypatch):
    mock_db = MagicMock()

    monkeypatch.setattr(
        "app.services.risk_engine_service.compute_rule_based_risk",
        lambda *args, **kwargs: (0.9, RiskLevel.HIGH, {"incident_count": 10}),
    )

    monkeypatch.setattr(
        "app.services.risk_engine_service.internal_ml_service.predict_zone_risk",
        lambda *args, **kwargs: {
            "risk_score": 0.2,
            "risk_level": "LOW",
            "model_version": "ml_v1",
        },
    )

    monkeypatch.setattr(
        "app.services.risk_engine_service.persist_zone_risk",
        lambda *args, **kwargs: None,
    )

    update_zone_status(mock_db, zone_id=1)


# =========================================================
# ML Override Applied
# =========================================================

def test_ml_override_applied(monkeypatch):
    mock_db = MagicMock()

    monkeypatch.setattr(
        "app.services.risk_engine_service.compute_rule_based_risk",
        lambda *args, **kwargs: (0.4, RiskLevel.MEDIUM, {"incident_count": 1}),
    )

    monkeypatch.setattr(
        "app.services.risk_engine_service.internal_ml_service.predict_zone_risk",
        lambda *args, **kwargs: {
            "risk_score": 0.95,
            "risk_level": "HIGH",
            "model_version": "ml_v2",
        },
    )

    called = {}

    def fake_persist(*args, **kwargs):
        called["risk_level"] = kwargs["risk_level"]

    monkeypatch.setattr(
        "app.services.risk_engine_service.persist_zone_risk",
        fake_persist,
    )

    update_zone_status(mock_db, zone_id=1)

    assert called["risk_level"] == RiskLevel.HIGH


# =========================================================
# Persist Zone Risk - Create
# =========================================================

def test_persist_zone_risk_create(monkeypatch):
    mock_db = MagicMock()

    mock_db.query().filter().first.return_value = True
    mock_db.execute().scalar_one_or_none.return_value = None

    monkeypatch.setattr(
        "app.services.risk_engine_service.create_audit_log",
        lambda *args, **kwargs: None,
    )

    monkeypatch.setattr(
        "app.services.risk_engine_service.create_outbox_event",
        lambda *args, **kwargs: None,
    )

    monkeypatch.setattr(
        "app.services.risk_engine_service.create_notification",
        lambda *args, **kwargs: None,
    )

    persist_zone_risk(
        mock_db,
        zone_id=1,
        risk_score=0.8,
        risk_level=RiskLevel.HIGH,
        model_version="rule_v1",
        features={},
    )

    assert mock_db.add.called


# =========================================================
# Persist Zone Risk - Invalid Level
# =========================================================

def test_persist_zone_risk_invalid_level():
    mock_db = MagicMock()

    with pytest.raises(ValidationError):
        persist_zone_risk(
            mock_db,
            zone_id=1,
            risk_score=0.5,
            risk_level="INVALID",
        )


# =========================================================
# Persist Zone Risk - Zone Not Found
# =========================================================

def test_persist_zone_risk_zone_not_found():
    mock_db = MagicMock()
    mock_db.query().filter().first.return_value = None

    with pytest.raises(NotFoundError):
        persist_zone_risk(
            mock_db,
            zone_id=99,
            risk_score=0.5,
            risk_level=RiskLevel.LOW,
        )