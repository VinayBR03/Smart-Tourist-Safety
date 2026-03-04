import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock

from app.services import throttle_service
from app.core.exceptions import ValidationError, ForbiddenError
from redis.exceptions import RedisError


# =========================================================
# LOCATION THROTTLE TESTS
# =========================================================

def test_should_accept_no_last_timestamp():
    assert throttle_service.should_accept_location(
        last_timestamp=None,
        battery_percentage=None,
    ) is True


def test_future_timestamp_allowed():
    future = datetime.now(timezone.utc) + timedelta(minutes=5)

    assert throttle_service.should_accept_location(
        last_timestamp=future,
        battery_percentage=50,
    ) is True


def test_default_interval_respected():
    now = datetime.now(timezone.utc)
    past = now - timedelta(seconds=20)

    # Default fallback is 15 seconds
    assert throttle_service.should_accept_location(
        last_timestamp=past,
        battery_percentage=50,
    ) is True


def test_low_battery_interval():
    now = datetime.now(timezone.utc)
    past = now - timedelta(seconds=30)

    # Default low battery threshold fallback = 20
    # Default low battery interval fallback = 60 (from code)
    assert throttle_service.should_accept_location(
        last_timestamp=past,
        battery_percentage=10,
    ) is False


def test_invalid_battery_value():
    now = datetime.now(timezone.utc)
    past = now - timedelta(seconds=20)

    assert throttle_service.should_accept_location(
        last_timestamp=past,
        battery_percentage="invalid",
    ) is True


# =========================================================
# VALIDATION TESTS
# =========================================================

def test_invalid_identifier():
    with pytest.raises(ValidationError):
        throttle_service.enforce_rate_limit(
            identifier="",
            prefix="api",
            limit=10,
            window_seconds=60,
        )


def test_invalid_prefix_colon():
    with pytest.raises(ValidationError):
        throttle_service.enforce_rate_limit(
            identifier="user1",
            prefix="bad:prefix",
            limit=10,
            window_seconds=60,
        )


def test_invalid_limit():
    with pytest.raises(ValidationError):
        throttle_service.enforce_rate_limit(
            identifier="user1",
            prefix="api",
            limit=0,
            window_seconds=60,
        )


# =========================================================
# REDIS RATE LIMITER TESTS
# =========================================================

def test_no_redis_fail_open(monkeypatch):
    monkeypatch.setattr(
        throttle_service,
        "get_redis",
        lambda strict=False: None
    )

    # Should not raise
    throttle_service.enforce_rate_limit(
        identifier="user1",
        prefix="api",
        limit=5,
        window_seconds=60,
        fail_open=True,
    )


def test_no_redis_fail_closed(monkeypatch):
    monkeypatch.setattr(
        throttle_service,
        "get_redis",
        lambda strict=False: None
    )

    with pytest.raises(ForbiddenError):
        throttle_service.enforce_rate_limit(
            identifier="user1",
            prefix="api",
            limit=5,
            window_seconds=60,
            fail_open=False,
        )


def test_within_limit(monkeypatch):
    fake_redis = MagicMock()
    fake_pipeline = MagicMock()

    fake_pipeline.execute.return_value = [None, None, 3, None]
    fake_redis.pipeline.return_value = fake_pipeline

    throttle_service.enforce_rate_limit(
        identifier="user1",
        prefix="api",
        limit=5,
        window_seconds=60,
        redis_client=fake_redis,
    )


def test_exceed_limit(monkeypatch):
    fake_redis = MagicMock()
    fake_pipeline = MagicMock()

    fake_pipeline.execute.return_value = [None, None, 10, None]
    fake_redis.pipeline.return_value = fake_pipeline

    with pytest.raises(ForbiddenError):
        throttle_service.enforce_rate_limit(
            identifier="user1",
            prefix="api",
            limit=5,
            window_seconds=60,
            redis_client=fake_redis,
        )


def test_redis_error_fail_open(monkeypatch):
    fake_redis = MagicMock()
    fake_pipeline = MagicMock()
    fake_pipeline.execute.side_effect = RedisError()
    fake_redis.pipeline.return_value = fake_pipeline

    throttle_service.enforce_rate_limit(
        identifier="user1",
        prefix="api",
        limit=5,
        window_seconds=60,
        redis_client=fake_redis,
        fail_open=True,
    )


def test_redis_error_fail_closed(monkeypatch):
    fake_redis = MagicMock()
    fake_pipeline = MagicMock()
    fake_pipeline.execute.side_effect = RedisError()
    fake_redis.pipeline.return_value = fake_pipeline

    with pytest.raises(ForbiddenError):
        throttle_service.enforce_rate_limit(
            identifier="user1",
            prefix="api",
            limit=5,
            window_seconds=60,
            redis_client=fake_redis,
            fail_open=False,
        )