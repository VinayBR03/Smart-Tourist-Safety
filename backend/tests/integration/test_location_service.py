import pytest
from shapely.geometry import Polygon
from geoalchemy2.shape import from_shape

from app.services.location_service import (
    update_user_location,
    get_latest_location_for_user,
    get_zone_presence_summary,
)

from app.models.location import Location
from app.models.location_event import LocationEvent
from app.models.user import User
from app.models.zone import Zone

from app.core.enums import UserRole
from app.core.exceptions import ValidationError, NotFoundError
from app.core.security import hash_password


# =========================================================
# TEST UTIL
# =========================================================

def create_active_user(db, email="test@test.com"):
    user = User(
        email=email,
        password_hash=hash_password("StrongPassword123!"),
        role=UserRole.TOURIST.value,
        is_active=True,
        is_pending_deletion=False,
    )
    db.add(user)
    db.commit()
    return user


def create_test_zone(db):
    polygon = Polygon([
        (77.0, 12.0),
        (78.0, 12.0),
        (78.0, 13.0),
        (77.0, 13.0),
        (77.0, 12.0),
    ])

    zone = Zone(
        name="Test Zone",
        zone_type="TEST",
        geometry=from_shape(polygon, srid=4326),
        is_active=True,
    )

    db.add(zone)
    db.commit()
    return zone


# =========================================================
# GLOBAL SIDE EFFECT MOCKS
# =========================================================

@pytest.fixture(autouse=True)
def mock_side_effects(mocker):
    mocker.patch("app.services.location_service.create_outbox_event")
    mocker.patch("app.services.location_service.create_audit_log")
    mocker.patch(
        "app.services.location_service.should_accept_location",
        return_value=True,
    )


# =========================================================
# SNAPSHOT CREATION
# =========================================================

def test_first_location_creates_snapshot_and_event(db_session, mocker):

    zone = create_test_zone(db_session)

    mocker.patch(
        "app.services.location_service.resolve_zone_for_location",
        return_value=(zone.id, None),
    )

    user = create_active_user(db_session)

    update_user_location(
        db=db_session,
        user_id=user.id,
        latitude=12.9716,
        longitude=77.5946,
        accuracy_meters=5,
        battery_percentage=90,
    )

    db_session.commit()

    stored = db_session.query(Location).filter_by(tourist_id=user.id).first()
    assert stored is not None

    events = db_session.query(LocationEvent).filter_by(tourist_id=user.id).all()
    assert len(events) == 1


# =========================================================
# SNAPSHOT UPDATE
# =========================================================

def test_location_updates_existing_snapshot(db_session, mocker):

    zone = create_test_zone(db_session)

    mocker.patch(
        "app.services.location_service.resolve_zone_for_location",
        return_value=(zone.id, None),
    )

    user = create_active_user(db_session)

    update_user_location(
        db=db_session,
        user_id=user.id,
        latitude=12.0,
        longitude=77.0,
        accuracy_meters=5,
        battery_percentage=80,
    )
    db_session.commit()

    update_user_location(
        db=db_session,
        user_id=user.id,
        latitude=12.001,
        longitude=77.001,
        accuracy_meters=5,
        battery_percentage=75,
    )
    db_session.commit()

    snapshot = db_session.query(Location).filter_by(tourist_id=user.id).first()
    assert snapshot.battery_percentage == 75

    events = db_session.query(LocationEvent).filter_by(tourist_id=user.id).all()
    assert len(events) == 2


# =========================================================
# MOVEMENT GUARD
# =========================================================

def test_unrealistic_speed_rejected(db_session, mocker):

    zone = create_test_zone(db_session)

    mocker.patch(
        "app.services.location_service.resolve_zone_for_location",
        return_value=(zone.id, None),
    )

    user = create_active_user(db_session)

    update_user_location(
        db=db_session,
        user_id=user.id,
        latitude=12.0,
        longitude=77.0,
        accuracy_meters=5,
        battery_percentage=80,
    )
    db_session.commit()

    with pytest.raises(ValidationError):
        update_user_location(
            db=db_session,
            user_id=user.id,
            latitude=28.7041,
            longitude=77.1025,
            accuracy_meters=5,
            battery_percentage=75,
        )


# =========================================================
# SMALL MOVEMENT IGNORED
# =========================================================

def test_small_movement_is_ignored(db_session, mocker):

    zone = create_test_zone(db_session)

    mocker.patch(
        "app.services.location_service.resolve_zone_for_location",
        return_value=(zone.id, None),
    )

    user = create_active_user(db_session)

    update_user_location(
        db=db_session,
        user_id=user.id,
        latitude=12.0000000,
        longitude=77.0000000,
        accuracy_meters=5,
        battery_percentage=80,
    )
    db_session.commit()

    update_user_location(
        db=db_session,
        user_id=user.id,
        latitude=12.0000001,
        longitude=77.0000001,
        accuracy_meters=5,
        battery_percentage=75,
    )
    db_session.commit()

    events = db_session.query(LocationEvent).filter_by(tourist_id=user.id).all()

    assert len(events) == 1


# =========================================================
# INACTIVE USER
# =========================================================

def test_inactive_user_rejected(db_session):

    user = User(
        email="inactive@test.com",
        password_hash=hash_password("StrongPassword123!"),
        role=UserRole.TOURIST.value,
        is_active=False,
        is_pending_deletion=False,
    )

    db_session.add(user)
    db_session.commit()

    with pytest.raises(NotFoundError):
        update_user_location(
            db=db_session,
            user_id=user.id,
            latitude=12.0,
            longitude=77.0,
            accuracy_meters=5,
            battery_percentage=50,
        )


# =========================================================
# LATEST LOCATION
# =========================================================

def test_get_latest_location_success(db_session, mocker):

    zone = create_test_zone(db_session)

    mocker.patch(
        "app.services.location_service.resolve_zone_for_location",
        return_value=(zone.id, None),
    )

    user = create_active_user(db_session)

    update_user_location(
        db=db_session,
        user_id=user.id,
        latitude=12.5,
        longitude=77.2,
        accuracy_meters=5,
        battery_percentage=60,
    )
    db_session.commit()

    location = get_latest_location_for_user(
        db=db_session,
        user_id=user.id,
    )

    assert location.tourist_id == user.id


def test_get_latest_location_not_found(db_session):

    with pytest.raises(NotFoundError):
        get_latest_location_for_user(
            db=db_session,
            user_id=999,
        )


# =========================================================
# ZONE PRESENCE
# =========================================================

def test_zone_presence_summary(db_session, mocker):

    zone = create_test_zone(db_session)

    mocker.patch(
        "app.services.location_service.resolve_zone_for_location",
        return_value=(zone.id, None),
    )

    user1 = create_active_user(db_session, email="u1@test.com")
    user2 = create_active_user(db_session, email="u2@test.com")

    update_user_location(
        db=db_session,
        user_id=user1.id,
        latitude=12.9,
        longitude=77.5,
        accuracy_meters=5,
        battery_percentage=90,
    )

    update_user_location(
        db=db_session,
        user_id=user2.id,
        latitude=12.9,
        longitude=77.5,
        accuracy_meters=5,
        battery_percentage=90,
    )

    db_session.commit()

    summary = get_zone_presence_summary(db_session)

    assert len(summary) == 1
    assert summary[0]["tourist_count"] == 2