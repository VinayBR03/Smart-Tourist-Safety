import pytest
from unittest.mock import MagicMock, patch

from app.core import kafka


# =========================================================
# HELPERS
# =========================================================

def setup_producer_mock(mocker):
    mock_producer = MagicMock()
    kafka.producer = mock_producer
    return mock_producer


# =========================================================
# KAFKA DISABLED
# =========================================================

def test_publish_event_skips_when_producer_none(mocker):
    kafka.producer = None

    logger_warning = mocker.patch("app.core.kafka.logger.warning")

    kafka.publish_event(
        topic="test.topic",
        payload={"x": 1},
    )

    logger_warning.assert_called_once()


# =========================================================
# SUCCESSFUL PUBLISH
# =========================================================

def test_publish_event_success(mocker):
    mock_producer = setup_producer_mock(mocker)

    mock_future = MagicMock()
    mock_producer.send.return_value = mock_future

    kafka.publish_event(
        topic="incident.created",
        payload={"id": 1},
        partition_key="key1",
        event_type="incident.created",
        correlation_id="corr-123",
    )

    # Producer send called
    mock_producer.send.assert_called_once()

    args, kwargs = mock_producer.send.call_args
    assert kwargs["topic"] == "incident.created"
    assert kwargs["key"] == "key1"

    # Envelope structure
    event = kwargs["value"]
    assert event["event_type"] == "incident.created"
    assert event["correlation_id"] == "corr-123"
    assert event["data"] == {"id": 1}
    assert "event_id" in event
    assert "occurred_at" in event

    # Callbacks registered
    mock_future.add_callback.assert_called_once()
    mock_future.add_errback.assert_called_once()


# =========================================================
# WAIT FOR ACK
# =========================================================

def test_publish_event_wait_for_ack(mocker):
    mock_producer = setup_producer_mock(mocker)

    mock_future = MagicMock()
    mock_producer.send.return_value = mock_future

    kafka.publish_event(
        topic="test.topic",
        payload={"x": 1},
        wait_for_ack=True,
    )

    mock_future.get.assert_called_once_with(timeout=10)


# =========================================================
# KAFKA ERROR HANDLING
# =========================================================

def test_publish_event_handles_kafka_error(mocker):
    mock_producer = setup_producer_mock(mocker)

    mock_producer.send.side_effect = kafka.KafkaError("boom")

    logger_exception = mocker.patch("app.core.kafka.logger.exception")

    kafka.publish_event(
        topic="test.topic",
        payload={"x": 1},
    )

    logger_exception.assert_called_once()


# =========================================================
# CALLBACK SUCCESS
# =========================================================

def test_on_success_logs(mocker):
    logger_debug = mocker.patch("app.core.kafka.logger.debug")

    metadata = MagicMock()
    metadata.topic = "t"
    metadata.partition = 1
    metadata.offset = 10

    kafka._on_success(metadata)

    logger_debug.assert_called_once()


# =========================================================
# CALLBACK ERROR
# =========================================================

def test_on_error_logs(mocker):
    logger_error = mocker.patch("app.core.kafka.logger.error")

    kafka._on_error(Exception("fail"))

    logger_error.assert_called_once()


# =========================================================
# SHUTDOWN FLUSHES PRODUCER
# =========================================================

def test_shutdown_flush_and_close(mocker):
    mock_producer = MagicMock()
    kafka.producer = mock_producer

    kafka._shutdown()

    mock_producer.flush.assert_called_once_with(timeout=10)
    mock_producer.close.assert_called_once_with(timeout=5)