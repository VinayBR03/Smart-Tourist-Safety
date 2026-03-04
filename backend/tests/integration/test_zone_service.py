import pytest
from sqlalchemy.exc import IntegrityError

from app.services.zone_service import (
    create_circular_zone,
    create_polygon_zone,
    update_zone,
)

from app.services.risk_engine_service import persist_zone_risk

from app.models.zone import Zone
from app.models.zone_status import ZoneStatus
from app.models.zone_risk_history import ZoneRiskHistory

from app.core.enums import RiskLevel
from app.core.exceptions import ValidationError, ConflictError


# =========================================================
# GLOBAL SIDE EFFECT MOCKS
# =========================================================

@pytest.fixture(autouse=True)
def mock_side_effects(mocker):
    mocker.patch("app.services.zone_service.create_audit_log")
    mocker.patch("app.services.zone_service.create_outbox_event")
    mocker.patch("app.services.zone_service.update_zone_status")

    mocker.patch("app.services.risk_engine_service.create_audit_log")
    mocker.patch("app.services.risk_engine_service.create_outbox_event")
    mocker.patch("app.services.risk_engine_service.create_notification")


# =========================================================
# ZONE CREATION TESTS
# =========================================================

def test_create_circular_zone_success(db_session):

    zone = create_circular_zone(
        db=db_session,
        name="Safe Area",
        zone_type="public",
        center_latitude=12.9,
        center_longitude=77.5,
        radius_meters=500,
    )

    db_session.commit()

    saved = db_session.get(Zone, zone.id)

    assert saved is not None
    assert saved.is_active is True
    assert saved.geometry is not None


def test_create_polygon_zone_success(db_session):

    coords = [
        (77.5, 12.9),
        (77.6, 12.9),
        (77.6, 13.0),
        (77.5, 12.9),
    ]

    zone = create_polygon_zone(
        db=db_session,
        name="Polygon Zone",
        zone_type="restricted",
        coordinates=coords,
    )

    db_session.commit()

    assert db_session.get(Zone, zone.id) is not None


def test_polygon_not_closed_rejected(db_session):

    coords = [
        (77.5, 12.9),
        (77.6, 12.9),
        (77.6, 13.0),
    ]

    with pytest.raises(ValidationError):
        create_polygon_zone(
            db=db_session,
            name="Bad Polygon",
            zone_type=None,
            coordinates=coords,
        )


def test_duplicate_zone_name_case_insensitive(db_session):

    create_circular_zone(
        db=db_session,
        name="DANGER",
        zone_type=None,
        center_latitude=12.9,
        center_longitude=77.5,
        radius_meters=200,
    )

    db_session.commit()

    with pytest.raises(ConflictError):
        create_circular_zone(
            db=db_session,
            name="danger",
            zone_type=None,
            center_latitude=12.9,
            center_longitude=77.5,
            radius_meters=200,
        )


# =========================================================
# STATUS & RISK PERSISTENCE
# =========================================================

def test_zone_status_created_and_updated(db_session):

    zone = create_circular_zone(
        db=db_session,
        name="Risk Zone",
        zone_type=None,
        center_latitude=12.9,
        center_longitude=77.5,
        radius_meters=300,
    )
    db_session.commit()

    persist_zone_risk(
        db=db_session,
        zone_id=zone.id,
        risk_score=0.8,
        risk_level=RiskLevel.HIGH,
        model_version="test_v1",
    )

    db_session.commit()

    status = (
        db_session.query(ZoneStatus)
        .filter_by(zone_id=zone.id)
        .first()
    )

    assert status is not None
    assert status.risk_level == RiskLevel.HIGH.value
    assert float(status.risk_score) == 0.8


def test_zone_risk_history_append_only(db_session):

    zone = create_circular_zone(
        db=db_session,
        name="History Zone",
        zone_type=None,
        center_latitude=12.9,
        center_longitude=77.5,
        radius_meters=300,
    )
    db_session.commit()

    # First persist
    persist_zone_risk(
        db=db_session,
        zone_id=zone.id,
        risk_score=0.2,
        risk_level=RiskLevel.LOW,
        model_version="v1",
    )
    db_session.flush()  # IMPORTANT FIX

    # Second persist
    persist_zone_risk(
        db=db_session,
        zone_id=zone.id,
        risk_score=0.9,
        risk_level=RiskLevel.HIGH,
        model_version="v2",
    )

    db_session.commit()

    history = (
        db_session.query(ZoneRiskHistory)
        .filter_by(zone_id=zone.id)
        .all()
    )

    assert len(history) == 2


def test_risk_score_clamped_to_valid_range(db_session):

    zone = create_circular_zone(
        db=db_session,
        name="Clamp Zone",
        zone_type=None,
        center_latitude=12.9,
        center_longitude=77.5,
        radius_meters=300,
    )
    db_session.commit()

    # Score beyond allowed range
    persist_zone_risk(
        db=db_session,
        zone_id=zone.id,
        risk_score=2.0,  # should clamp to 1.0
        risk_level=RiskLevel.HIGH,
        model_version="bad",
    )

    db_session.commit()

    status = (
        db_session.query(ZoneStatus)
        .filter_by(zone_id=zone.id)
        .first()
    )

    assert float(status.risk_score) == 1.0


# =========================================================
# UPDATE BEHAVIOR
# =========================================================

def test_zone_deactivation_triggers_risk_reset(db_session, mocker):

    mock_persist = mocker.patch(
        "app.services.zone_service.persist_zone_risk"
    )

    zone = create_circular_zone(
        db=db_session,
        name="Deactivate Zone",
        zone_type=None,
        center_latitude=12.9,
        center_longitude=77.5,
        radius_meters=200,
    )
    db_session.commit()

    update_zone(
        db=db_session,
        zone_id=zone.id,
        name=None,
        zone_type=None,
        is_active=False,
    )

    assert mock_persist.called


def test_zone_rename_enforces_uniqueness(db_session):

    z1 = create_circular_zone(
        db=db_session,
        name="Zone A",
        zone_type=None,
        center_latitude=12.9,
        center_longitude=77.5,
        radius_meters=200,
    )

    z2 = create_circular_zone(
        db=db_session,
        name="Zone B",
        zone_type=None,
        center_latitude=12.9,
        center_longitude=77.5,
        radius_meters=200,
    )

    db_session.commit()

    with pytest.raises(ConflictError):
        update_zone(
            db=db_session,
            zone_id=z2.id,
            name="Zone A",
            zone_type=None,
            is_active=None,
        )


# =========================================================
# SOFT DELETE CONSISTENCY
# =========================================================

def test_soft_delete_consistency_constraint(db_session):

    zone = create_circular_zone(
        db=db_session,
        name="Soft Delete Zone",
        zone_type=None,
        center_latitude=12.9,
        center_longitude=77.5,
        radius_meters=200,
    )
    db_session.commit()

    zone.is_deleted = True
    zone.deleted_at = None  # invalid combination

    db_session.add(zone)

    with pytest.raises(IntegrityError):
        db_session.commit()