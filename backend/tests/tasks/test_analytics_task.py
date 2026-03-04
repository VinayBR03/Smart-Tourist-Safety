import pytest
from unittest.mock import MagicMock

from app.tasks.analytics_tasks import (
    recalculate_zone_risk_task,
    _process_batch,
)
from app.models.zone import Zone


# =========================================================
# TASK LEVEL TESTS
# =========================================================

def test_recalculate_zone_risk_lock_not_acquired(mocker):
    lock_mock = MagicMock()
    lock_mock.__enter__.return_value = False

    mocker.patch.object(
        recalculate_zone_risk_task,
        "redis_lock",
        return_value=lock_mock,
    )

    execute_mock = mocker.patch.object(
        recalculate_zone_risk_task,
        "execute",
    )

    recalculate_zone_risk_task()

    execute_mock.assert_not_called()


def test_recalculate_zone_risk_lock_acquired_executes(mocker):
    lock_mock = MagicMock()
    lock_mock.__enter__.return_value = True

    mocker.patch.object(
        recalculate_zone_risk_task,
        "redis_lock",
        return_value=lock_mock,
    )

    execute_mock = mocker.patch.object(
        recalculate_zone_risk_task,
        "execute",
    )

    recalculate_zone_risk_task()

    execute_mock.assert_called_once()


# =========================================================
# PROCESS BATCH TESTS
# =========================================================

def test_process_batch_no_zones(mocker):
    mock_db = MagicMock()
    mock_db.execute.return_value.scalars.return_value.all.return_value = []

    update_mock = mocker.patch(
        "app.tasks.analytics_tasks.update_zone_status"
    )

    result = _process_batch(mock_db)

    update_mock.assert_not_called()
    assert result is None


def test_process_batch_updates_zone_status(mocker):
    mock_db = MagicMock()

    zone1 = MagicMock(spec=Zone)
    zone1.id = 1

    zone2 = MagicMock(spec=Zone)
    zone2.id = 2

    mock_db.execute.return_value.scalars.return_value.all.return_value = [
        zone1,
        zone2,
    ]

    update_mock = mocker.patch(
        "app.tasks.analytics_tasks.update_zone_status"
    )

    logger_info = mocker.patch(
        "app.tasks.analytics_tasks.logger.info"
    )

    _process_batch(mock_db)

    assert update_mock.call_count == 2
    update_mock.assert_any_call(db=mock_db, zone_id=1)
    update_mock.assert_any_call(db=mock_db, zone_id=2)

    logger_info.assert_called_once()