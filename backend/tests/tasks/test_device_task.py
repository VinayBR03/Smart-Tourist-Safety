import pytest
from unittest.mock import MagicMock
from datetime import datetime, timedelta, timezone

from app.tasks.device_tasks import (
    detect_offline_devices_task,
    _process_batch,
)
from app.models.iot_device import IoTDevice
from app.core.enums import DeviceStatus


# =========================================================
# TASK LEVEL TESTS
# =========================================================

def test_detect_offline_devices_lock_not_acquired(mocker):
    lock_mock = MagicMock()
    lock_mock.__enter__.return_value = False

    mocker.patch.object(
        detect_offline_devices_task,
        "redis_lock",
        return_value=lock_mock,
    )

    execute_mock = mocker.patch.object(
        detect_offline_devices_task,
        "execute",
    )

    detect_offline_devices_task()

    execute_mock.assert_not_called()


def test_detect_offline_devices_lock_acquired_executes(mocker):
    lock_mock = MagicMock()
    lock_mock.__enter__.return_value = True

    mocker.patch.object(
        detect_offline_devices_task,
        "redis_lock",
        return_value=lock_mock,
    )

    execute_mock = mocker.patch.object(
        detect_offline_devices_task,
        "execute",
    )

    detect_offline_devices_task()

    execute_mock.assert_called_once()


# =========================================================
# PROCESS BATCH TESTS
# =========================================================

def test_process_batch_no_devices(mocker):
    mock_db = MagicMock()
    mock_db.execute.return_value.scalars.return_value.all.return_value = []

    mark_mock = mocker.patch(
        "app.tasks.device_tasks.mark_device_offline"
    )

    result = _process_batch(mock_db)

    mark_mock.assert_not_called()
    assert result is None


def test_process_batch_marks_devices_offline(mocker):
    mock_db = MagicMock()

    device1 = MagicMock(spec=IoTDevice)
    device2 = MagicMock(spec=IoTDevice)

    mock_db.execute.return_value.scalars.return_value.all.return_value = [
        device1,
        device2,
    ]

    mark_mock = mocker.patch(
        "app.tasks.device_tasks.mark_device_offline"
    )

    logger_warning = mocker.patch(
        "app.tasks.device_tasks.logger.warning"
    )

    _process_batch(mock_db)

    assert mark_mock.call_count == 2
    logger_warning.assert_called_once()