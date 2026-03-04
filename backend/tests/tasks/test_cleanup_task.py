import pytest
from unittest.mock import MagicMock

from app.tasks.cleanup_tasks import (
    run_account_cleanup_task,
    _run_cleanup_batch,
)


# =========================================================
# Test: Lock Not Acquired
# =========================================================

def test_cleanup_task_lock_not_acquired(mocker):
    # Patch redis_lock on the task itself
    mocker.patch.object(
        run_account_cleanup_task,
        "redis_lock",
        return_value=MagicMock(__enter__=lambda s: False, __exit__=lambda s, *a: None),
    )

    execute_mock = mocker.patch.object(
        run_account_cleanup_task,
        "execute",
    )

    logger_info = mocker.patch("app.tasks.cleanup_tasks.logger.info")

    run_account_cleanup_task.run()

    execute_mock.assert_not_called()
    logger_info.assert_called()


# =========================================================
# Test: Lock Acquired → Execute Called
# =========================================================

def test_cleanup_task_executes_when_lock_acquired(mocker):
    mocker.patch.object(
        run_account_cleanup_task,
        "redis_lock",
        return_value=MagicMock(__enter__=lambda s: True, __exit__=lambda s, *a: None),
    )

    execute_mock = mocker.patch.object(
        run_account_cleanup_task,
        "execute",
        return_value=5,
    )

    logger_info = mocker.patch("app.tasks.cleanup_tasks.logger.info")

    run_account_cleanup_task.run()

    execute_mock.assert_called_once()
    logger_info.assert_called()


# =========================================================
# Test: _run_cleanup_batch Delegates to Service
# =========================================================

def test_run_cleanup_batch_calls_service(mocker):
    mock_db = MagicMock()

    service_mock = mocker.patch(
        "app.tasks.cleanup_tasks.permanently_delete_expired_accounts",
        return_value=10,
    )

    result = _run_cleanup_batch(mock_db)

    service_mock.assert_called_once_with(mock_db)
    assert result == 10