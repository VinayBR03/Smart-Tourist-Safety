import pytest

from celery.schedules import crontab

from app.core.celery_app import celery_app


# =========================================================
# BASIC APP INITIALIZATION
# =========================================================

def test_celery_app_name():
    assert celery_app.main == "smart_tourist_safety"


def test_celery_broker_and_backend():
    # Just ensure values are wired (not None)
    assert celery_app.conf.broker_url is not None
    # Backend may be None depending on config, so no strict assert


# =========================================================
# CORE CONFIGURATION
# =========================================================

def test_core_configuration_flags():
    conf = celery_app.conf

    assert conf.task_serializer == "json"
    assert conf.result_serializer == "json"
    assert conf.accept_content == ["json"]

    assert conf.timezone == "UTC"
    assert conf.enable_utc is True

    assert conf.task_ignore_result is True
    assert conf.task_track_started is True
    assert conf.task_acks_late is True
    assert conf.task_reject_on_worker_lost is True

    assert conf.task_time_limit == 600
    assert conf.task_soft_time_limit == 540

    assert conf.worker_prefetch_multiplier == 1
    assert conf.worker_max_tasks_per_child == 100


# =========================================================
# TASK ROUTING
# =========================================================

def test_task_routes_configured():
    routes = celery_app.conf.task_routes

    assert "app.tasks.device_tasks.*" in routes
    assert routes["app.tasks.device_tasks.*"]["queue"] == "device"

    assert "app.tasks.notification_tasks.*" in routes
    assert routes["app.tasks.notification_tasks.*"]["queue"] == "notification"

    assert "app.tasks.outbox_tasks.*" in routes
    assert routes["app.tasks.outbox_tasks.*"]["queue"] == "outbox"

    # ML queue isolation
    assert routes[
        "app.tasks.ml_retraining_tasks.zone_retraining_task"
    ]["queue"] == "ml"


# =========================================================
# BEAT SCHEDULE
# =========================================================

def test_beat_schedule_exists():
    schedule = celery_app.conf.beat_schedule

    assert "delete-expired-accounts" in schedule
    assert "zone-retraining-check" in schedule
    assert "health-retraining-check" in schedule
    assert "crowd-retraining-check" in schedule


def test_beat_schedule_crontab_types():
    schedule = celery_app.conf.beat_schedule

    assert isinstance(
        schedule["delete-expired-accounts"]["schedule"],
        crontab,
    )

    assert isinstance(
        schedule["zone-retraining-check"]["schedule"],
        crontab,
    )


# =========================================================
# STARTUP HOOK REGISTERED
# =========================================================

def test_startup_signal_registered():
    # Celery stores signal handlers internally.
    # We just ensure signal has at least one receiver.
    receivers = celery_app.on_after_configure.receivers
    assert len(receivers) > 0