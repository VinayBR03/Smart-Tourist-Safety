# app/core/celery_app.py

from celery import Celery
from celery.schedules import crontab

from app.core.config import settings
from app.utils.logger import get_logger


logger = get_logger(__name__)


# =========================================================
# Conditional Celery Initialization
# =========================================================

if not settings.ENABLE_CELERY:
    celery_app = None
    logger.info("Celery is disabled (ENABLE_CELERY=False)")
else:

    if not settings.CELERY_BROKER_URL:
        raise RuntimeError("CELERY_BROKER_URL is required when ENABLE_CELERY=True")

    celery_app = Celery(
        "smart_tourist_safety",
        broker=settings.CELERY_BROKER_URL,
        backend=settings.CELERY_RESULT_BACKEND,
    )

    # =========================================================
    # Core Configuration
    # =========================================================

    celery_app.conf.update(
        # Serialization
        task_serializer="json",
        accept_content=["json"],
        result_serializer="json",

        # Timezone
        timezone="UTC",
        enable_utc=True,

        # Task Behavior
        task_ignore_result=True,
        task_track_started=True,
        task_acks_late=True,
        task_reject_on_worker_lost=True,

        # Safety Limits (From Config)
        task_time_limit=settings.CELERY_TASK_TIME_LIMIT,
        task_soft_time_limit=settings.CELERY_TASK_SOFT_TIME_LIMIT,

        # Worker Tuning (From Config)
        worker_prefetch_multiplier=settings.CELERY_WORKER_PREFETCH_MULTIPLIER,
        worker_max_tasks_per_child=settings.CELERY_MAX_TASKS_PER_CHILD,

        broker_heartbeat=10,
        broker_connection_retry_on_startup=True,

        # Default Queue
        task_default_queue="default",

        # =====================================================
        # Task Routing
        # =====================================================
        task_routes={
            "app.tasks.account_tasks.*": {"queue": "maintenance"},
            "app.tasks.device_tasks.*": {"queue": "device"},
            "app.tasks.notification_tasks.*": {"queue": "notification"},
            "app.tasks.zone_tasks.*": {"queue": "risk"},
            "app.tasks.outbox_tasks.*": {"queue": "outbox"},

            # ML Queue
            "app.tasks.ml_retraining_tasks.*": {"queue": "ml"},
        },
    )

    # =========================================================
    # Beat Schedule (Only If Needed)
    # =========================================================

    beat_schedule = {
        "delete-expired-accounts": {
            "task": "app.tasks.account_tasks.delete_expired_accounts_task",
            "schedule": crontab(minute=0, hour="*"),
        }
    }

    if settings.ML_ENGINE_ENABLED:
        beat_schedule.update(
            {
                "zone-retraining-check": {
                    "task": "app.tasks.ml_retraining_tasks.zone_retraining_task",
                    "schedule": crontab(minute="*/30"),
                },
                "health-retraining-check": {
                    "task": "app.tasks.ml_retraining_tasks.health_retraining_task",
                    "schedule": crontab(minute=0, hour="*"),
                },
                "crowd-retraining-check": {
                    "task": "app.tasks.ml_retraining_tasks.crowd_retraining_task",
                    "schedule": crontab(minute="*/20"),
                },
            }
        )

    celery_app.conf.beat_schedule = beat_schedule

    # =========================================================
    # Startup Hook
    # =========================================================

    @celery_app.on_after_configure.connect
    def celery_startup(sender, **kwargs):
        logger.info("Celery configured successfully")