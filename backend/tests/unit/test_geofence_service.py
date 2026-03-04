# tests/unit/test_geofence_service.py

import pytest
from unittest.mock import MagicMock

from app.services.geofence_service import (
    _validate_coordinates,
    _validate_radius,
    detect_zone,
    detect_nearby_zone,
    resolve_zone_for_location,
)

from app.core.exceptions import ValidationError


# =========================================================
# Coordinate Validation
# =========================================================

def test_validate_coordinates_success():
    lat, lon = _validate_coordinates(12.9, 77.5)
    assert lat == 12.9
    assert lon == 77.5


def test_validate_coordinates_invalid_type():
    with pytest.raises(ValidationError):
        _validate_coordinates("invalid", 77.5)


def test_validate_coordinates_invalid_latitude():
    with pytest.raises(ValidationError):
        _validate_coordinates(100, 77.5)


def test_validate_coordinates_invalid_longitude():
    with pytest.raises(ValidationError):
        _validate_coordinates(12.9, 200)


# =========================================================
# Radius Validation
# =========================================================

def test_validate_radius_success():
    assert _validate_radius(50) == 50.0


def test_validate_radius_zero():
    with pytest.raises(ValidationError):
        _validate_radius(0)


def test_validate_radius_negative():
    with pytest.raises(ValidationError):
        _validate_radius(-10)


def test_validate_radius_exceeds_limit():
    with pytest.raises(ValidationError):
        _validate_radius(1000)


# =========================================================
# detect_zone (DB mocked)
# =========================================================

def test_detect_zone_returns_zone_id():
    mock_db = MagicMock()
    mock_db.execute.return_value.scalar_one_or_none.return_value = 5

    result = detect_zone(
        mock_db,
        latitude=12.9,
        longitude=77.5,
    )

    assert result == 5


def test_detect_zone_returns_none():
    mock_db = MagicMock()
    mock_db.execute.return_value.scalar_one_or_none.return_value = None

    result = detect_zone(
        mock_db,
        latitude=12.9,
        longitude=77.5,
    )

    assert result is None

# =========================================================
# detect_nearby_zone (DB mocked)
# =========================================================

def test_detect_nearby_zone_success():
    mock_db = MagicMock()
    mock_db.execute.return_value.scalar_one_or_none.return_value = 99

    result = detect_nearby_zone(
        mock_db,
        latitude=12.9,
        longitude=77.5,
        radius_meters=50,
    )

    assert result == 99


def test_detect_nearby_zone_invalid_radius():
    mock_db = MagicMock()

    with pytest.raises(ValidationError):
        detect_nearby_zone(
            mock_db,
            latitude=12.9,
            longitude=77.5,
            radius_meters=1000,  # exceeds max
        )


# =========================================================
# resolve_zone_for_location
# =========================================================

def test_resolve_zone_strict_match(monkeypatch):
    mock_db = MagicMock()

    monkeypatch.setattr(
        "app.services.geofence_service.detect_zone",
        lambda *args, **kwargs: 10,
    )

    zone_id, strict = resolve_zone_for_location(
        mock_db,
        latitude=12.9,
        longitude=77.5,
    )

    assert zone_id == 10
    assert strict is True


def test_resolve_zone_proximity_match(monkeypatch):
    mock_db = MagicMock()

    monkeypatch.setattr(
        "app.services.geofence_service.detect_zone",
        lambda *args, **kwargs: None,
    )

    monkeypatch.setattr(
        "app.services.geofence_service.detect_nearby_zone",
        lambda *args, **kwargs: 20,
    )

    zone_id, strict = resolve_zone_for_location(
        mock_db,
        latitude=12.9,
        longitude=77.5,
    )

    assert zone_id == 20
    assert strict is False