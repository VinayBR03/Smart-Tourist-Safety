import pytest
from unittest.mock import MagicMock

from app.tasks.base import BaseTask


# =========================================================
# REDIS UNAVAILABLE → PROCEED WITHOUT LOCK
# =========================================================

def test_redis_lock_when_redis_unavailable(mocker):
    mocker.patch(
        "app.tasks.base.get_redis",
        side_effect=Exception("Redis down"),
    )

    task = BaseTask()

    with task.redis_lock("test-key") as acquired:
        assert acquired is True


# =========================================================
# LOCK ACQUIRED SUCCESSFULLY
# =========================================================

def test_redis_lock_acquired(mocker):
    mock_lock = MagicMock()
    mock_lock.acquire.return_value = True

    mock_redis = MagicMock()
    mock_redis.lock.return_value = mock_lock

    mocker.patch(
        "app.tasks.base.get_redis",
        return_value=mock_redis,
    )

    task = BaseTask()

    with task.redis_lock("my-task", timeout=30) as acquired:
        assert acquired is True

    mock_lock.acquire.assert_called_once_with(blocking=True)
    mock_lock.release.assert_called_once()


# =========================================================
# LOCK NOT ACQUIRED
# =========================================================

def test_redis_lock_not_acquired(mocker):
    mock_lock = MagicMock()
    mock_lock.acquire.return_value = False

    mock_redis = MagicMock()
    mock_redis.lock.return_value = mock_lock

    logger_warning = mocker.patch(
        "app.tasks.base.logger.warning"
    )

    mocker.patch(
        "app.tasks.base.get_redis",
        return_value=mock_redis,
    )

    task = BaseTask()

    with task.redis_lock("my-task") as acquired:
        assert acquired is False

    logger_warning.assert_called_once()
    mock_lock.release.assert_not_called()


# =========================================================
# LOCK RELEASE FAILURE SHOULD NOT CRASH
# =========================================================

def test_redis_lock_release_failure(mocker):
    mock_lock = MagicMock()
    mock_lock.acquire.return_value = True
    mock_lock.release.side_effect = Exception("release error")

    mock_redis = MagicMock()
    mock_redis.lock.return_value = mock_lock

    logger_warning = mocker.patch(
        "app.tasks.base.logger.warning"
    )

    mocker.patch(
        "app.tasks.base.get_redis",
        return_value=mock_redis,
    )

    task = BaseTask()

    with task.redis_lock("release-fail") as acquired:
        assert acquired is True

    logger_warning.assert_called_once()
    mock_lock.release.assert_called_once()


# =========================================================
# LOCK NAME FORMAT VALIDATION
# =========================================================

def test_redis_lock_name_prefix(mocker):
    mock_lock = MagicMock()
    mock_lock.acquire.return_value = True

    mock_redis = MagicMock()
    mock_redis.lock.return_value = mock_lock

    mocker.patch(
        "app.tasks.base.get_redis",
        return_value=mock_redis,
    )

    task = BaseTask()

    with task.redis_lock("sample-key"):
        pass

    mock_redis.lock.assert_called_once()
    args, kwargs = mock_redis.lock.call_args

    assert kwargs["name"] == "task-lock:sample-key"