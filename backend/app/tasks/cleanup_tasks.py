# app/tasks/cleanup_tasks.py

from celery import shared_task
from datetime import datetime, timezone

from app.tasks.base import BaseTask
from app.services.cleanup_service import permanently_delete_expired_accounts
from app.core.logging_config import get_correlation_id
from app.utils.logger import get_logger


logger = get_logger(__name__)

LOCK_TIMEOUT_SECONDS = 300  # long-running batch safety


@shared_task(
    bind=True,
    base=BaseTask,
    name="app.tasks.cleanup_tasks.run_account_cleanup_task",
)
def run_account_cleanup_task(self):
    """
    Enterprise Account Cleanup Task.

    Guarantees:
    - Cluster-safe execution (Redis distributed lock)
    - Transaction-safe via BaseTask.execute()
    - Delegates all logic to service layer
    - Idempotent
    - Retry-safe
    - Observability-friendly
    """

    started_at = datetime.now(timezone.utc)

    with self.redis_lock("account_cleanup", timeout=LOCK_TIMEOUT_SECONDS) as acquired:
        if not acquired:
            logger.info(
                "Cleanup already running on another worker",
                extra={
                    "extra_data": {
                        "correlation_id": get_correlation_id(),
                    }
                },
            )
            return

        deleted_count = self.execute(_run_cleanup_batch)

        logger.info(
            "Account cleanup completed",
            extra={
                "extra_data": {
                    "deleted_count": deleted_count,
                    "started_at": started_at.isoformat(),
                    "finished_at": datetime.now(timezone.utc).isoformat(),
                    "correlation_id": get_correlation_id(),
                }
            },
        )


# ---------------------------------------------------------
# Execution Wrapper
# ---------------------------------------------------------

def _run_cleanup_batch(db):
    """
    Wrapped inside BaseTask.execute() which ensures:
    - Fresh DB session
    - Transaction boundary
    - Automatic rollback on failure
    """

    return permanently_delete_expired_accounts(db)