import pytest
from unittest.mock import MagicMock
from app.tasks.notification_tasks import (
    process_notifications_task,
    _fetch_batch,
    _send_and_update,
)
from app.models.notification import Notification
from app.core.enums import NotificationStatus


# =========================================================
# TASK LEVEL TESTS
# =========================================================

def test_process_notifications_lock_not_acquired(mocker):
    lock_mock = MagicMock()
    lock_mock.__enter__.return_value = False

    mocker.patch.object(
        process_notifications_task,
        "redis_lock",
        return_value=lock_mock,
    )

    execute_mock = mocker.patch.object(
        process_notifications_task,
        "execute",
    )

    process_notifications_task()

    execute_mock.assert_not_called()


def test_process_notifications_lock_acquired_executes(mocker):
    lock_mock = MagicMock()
    lock_mock.__enter__.return_value = True

    mocker.patch.object(
        process_notifications_task,
        "redis_lock",
        return_value=lock_mock,
    )

    execute_mock = mocker.patch.object(
        process_notifications_task,
        "execute",
        return_value=[],
    )

    process_notifications_task()

    execute_mock.assert_called_once()


# =========================================================
# FETCH BATCH TESTS
# =========================================================

def test_fetch_batch_returns_ids(mocker):
    mock_db = MagicMock()

    record1 = MagicMock(spec=Notification)
    record1.id = 1
    record1.status = NotificationStatus.PENDING
    record1.retry_count = 0

    record2 = MagicMock(spec=Notification)
    record2.id = 2
    record2.status = NotificationStatus.PENDING
    record2.retry_count = 0

    mock_db.execute.return_value.scalars.return_value.all.return_value = [
        record1,
        record2,
    ]

    ids = _fetch_batch(mock_db)

    assert ids == [1, 2]


def test_fetch_batch_empty(mocker):
    mock_db = MagicMock()
    mock_db.execute.return_value.scalars.return_value.all.return_value = []

    ids = _fetch_batch(mock_db)

    assert ids == []


# =========================================================
# SEND SUCCESS TEST
# =========================================================

def test_send_and_update_success(mocker):
    mock_db = MagicMock()

    notification = MagicMock(spec=Notification)
    notification.id = 10
    notification.channel = "email"
    notification.status = NotificationStatus.PENDING
    notification.retry_count = 0

    mock_db.get.return_value = notification

    mocker.patch(
        "app.tasks.notification_tasks.SessionLocal",
        return_value=mock_db,
    )

    dispatch_mock = mocker.patch(
        "app.tasks.notification_tasks._dispatch"
    )

    _send_and_update(10)

    dispatch_mock.assert_called_once()
    assert notification.status == NotificationStatus.SENT
    mock_db.commit.assert_called_once()


# =========================================================
# SEND FAILURE TEST
# =========================================================

def test_send_and_update_failure_increments_retry(mocker):
    mock_db = MagicMock()

    notification = MagicMock(spec=Notification)
    notification.id = 11
    notification.channel = "sms"
    notification.status = NotificationStatus.PENDING
    notification.retry_count = 0

    mock_db.get.return_value = notification

    mocker.patch(
        "app.tasks.notification_tasks.SessionLocal",
        return_value=mock_db,
    )

    mocker.patch(
        "app.tasks.notification_tasks._dispatch",
        side_effect=Exception("Provider failure"),
    )

    _send_and_update(11)

    assert notification.retry_count == 1
    assert notification.status == NotificationStatus.FAILED
    mock_db.commit.assert_called_once()


# =========================================================
# FAILED TEST
# =========================================================

def test_send_and_update_moves_to_failed(mocker):
    mock_db = MagicMock()

    notification = MagicMock(spec=Notification)
    notification.id = 12
    notification.channel = "push"
    notification.status = NotificationStatus.PENDING
    notification.retry_count = 4  # MAX_RETRIES = 5

    mock_db.get.return_value = notification

    mocker.patch(
        "app.tasks.notification_tasks.SessionLocal",
        return_value=mock_db,
    )

    mocker.patch(
        "app.tasks.notification_tasks._dispatch",
        side_effect=Exception("Failure"),
    )

    logger_error = mocker.patch(
        "app.tasks.notification_tasks.logger.error"
    )

    _send_and_update(12)

    assert notification.retry_count == 5
    assert notification.status == NotificationStatus.FAILED
    logger_error.assert_called_once()
    mock_db.commit.assert_called_once()


# =========================================================
# NOT FOUND TEST
# =========================================================

def test_send_and_update_notification_not_found(mocker):
    mock_db = MagicMock()
    mock_db.get.return_value = None

    mocker.patch(
        "app.tasks.notification_tasks.SessionLocal",
        return_value=mock_db,
    )

    _send_and_update(999)

    mock_db.commit.assert_not_called()