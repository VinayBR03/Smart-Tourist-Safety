import pytest
from datetime import datetime
from app.schemas.zone_schema import (
    ZoneCreateCircularRequest,
    ZoneCreatePolygonRequest,
    ZoneUpdateRequest,
    ZoneStatusResponse,
    ZoneRiskHistoryResponse,
)
from app.core.enums import RiskLevel


# =========================================================
# CIRCULAR ZONE VALIDATION
# =========================================================

def test_circular_zone_name_too_short():
    with pytest.raises(ValueError):
        ZoneCreateCircularRequest(
            name="ab",
            zone_type="safe",
            center_latitude=10.0,
            center_longitude=10.0,
            radius_meters=100,
        )


def test_circular_zone_radius_exceeds_limit():
    with pytest.raises(ValueError):
        ZoneCreateCircularRequest(
            name="Valid Name",
            zone_type="safe",
            center_latitude=10.0,
            center_longitude=10.0,
            radius_meters=60000,
        )


# =========================================================
# POLYGON VALIDATION
# =========================================================

def test_polygon_requires_min_points():
    with pytest.raises(ValueError):
        ZoneCreatePolygonRequest(
            name="Valid Zone",
            zone_type="safe",
            coordinates=[
                (77.0, 12.0),
                (78.0, 12.0),
                (77.0, 12.0),
            ],
        )


def test_polygon_must_be_closed():
    with pytest.raises(ValueError):
        ZoneCreatePolygonRequest(
            name="Valid Zone",
            zone_type="safe",
            coordinates=[
                (77.0, 12.0),
                (78.0, 12.0),
                (78.0, 13.0),
                (77.0, 13.0),
            ],
        )


def test_polygon_invalid_longitude():
    with pytest.raises(ValueError):
        ZoneCreatePolygonRequest(
            name="Valid Zone",
            zone_type="safe",
            coordinates=[
                (200.0, 12.0),
                (78.0, 12.0),
                (78.0, 13.0),
                (200.0, 12.0),
            ],
        )


def test_polygon_duplicate_consecutive_points():
    with pytest.raises(ValueError):
        ZoneCreatePolygonRequest(
            name="Valid Zone",
            zone_type="safe",
            coordinates=[
                (77.0, 12.0),
                (77.0, 12.0),
                (78.0, 13.0),
                (77.0, 12.0),
            ],
        )


# =========================================================
# UPDATE VALIDATION
# =========================================================

def test_update_zone_name_too_short():
    with pytest.raises(ValueError):
        ZoneUpdateRequest(name="ab")


# =========================================================
# RISK SCORE VALIDATION
# =========================================================

def test_risk_score_out_of_range():
    with pytest.raises(ValueError):
        ZoneStatusResponse(
            zone_id=1,
            risk_score=1.5,
            risk_level=RiskLevel.HIGH,
            model_version="v1",
            updated_at=datetime.utcnow(),
        )


def test_risk_low_alignment_invalid():
    with pytest.raises(ValueError):
        ZoneStatusResponse(
            zone_id=1,
            risk_score=0.5,
            risk_level=RiskLevel.LOW,
            model_version="v1",
            updated_at=datetime.utcnow(),
        )


def test_risk_medium_alignment_invalid():
    with pytest.raises(ValueError):
        ZoneStatusResponse(
            zone_id=1,
            risk_score=0.9,
            risk_level=RiskLevel.MEDIUM,
            model_version="v1",
            updated_at=datetime.utcnow(),
        )


def test_risk_high_alignment_invalid():
    with pytest.raises(ValueError):
        ZoneStatusResponse(
            zone_id=1,
            risk_score=0.5,
            risk_level=RiskLevel.HIGH,
            model_version="v1",
            updated_at=datetime.utcnow(),
        )


# =========================================================
# RISK HISTORY ALIGNMENT
# =========================================================

def test_risk_history_invalid_alignment():
    with pytest.raises(ValueError):
        ZoneRiskHistoryResponse(
            zone_id=1,
            risk_score=0.2,
            risk_level=RiskLevel.HIGH,
            model_version="v1",
            recorded_at=datetime.utcnow(),
        )