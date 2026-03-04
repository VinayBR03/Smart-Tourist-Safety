# tests/test_model_registry.py

import pytest
from model_registry import ModelRegistry


class DummyModel:
    metadata = {
        "model_version": "v1",
        "model_type": "zone"
    }


def test_model_registry_status(monkeypatch):

    # Patch safe loaders
    monkeypatch.setattr(
        ModelRegistry,
        "_safe_load_zone",
        lambda self: DummyModel()
    )

    monkeypatch.setattr(
        ModelRegistry,
        "_safe_load_health",
        lambda self: DummyModel()
    )

    monkeypatch.setattr(
        ModelRegistry,
        "_safe_load_crowd",
        lambda self: DummyModel()
    )

    registry = ModelRegistry()

    status = registry.status()

    assert status["zone"] == "loaded"
    assert status["health"] == "loaded"
    assert status["crowd"] == "loaded"


def test_model_metadata_validation_failure(monkeypatch):

    from model_registry import ModelRegistry

    class BadModel:
        metadata = {"model_version": "v1"}  # Missing model_type

    class DummySelector:
        def __init__(self, *args, **kwargs):
            pass

        def load_best_model(self):
            return BadModel()

    # Patch selector instead of safe loader
    monkeypatch.setattr(
        "models.zone.selector.ZoneModelSelector",
        DummySelector
    )

    monkeypatch.setattr(
        "models.health.selector.HealthModelSelector",
        lambda *args, **kwargs: None
    )

    monkeypatch.setattr(
        "models.crowd.selector.CrowdModelSelector",
        lambda *args, **kwargs: None
    )

    registry = ModelRegistry()

    # Validation should fail → loader returns None
    assert registry.get_zone_model() is None

def test_registry_detailed_status(monkeypatch):

    from model_registry import ModelRegistry

    monkeypatch.setattr(
        ModelRegistry,
        "_safe_load_zone",
        lambda self: None
    )

    monkeypatch.setattr(
        ModelRegistry,
        "_safe_load_health",
        lambda self: None
    )

    monkeypatch.setattr(
        ModelRegistry,
        "_safe_load_crowd",
        lambda self: None
    )

    registry = ModelRegistry()

    details = registry.detailed_status()

    assert details["zone"]["status"] == "not_loaded"

def test_registry_status_loaded(monkeypatch):
    from model_registry import ModelRegistry

    class DummyModel:
        metadata = {
            "model_version": "v1",
            "model_type": "zone"
        }

    monkeypatch.setattr(
        ModelRegistry,
        "_safe_load_zone",
        lambda self: DummyModel()
    )

    monkeypatch.setattr(
        ModelRegistry,
        "_safe_load_health",
        lambda self: DummyModel()
    )

    monkeypatch.setattr(
        ModelRegistry,
        "_safe_load_crowd",
        lambda self: DummyModel()
    )

    registry = ModelRegistry()

    details = registry.detailed_status()

    assert details["zone"]["model_version"] == "v1"

def test_safe_load_zone_success(monkeypatch):
    from model_registry import ModelRegistry

    class DummyModel:
        metadata = {
            "model_version": "v1",
            "model_type": "zone"
        }

    class DummySelector:
        def __init__(self, *args, **kwargs):
            pass

        def load_best_model(self):
            return DummyModel()

    # Patch selector so _safe_load_zone executes fully
    monkeypatch.setattr(
        "model_registry.ZoneModelSelector",
        DummySelector
    )

    registry = ModelRegistry()

    assert registry.get_zone_model() is not None


def test_safe_load_zone_exception(monkeypatch):
    from model_registry import ModelRegistry

    class DummySelector:
        def __init__(self, *args, **kwargs):
            pass

        def load_best_model(self):
            raise RuntimeError("Load failed")

    monkeypatch.setattr(
        "model_registry.ZoneModelSelector",
        DummySelector
    )

    registry = ModelRegistry()

    # Exception path should return None
    assert registry.get_zone_model() is None