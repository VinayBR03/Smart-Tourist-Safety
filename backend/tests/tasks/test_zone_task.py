import pytest
from unittest.mock import MagicMock

from app.tasks.zone_tasks import (
    zone_integrity_check_task,
    _process_batch,
)
from app.models.zone import Zone


# =========================================================
# TASK LEVEL TESTS
# =========================================================

def test_zone_integrity_lock_not_acquired(mocker):
    lock_mock = MagicMock()
    lock_mock.__enter__.return_value = False

    mocker.patch.object(
        zone_integrity_check_task,
        "redis_lock",
        return_value=lock_mock,
    )

    execute_mock = mocker.patch.object(
        zone_integrity_check_task,
        "execute",
    )

    zone_integrity_check_task()

    execute_mock.assert_not_called()


def test_zone_integrity_lock_acquired_executes(mocker):
    lock_mock = MagicMock()
    lock_mock.__enter__.return_value = True

    mocker.patch.object(
        zone_integrity_check_task,
        "redis_lock",
        return_value=lock_mock,
    )

    execute_mock = mocker.patch.object(
        zone_integrity_check_task,
        "execute",
    )

    zone_integrity_check_task()

    execute_mock.assert_called_once()


# =========================================================
# PROCESS BATCH TESTS
# =========================================================

def test_process_batch_no_zones(mocker):
    mock_db = MagicMock()
    mock_db.execute.return_value.scalars.return_value.all.return_value = []

    validate_mock = mocker.patch(
        "app.tasks.zone_tasks.validate_zone_integrity"
    )

    result = _process_batch(mock_db)

    validate_mock.assert_not_called()
    assert result is None


def test_process_batch_validates_zones(mocker):
    mock_db = MagicMock()

    zone1 = MagicMock(spec=Zone)
    zone2 = MagicMock(spec=Zone)

    mock_db.execute.return_value.scalars.return_value.all.return_value = [
        zone1,
        zone2,
    ]

    validate_mock = mocker.patch(
        "app.tasks.zone_tasks.validate_zone_integrity"
    )

    logger_info = mocker.patch(
        "app.tasks.zone_tasks.logger.info"
    )

    _process_batch(mock_db)

    assert validate_mock.call_count == 2
    logger_info.assert_called_once()