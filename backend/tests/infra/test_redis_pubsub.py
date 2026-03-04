import pytest
import asyncio
from unittest.mock import MagicMock

from redis.exceptions import RedisError

from app.core.redis import RedisClient
from app.realtime import redis_listener


# =========================================================
# REDIS CLIENT CREATION
# =========================================================

def test_get_client_disabled(mocker):
    mocker.patch("app.core.redis.settings.ENABLE_REDIS", False)

    with pytest.raises(RuntimeError):
        RedisClient.get_client(strict=True)

    assert RedisClient.get_client(strict=False) is None


def test_get_client_success(mocker):
    mocker.patch("app.core.redis.settings.ENABLE_REDIS", True)

    mock_client = MagicMock()
    mock_client.ping.return_value = True

    mocker.patch(
        "app.core.redis.RedisClient._create_client",
        return_value=mock_client,
    )

    client = RedisClient.get_client()
    assert client == mock_client
    mock_client.ping.assert_called()


def test_get_client_reconnect_on_ping_failure(mocker):
    mocker.patch("app.core.redis.settings.ENABLE_REDIS", True)

    mock_client = MagicMock()
    mock_client.ping.side_effect = RedisError("lost")

    mocker.patch(
        "app.core.redis.RedisClient._create_client",
        return_value=mock_client,
    )

    RedisClient._instance = mock_client

    # Should attempt reconnect safely
    RedisClient.get_client(strict=False)


# =========================================================
# ROUTE EVENT
# =========================================================

@pytest.mark.asyncio
async def test_route_event_to_user(mocker):
    mock_send = mocker.patch(
        "app.realtime.redis_listener.websocket_manager.broadcast_to_user"
    )

    event = {
        "event_type": "notification.created",
        "data": {"user_id": 1},
    }

    await redis_listener._route_event(event)

    mock_send.assert_called_once()


@pytest.mark.asyncio
async def test_route_event_authority_broadcast(mocker):
    mock_broadcast = mocker.patch(
        "app.realtime.redis_listener.websocket_manager.broadcast_to_role"
    )

    event = {
        "event_type": "incident.created",
        "data": {},
    }

    await redis_listener._route_event(event)

    mock_broadcast.assert_called_once()


@pytest.mark.asyncio
async def test_route_event_invalid_types():
    # Should not raise
    await redis_listener._route_event({"event_type": 123, "data": {}})
    await redis_listener._route_event({"event_type": "x", "data": "notdict"})


# =========================================================
# LISTENER DISABLED
# =========================================================

@pytest.mark.asyncio
async def test_listener_disabled(mocker):
    mocker.patch(
        "app.realtime.redis_listener.get_redis",
        return_value=None,
    )

    logger_warning = mocker.patch(
        "app.realtime.redis_listener.logger.warning"
    )

    await redis_listener.start_redis_listener()

    logger_warning.assert_called_once()


# =========================================================
# LISTENER SINGLE CYCLE
# =========================================================

@pytest.mark.asyncio
async def test_listener_processes_message(mocker):
    mock_pubsub = MagicMock()

    message = {
        "type": "message",
        "data": '{"event_type": "notification.created", "data": {"user_id": 1}}',
    }

    mock_pubsub.get_message.side_effect = [
        message,
        KeyboardInterrupt(),
    ]

    mock_redis = MagicMock()
    mock_redis.pubsub.return_value = mock_pubsub

    mocker.patch(
        "app.realtime.redis_listener.get_redis",
        return_value=mock_redis,
    )

    mock_route = mocker.patch(
        "app.realtime.redis_listener._route_event"
    )

    try:
        await redis_listener.start_redis_listener()
    except KeyboardInterrupt:
        pass

    mock_route.assert_called_once()
    mock_pubsub.close.assert_called_once()


# =========================================================
# INVALID JSON HANDLING
# =========================================================

@pytest.mark.asyncio
async def test_listener_invalid_json(mocker):
    mock_pubsub = MagicMock()

    message = {
        "type": "message",
        "data": "invalid-json",
    }

    mock_pubsub.get_message.side_effect = [
        message,
        KeyboardInterrupt(),
    ]

    mock_redis = MagicMock()
    mock_redis.pubsub.return_value = mock_pubsub

    mocker.patch(
        "app.realtime.redis_listener.get_redis",
        return_value=mock_redis,
    )

    logger_warning = mocker.patch(
        "app.realtime.redis_listener.logger.warning"
    )

    try:
        await redis_listener.start_redis_listener()
    except KeyboardInterrupt:
        pass

    logger_warning.assert_called_once()


# =========================================================
# REDIS ERROR HANDLING
# =========================================================

@pytest.mark.asyncio
async def test_listener_redis_error(mocker):
    mock_pubsub = MagicMock()
    mock_pubsub.get_message.side_effect = RedisError("boom")

    mock_redis = MagicMock()
    mock_redis.pubsub.return_value = mock_pubsub

    mocker.patch(
        "app.realtime.redis_listener.get_redis",
        return_value=mock_redis,
    )

    logger_exception = mocker.patch(
        "app.realtime.redis_listener.logger.exception"
    )

    try:
        await asyncio.wait_for(
            redis_listener.start_redis_listener(),
            timeout=0.2,
        )
    except asyncio.TimeoutError:
        pass

    logger_exception.assert_called()