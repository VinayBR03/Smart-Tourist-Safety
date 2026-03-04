import pytest
import json
from unittest.mock import MagicMock
from redis.exceptions import RedisError


from app.core.idempotency import IdempotencyManager
from app.core.exceptions import ConflictError


# =========================================================
# Helpers
# =========================================================

class DummyRequest:
    def __init__(self, headers=None):
        self.headers = headers or {}


# =========================================================
# No Redis Available
# =========================================================

def test_no_redis(monkeypatch):
    manager = IdempotencyManager()
    manager.redis = None

    result = manager.process(
        request=DummyRequest(headers={"Idempotency-Key": "abc"}),
        payload={"a": 1},
        operation=lambda: "success",
    )

    assert result == "success"


# =========================================================
# No Idempotency Key Header
# =========================================================

def test_no_idempotency_key(monkeypatch):
    manager = IdempotencyManager()
    manager.redis = MagicMock()

    result = manager.process(
        request=DummyRequest(headers={}),
        payload={"a": 1},
        operation=lambda: "success",
    )

    assert result == "success"


# =========================================================
# First Execution (LOCK ACQUIRED)
# =========================================================

def test_first_execution(monkeypatch):
    mock_redis = MagicMock()

    # Lock acquired
    mock_redis.set.return_value = True

    manager = IdempotencyManager()
    manager.redis = mock_redis

    result = manager.process(
        request=DummyRequest(headers={"Idempotency-Key": "abc"}),
        payload={"a": 1},
        operation=lambda: "result1",
    )

    assert result == "result1"
    assert mock_redis.setex.called


# =========================================================
# Replay Same Payload
# =========================================================

def test_replay_same_payload(monkeypatch):
    mock_redis = MagicMock()

    manager = IdempotencyManager()
    manager.redis = mock_redis

    # Lock not acquired
    mock_redis.set.return_value = False

    stored_snapshot = {
        "payload_hash": manager._hash_payload({"a": 1}),
        "response": "cached_result",
    }

    mock_redis.get.return_value = json.dumps(stored_snapshot)

    result = manager.process(
        request=DummyRequest(headers={"Idempotency-Key": "abc"}),
        payload={"a": 1},
        operation=lambda: "new_result",
    )

    assert result == "cached_result"


# =========================================================
# Replay Different Payload
# =========================================================

def test_replay_different_payload(monkeypatch):
    mock_redis = MagicMock()

    manager = IdempotencyManager()
    manager.redis = mock_redis

    mock_redis.set.return_value = False

    stored_snapshot = {
        "payload_hash": manager._hash_payload({"a": 1}),
        "response": "cached_result",
    }

    mock_redis.get.return_value = json.dumps(stored_snapshot)

    with pytest.raises(ConflictError):
        manager.process(
            request=DummyRequest(headers={"Idempotency-Key": "abc"}),
            payload={"a": 2},
            operation=lambda: "new_result",
        )


# =========================================================
# Inconsistent Redis State
# =========================================================

def test_inconsistent_state(monkeypatch):
    mock_redis = MagicMock()

    manager = IdempotencyManager()
    manager.redis = mock_redis

    mock_redis.set.return_value = False
    mock_redis.get.return_value = None

    with pytest.raises(ConflictError):
        manager.process(
            request=DummyRequest(headers={"Idempotency-Key": "abc"}),
            payload={"a": 1},
            operation=lambda: "new_result",
        )


# =========================================================
# Redis Failure Fallback
# =========================================================

def test_redis_failure(monkeypatch):
    mock_redis = MagicMock()

    manager = IdempotencyManager()
    manager.redis = mock_redis

    mock_redis.set.side_effect = RedisError("Redis down")

    result = manager.process(
        request=DummyRequest(headers={"Idempotency-Key": "abc"}),
        payload={"a": 1},
        operation=lambda: "fallback_result",
    )

    assert result == "fallback_result"