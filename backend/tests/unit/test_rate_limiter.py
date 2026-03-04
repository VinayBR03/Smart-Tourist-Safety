import pytest
from unittest.mock import MagicMock
from redis.exceptions import RedisError
from fastapi import HTTPException, status

from app.core.rate_limiter import RateLimiter


# =========================================================
# Helpers
# =========================================================

class MockPipeline:
    def __init__(self, request_count=1):
        self.request_count = request_count

    def zremrangebyscore(self, *args, **kwargs):
        return self

    def zadd(self, *args, **kwargs):
        return self

    def zcard(self, *args, **kwargs):
        return self

    def expire(self, *args, **kwargs):
        return self

    def execute(self):
        # Simulate pipeline return values
        return (None, None, self.request_count, None)


# =========================================================
# Redis Disabled
# =========================================================

def test_rate_limiter_disabled(monkeypatch):
    monkeypatch.setattr(
        "app.core.rate_limiter.settings.ENABLE_RATE_LIMITER",
        False,
    )

    limiter = RateLimiter()

    # Should not raise
    limiter.enforce(
        prefix="test",
        identifier="user1",
        limit=5,
        window_seconds=60,
    )


# =========================================================
# Within Limit
# =========================================================

def test_rate_limiter_within_limit(monkeypatch):
    mock_redis = MagicMock()
    mock_redis.pipeline.return_value = MockPipeline(request_count=3)

    monkeypatch.setattr(
        "app.core.rate_limiter.settings.ENABLE_RATE_LIMITER",
        True,
    )

    limiter = RateLimiter(redis_client=mock_redis)

    limiter.enforce(
        prefix="login",
        identifier="user1",
        limit=5,
        window_seconds=60,
    )


# =========================================================
# Exceeds Limit
# =========================================================

def test_rate_limiter_exceeds_limit(monkeypatch):
    mock_redis = MagicMock()
    mock_redis.pipeline.return_value = MockPipeline(request_count=10)

    monkeypatch.setattr(
        "app.core.rate_limiter.settings.ENABLE_RATE_LIMITER",
        True,
    )

    limiter = RateLimiter(redis_client=mock_redis)

    with pytest.raises(HTTPException) as exc:
        limiter.enforce(
            prefix="login",
            identifier="user1",
            limit=5,
            window_seconds=60,
        )

    assert exc.value.status_code == status.HTTP_429_TOO_MANY_REQUESTS


# =========================================================
# Redis Failure - Fail Open
# =========================================================

def test_rate_limiter_redis_failure_fail_open(monkeypatch):
    mock_redis = MagicMock()

    mock_pipeline = MagicMock()
    mock_pipeline.execute.side_effect = RedisError("Redis down")

    mock_redis.pipeline.return_value = mock_pipeline

    monkeypatch.setattr(
        "app.core.rate_limiter.settings.ENABLE_RATE_LIMITER",
        True,
    )

    limiter = RateLimiter(redis_client=mock_redis, fail_open=True)

    # Should NOT raise
    limiter.enforce(
        prefix="login",
        identifier="user1",
        limit=5,
        window_seconds=60,
    )


# =========================================================
# Redis Failure - Fail Closed
# =========================================================

def test_rate_limiter_redis_failure_fail_closed(monkeypatch):
    mock_redis = MagicMock()

    mock_pipeline = MagicMock()
    mock_pipeline.execute.side_effect = RedisError("Redis down")

    mock_redis.pipeline.return_value = mock_pipeline

    monkeypatch.setattr(
        "app.core.rate_limiter.settings.ENABLE_RATE_LIMITER",
        True,
    )

    limiter = RateLimiter(redis_client=mock_redis, fail_open=False)

    with pytest.raises(HTTPException) as exc:
        limiter.enforce(
            prefix="login",
            identifier="user1",
            limit=5,
            window_seconds=60,
        )

    assert exc.value.status_code == status.HTTP_503_SERVICE_UNAVAILABLE