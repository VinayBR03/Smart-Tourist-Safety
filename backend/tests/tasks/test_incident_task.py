import pytest
from unittest.mock import MagicMock
from datetime import datetime, timezone

from app.tasks.incident_tasks import (
    sla_monitor_task,
    _process_batch,
    _auto_close_resolved,
)
from app.models.incident import Incident


# =========================================================
# TASK LEVEL TESTS
# =========================================================

def test_sla_monitor_lock_not_acquired(mocker):
    lock_mock = MagicMock()
    lock_mock.__enter__.return_value = False

    mocker.patch.object(
        sla_monitor_task,
        "redis_lock",
        return_value=lock_mock,
    )

    execute_mock = mocker.patch.object(
        sla_monitor_task,
        "execute",
    )

    sla_monitor_task()

    execute_mock.assert_not_called()


def test_sla_monitor_lock_acquired_executes(mocker):
    lock_mock = MagicMock()
    lock_mock.__enter__.return_value = True

    mocker.patch.object(
        sla_monitor_task,
        "redis_lock",
        return_value=lock_mock,
    )

    execute_mock = mocker.patch.object(
        sla_monitor_task,
        "execute",
    )

    sla_monitor_task()

    execute_mock.assert_called_once()


# =========================================================
# PROCESS BATCH TESTS
# =========================================================

def test_process_batch_escalates_incidents(mocker):
    mock_db = MagicMock()

    incident1 = MagicMock(spec=Incident)
    incident2 = MagicMock(spec=Incident)

    mock_db.execute.return_value.scalars.return_value.all.return_value = [
        incident1,
        incident2,
    ]

    escalate_mock = mocker.patch(
        "app.tasks.incident_tasks.escalate_incident_if_breached"
    )

    auto_close_mock = mocker.patch(
        "app.tasks.incident_tasks._auto_close_resolved"
    )

    _process_batch(mock_db)

    assert escalate_mock.call_count == 2
    auto_close_mock.assert_called_once()


def test_process_batch_no_incidents(mocker):
    mock_db = MagicMock()
    mock_db.execute.return_value.scalars.return_value.all.return_value = []

    escalate_mock = mocker.patch(
        "app.tasks.incident_tasks.escalate_incident_if_breached"
    )

    auto_close_mock = mocker.patch(
        "app.tasks.incident_tasks._auto_close_resolved"
    )

    _process_batch(mock_db)

    escalate_mock.assert_not_called()
    auto_close_mock.assert_called_once()


# =========================================================
# AUTO CLOSE TESTS
# =========================================================

def test_auto_close_resolved_calls_service(mocker):
    mock_db = MagicMock()
    now = datetime.now(timezone.utc)

    incident1 = MagicMock(spec=Incident)
    incident2 = MagicMock(spec=Incident)

    mock_db.execute.return_value.scalars.return_value.all.return_value = [
        incident1,
        incident2,
    ]

    close_mock = mocker.patch(
        "app.tasks.incident_tasks.auto_close_incident"
    )

    logger_info = mocker.patch(
        "app.tasks.incident_tasks.logger.info"
    )

    _auto_close_resolved(mock_db, now)

    assert close_mock.call_count == 2
    logger_info.assert_called_once()


def test_auto_close_resolved_no_incidents(mocker):
    mock_db = MagicMock()
    now = datetime.now(timezone.utc)

    mock_db.execute.return_value.scalars.return_value.all.return_value = []

    close_mock = mocker.patch(
        "app.tasks.incident_tasks.auto_close_incident"
    )

    logger_info = mocker.patch(
        "app.tasks.incident_tasks.logger.info"
    )

    _auto_close_resolved(mock_db, now)

    close_mock.assert_not_called()
    logger_info.assert_called_once()