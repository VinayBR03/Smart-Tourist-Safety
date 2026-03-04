import pytest
from unittest.mock import MagicMock, PropertyMock
from celery import Task

from app.tasks.base import BaseTask


# =========================================================
# Dummy Task for Testing
# =========================================================

class DummyTask(BaseTask):
    name = "dummy.task"

    def run(self, *args, **kwargs):
        return "ok"


# =========================================================
# Correlation ID
# =========================================================

def test_bind_correlation_from_headers(mocker):
    task = DummyTask()

    mock_request = MagicMock()
    mock_request.headers = {"X-Correlation-ID": "abc-123"}
    mock_request.id = "fallback-id"

    mocker.patch.object(
        DummyTask,
        "request",
        new_callable=PropertyMock,
        return_value=mock_request,
    )

    set_corr = mocker.patch("app.tasks.base.set_correlation_id")

    task.bind_correlation()

    set_corr.assert_called_once_with("abc-123")


def test_bind_correlation_fallback_to_task_id(mocker):
    task = DummyTask()

    mock_request = MagicMock()
    mock_request.headers = {}
    mock_request.id = "task-id-456"

    mocker.patch.object(
        DummyTask,
        "request",
        new_callable=PropertyMock,
        return_value=mock_request,
    )

    set_corr = mocker.patch("app.tasks.base.set_correlation_id")

    task.bind_correlation()

    set_corr.assert_called_once_with("task-id-456")


# =========================================================
# Execute Wrapper (UPDATED FOR get_db)
# =========================================================

def test_execute_success(mocker):
    task = DummyTask()

    mock_session = MagicMock()

    # Mock get_db() to return generator yielding mock_session
    def fake_get_db():
        yield mock_session

    mocker.patch("app.tasks.base.get_db", fake_get_db)

    def sample_fn(db):
        assert db == mock_session
        return "done"

    result = task.execute(sample_fn)

    assert result == "done"
    mock_session.commit.assert_called_once()
    mock_session.close.assert_called_once()


def test_execute_rollback_on_error(mocker):
    task = DummyTask()

    mock_session = MagicMock()

    def fake_get_db():
        yield mock_session

    mocker.patch("app.tasks.base.get_db", fake_get_db)

    def failing_fn(db):
        raise ValueError("fail")

    with pytest.raises(ValueError):
        task.execute(failing_fn)

    mock_session.rollback.assert_called_once()
    mock_session.close.assert_called_once()


# =========================================================
# Redis Lock
# =========================================================

def test_redis_lock_acquired(mocker):
    task = DummyTask()

    mock_redis = MagicMock()
    mock_lock = MagicMock()
    mock_lock.acquire.return_value = True

    mock_redis.lock.return_value = mock_lock
    mocker.patch("app.tasks.base.get_redis", return_value=mock_redis)

    with task.redis_lock("test-key") as acquired:
        assert acquired is True

    mock_lock.release.assert_called_once()


def test_redis_lock_not_acquired(mocker):
    task = DummyTask()

    mock_redis = MagicMock()
    mock_lock = MagicMock()
    mock_lock.acquire.return_value = False

    mock_redis.lock.return_value = mock_lock
    mocker.patch("app.tasks.base.get_redis", return_value=mock_redis)

    with task.redis_lock("test-key") as acquired:
        assert acquired is False

    mock_lock.release.assert_not_called()


def test_redis_unavailable_fallback(mocker):
    task = DummyTask()

    mocker.patch(
        "app.tasks.base.get_redis",
        side_effect=Exception("Redis down")
    )

    with task.redis_lock("test-key") as acquired:
        assert acquired is True