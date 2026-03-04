import pytest
import asyncio
from unittest.mock import MagicMock, patch

from app.workers import kafka_consumer


# =========================================================
# DESERIALIZERS
# =========================================================

def test_deserialize_value():
    raw = b'{"x": 1}'
    result = kafka_consumer._deserialize_value(raw)
    assert result == {"x": 1}


def test_deserialize_key():
    assert kafka_consumer._deserialize_key(b"abc") == "abc"
    assert kafka_consumer._deserialize_key(None) is None


# =========================================================
# REDIS PUBLISH
# =========================================================

def test_publish_to_redis_success(mocker):
    mock_redis = MagicMock()
    mocker.patch(
        "app.workers.kafka_consumer.get_redis",
        return_value=mock_redis,
    )

    kafka_consumer._publish_to_redis({"x": 1})

    mock_redis.publish.assert_called_once()


def test_publish_to_redis_no_client(mocker):
    mocker.patch(
        "app.workers.kafka_consumer.get_redis",
        return_value=None,
    )

    # Should not raise
    kafka_consumer._publish_to_redis({"x": 1})


def test_publish_to_redis_handles_exception(mocker):
    mock_redis = MagicMock()
    mock_redis.publish.side_effect = Exception("boom")

    mocker.patch(
        "app.workers.kafka_consumer.get_redis",
        return_value=mock_redis,
    )

    logger_exception = mocker.patch(
        "app.workers.kafka_consumer.logger.exception"
    )

    kafka_consumer._publish_to_redis({"x": 1})

    logger_exception.assert_called_once()


# =========================================================
# HANDLE EVENT
# =========================================================

def test_handle_event_valid_record(mocker):
    mock_publish = mocker.patch(
        "app.workers.kafka_consumer._publish_to_redis"
    )

    record = MagicMock()
    record.value = {
        "event_type": "incident.created",
        "data": {"id": 1},
        "correlation_id": "corr-123",
    }

    kafka_consumer._handle_event(record)

    mock_publish.assert_called_once()


def test_handle_event_invalid_payload():
    record = MagicMock()
    record.value = "not-a-dict"

    # Should not raise
    kafka_consumer._handle_event(record)


def test_handle_event_handles_exception(mocker):
    mocker.patch(
        "app.workers.kafka_consumer._publish_to_redis",
        side_effect=Exception("boom"),
    )

    logger_exception = mocker.patch(
        "app.workers.kafka_consumer.logger.exception"
    )

    record = MagicMock()
    record.value = {"event_type": "x"}

    kafka_consumer._handle_event(record)

    logger_exception.assert_called_once()


# =========================================================
# CONSUMER DISABLED
# =========================================================

@pytest.mark.asyncio
async def test_consumer_disabled(mocker):
    mocker.patch(
        "app.workers.kafka_consumer.settings.ENABLE_KAFKA",
        False,
    )

    logger_info = mocker.patch(
        "app.workers.kafka_consumer.logger.info"
    )

    await kafka_consumer.start_kafka_consumer()

    logger_info.assert_called_once()


# =========================================================
# CONSUMER POLL HANDLING (SINGLE ITERATION)
# =========================================================

@pytest.mark.asyncio
async def test_consumer_handles_single_poll_cycle(mocker):
    mocker.patch(
        "app.workers.kafka_consumer.settings.ENABLE_KAFKA",
        True,
    )

    mock_consumer = MagicMock()
    mock_record = MagicMock()
    mock_record.value = {
        "event_type": "incident.created",
        "data": {"id": 1},
        "correlation_id": "c1",
    }

    mock_consumer.poll.side_effect = [
        {0: [mock_record]},  # first loop
        KeyboardInterrupt(),  # break loop safely
    ]

    mocker.patch(
        "app.workers.kafka_consumer._create_consumer",
        return_value=mock_consumer,
    )

    mock_handle = mocker.patch(
        "app.workers.kafka_consumer._handle_event"
    )

    try:
        await kafka_consumer.start_kafka_consumer()
    except KeyboardInterrupt:
        pass

    mock_handle.assert_called_once()
    mock_consumer.close.assert_called_once()