import pytest
from datetime import datetime, timezone, timedelta

from sqlalchemy.exc import IntegrityError

from app.services.outbox_service import (
    create_outbox_event,
    process_outbox_events,
)

from app.models.event_outbox import EventOutbox
from app.core.exceptions import ValidationError


# =========================================================
# GLOBAL MOCKS
# =========================================================

@pytest.fixture(autouse=True)
def mock_kafka(mocker):
    mocker.patch("app.services.outbox_service.publish_event")


# =========================================================
# CREATE EVENT
# =========================================================

def test_create_outbox_event_success(db_session):

    event = create_outbox_event(
        db=db_session,
        topic="user.created",
        payload={"user_id": 1},
        event_type="USER_CREATED",
        partition_key="1",
    )

    db_session.commit()

    stored = db_session.query(EventOutbox).first()

    assert stored is not None
    assert stored.topic == "user.created"
    assert stored.is_published is False
    assert stored.retry_count == 0


def test_create_outbox_invalid_topic(db_session):

    with pytest.raises(ValidationError):
        create_outbox_event(
            db=db_session,
            topic="",
            payload={"a": 1},
        )


def test_create_outbox_payload_not_dict(db_session):

    with pytest.raises(ValidationError):
        create_outbox_event(
            db=db_session,
            topic="test",
            payload="invalid",
        )


def test_payload_size_limit(db_session):

    large_payload = {"data": "x" * 60_000}

    with pytest.raises(ValidationError):
        create_outbox_event(
            db=db_session,
            topic="big.payload",
            payload=large_payload,
        )


# =========================================================
# IDEMPOTENCY UNIQUE
# =========================================================

def test_idempotency_unique_constraint(db_session):

    create_outbox_event(
        db=db_session,
        topic="test",
        payload={"a": 1},
        correlation_id="abc",
    )

    db_session.commit()

    # Duplicate idempotency_key enforced at DB level
    event = EventOutbox(
        topic="test",
        payload={"a": 2},
        idempotency_key="unique-key",
    )

    db_session.add(event)
    db_session.commit()

    duplicate = EventOutbox(
        topic="test",
        payload={"a": 3},
        idempotency_key="unique-key",
    )

    db_session.add(duplicate)

    with pytest.raises(IntegrityError):
        db_session.commit()


# =========================================================
# SUCCESSFUL PUBLISH
# =========================================================

def test_process_outbox_success(db_session):

    create_outbox_event(
        db=db_session,
        topic="order.created",
        payload={"order_id": 123},
    )

    db_session.commit()

    process_outbox_events(db_session)

    db_session.commit()

    event = db_session.query(EventOutbox).first()

    assert event.is_published is True
    assert event.published_at is not None
    assert event.retry_count == 0
    assert event.next_retry_at is None


# =========================================================
# RETRY LOGIC
# =========================================================

def test_process_outbox_retry(db_session, mocker):

    mocker.patch(
        "app.services.outbox_service.publish_event",
        side_effect=Exception("Kafka failure"),
    )

    create_outbox_event(
        db=db_session,
        topic="order.failed",
        payload={"order_id": 999},
    )

    db_session.commit()

    process_outbox_events(db_session)
    db_session.commit()

    event = db_session.query(EventOutbox).first()

    assert event.is_published is False
    assert event.retry_count == 1
    assert event.next_retry_at is not None
    assert event.last_error is not None


# =========================================================
# MAX RETRY STOP
# =========================================================

def test_max_retry_limit(db_session, mocker):

    mocker.patch(
        "app.services.outbox_service.publish_event",
        side_effect=Exception("Kafka failure"),
    )

    event = create_outbox_event(
        db=db_session,
        topic="retry.limit",
        payload={"x": 1},
    )

    db_session.commit()

    # Simulate near max retries
    event.retry_count = 5
    db_session.commit()

    process_outbox_events(db_session)
    db_session.commit()

    refreshed = db_session.query(EventOutbox).first()

    # Should not increment further
    assert refreshed.retry_count == 5


# =========================================================
# BATCH LIMIT
# =========================================================

def test_batch_limit(db_session):

    for i in range(5):
        create_outbox_event(
            db=db_session,
            topic=f"batch.{i}",
            payload={"i": i},
        )

    db_session.commit()

    process_outbox_events(db_session, batch_size=2)
    db_session.commit()

    published_count = (
        db_session.query(EventOutbox)
        .filter(EventOutbox.is_published.is_(True))
        .count()
    )

    assert published_count == 2


# =========================================================
# ALREADY PUBLISHED NOT REPUBLISHED
# =========================================================

def test_already_published_not_reprocessed(db_session):

    event = create_outbox_event(
        db=db_session,
        topic="already.done",
        payload={"a": 1},
    )

    db_session.commit()

    event.is_published = True
    event.published_at = datetime.now(timezone.utc)
    db_session.commit()

    process_outbox_events(db_session)
    db_session.commit()

    refreshed = db_session.query(EventOutbox).first()

    assert refreshed.retry_count == 0