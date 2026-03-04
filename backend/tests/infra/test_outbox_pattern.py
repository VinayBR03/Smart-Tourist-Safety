import pytest
from unittest.mock import MagicMock
from datetime import datetime, timezone

from app.services import outbox_service
from app.core.exceptions import ValidationError
from app.models.event_outbox import EventOutbox


# =========================================================
# CREATE EVENT VALIDATION
# =========================================================

def test_create_outbox_requires_db():
    with pytest.raises(ValidationError):
        outbox_service.create_outbox_event(
            None,
            topic="t",
            payload={}
        )


def test_create_outbox_invalid_topic():
    db = MagicMock()

    with pytest.raises(ValidationError):
        outbox_service.create_outbox_event(
            db,
            topic="",
            payload={}
        )


def test_create_outbox_invalid_payload():
    db = MagicMock()

    with pytest.raises(ValidationError):
        outbox_service.create_outbox_event(
            db,
            topic="topic",
            payload="not-dict"
        )


def test_create_outbox_payload_too_large(mocker):
    db = MagicMock()

    large_payload = {"data": "x" * 60_000}

    with pytest.raises(ValidationError):
        outbox_service.create_outbox_event(
            db,
            topic="topic",
            payload=large_payload
        )


def test_create_outbox_success(mocker):
    db = MagicMock()

    event = outbox_service.create_outbox_event(
        db,
        topic="incident.created",
        payload={"id": 1}
    )

    assert isinstance(event, EventOutbox)
    db.add.assert_called_once()


# =========================================================
# PROCESS EVENTS VALIDATION
# =========================================================

def test_process_outbox_requires_db():
    with pytest.raises(ValidationError):
        outbox_service.process_outbox_events(None)


def test_process_outbox_invalid_batch_size():
    db = MagicMock()

    with pytest.raises(ValidationError):
        outbox_service.process_outbox_events(db, batch_size=0)

    with pytest.raises(ValidationError):
        outbox_service.process_outbox_events(db, batch_size=2000)


# =========================================================
# PROCESS EVENTS SUCCESS
# =========================================================

def test_process_outbox_publishes(mocker):
    db = MagicMock()

    event = MagicMock(spec=EventOutbox)
    event.is_published = False
    event.retry_count = 0
    event.topic = "incident.created"
    event.payload = {"id": 1}
    event.partition_key = None
    event.event_type = None
    event.correlation_id = None
    event.id = 10

    db.execute.return_value.scalars.return_value.all.return_value = [event]

    mock_publish = mocker.patch(
        "app.services.outbox_service.publish_event"
    )

    outbox_service.process_outbox_events(db)

    mock_publish.assert_called_once()
    assert event.is_published is True
    assert event.published_at is not None
    assert event.last_error is None


# =========================================================
# PROCESS EVENTS RETRY FLOW
# =========================================================

def test_process_outbox_retry_on_failure(mocker):
    db = MagicMock()

    event = MagicMock(spec=EventOutbox)
    event.is_published = False
    event.retry_count = 0
    event.topic = "incident.created"
    event.payload = {}
    event.partition_key = None
    event.event_type = None
    event.correlation_id = None
    event.id = 20

    db.execute.return_value.scalars.return_value.all.return_value = [event]

    mocker.patch(
        "app.services.outbox_service.publish_event",
        side_effect=Exception("Kafka down")
    )

    outbox_service.process_outbox_events(db)

    assert event.retry_count == 1
    assert event.next_retry_at is not None
    assert event.last_error is not None


# =========================================================
# RETRY CAP ENFORCEMENT
# =========================================================

def test_retry_cap_blocks_publish(mocker):
    event = MagicMock(spec=EventOutbox)
    event.is_published = False
    event.retry_count = outbox_service.MAX_RETRY_ATTEMPTS
    event.id = 30

    mock_publish = mocker.patch(
        "app.services.outbox_service.publish_event"
    )

    outbox_service._publish_single_event(event)

    mock_publish.assert_not_called()


# =========================================================
# IDEMPOTENT PUBLISH
# =========================================================

def test_already_published_event_not_republished(mocker):
    event = MagicMock(spec=EventOutbox)
    event.is_published = True

    mock_publish = mocker.patch(
        "app.services.outbox_service.publish_event"
    )

    outbox_service._publish_single_event(event)

    mock_publish.assert_not_called()