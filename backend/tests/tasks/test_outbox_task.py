import pytest
from unittest.mock import MagicMock

from app.tasks.outbox_tasks import process_outbox_task


# =========================================================
# LOCK NOT ACQUIRED
# =========================================================

def test_process_outbox_lock_not_acquired(mocker):
    # Patch redis_lock on real task object
    lock_mock = MagicMock()
    lock_mock.__enter__.return_value = False
    mocker.patch.object(process_outbox_task, "redis_lock", return_value=lock_mock)

    execute_mock = mocker.patch.object(process_outbox_task, "execute")
    logger_debug = mocker.patch("app.tasks.outbox_tasks.logger.debug")

    # Call task normally
    process_outbox_task()

    execute_mock.assert_not_called()
    logger_debug.assert_called_once()


# =========================================================
# LOCK ACQUIRED → EXECUTE CALLED
# =========================================================

def test_process_outbox_lock_acquired_executes(mocker):
    lock_mock = MagicMock()
    lock_mock.__enter__.return_value = True
    mocker.patch.object(process_outbox_task, "redis_lock", return_value=lock_mock)

    execute_mock = mocker.patch.object(process_outbox_task, "execute")

    process_outbox_task()

    execute_mock.assert_called_once()


# =========================================================
# DELEGATION TO SERVICE
# =========================================================

def test_process_outbox_delegates_to_service(mocker):
    lock_mock = MagicMock()
    lock_mock.__enter__.return_value = True
    mocker.patch.object(process_outbox_task, "redis_lock", return_value=lock_mock)

    service_mock = mocker.patch(
        "app.tasks.outbox_tasks.process_outbox_events"
    )

    def fake_execute(fn):
        mock_db = MagicMock()
        fn(mock_db)

    mocker.patch.object(process_outbox_task, "execute", side_effect=fake_execute)

    process_outbox_task()

    service_mock.assert_called_once()