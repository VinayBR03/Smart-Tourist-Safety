# app/tasks/account_tasks.py

from celery import shared_task
from datetime import datetime, timezone

from app.tasks.base import BaseTask
from app.core.logging_config import get_correlation_id
from app.utils.logger import get_logger


logger = get_logger(__name__)


@shared_task(
    bind=True,
    base=BaseTask,
    name="app.tasks.account_tasks.account_post_processing_task",
)
def account_post_processing_task(self, user_id: int):
    """
    Generic Account Post-Processing Task.

    Use for:
    - Welcome email trigger
    - Analytics enrichment
    - Async provisioning
    - Profile indexing

    Guarantees:
    - No direct model mutation
    - Service-layer orchestration only
    - Transaction-safe
    - Retry-safe
    """

    try:
        logger.info(
            "Account post-processing started",
            extra={
                "extra_data": {
                    "user_id": user_id,
                    "correlation_id": get_correlation_id(),
                }
            },
        )

        # Example:
        # self.execute(lambda db: account_service.handle_post_registration(db, user_id))

        logger.info(
            "Account post-processing completed",
            extra={
                "extra_data": {
                    "user_id": user_id,
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                    "correlation_id": get_correlation_id(),
                }
            },
        )

    except Exception:
        logger.exception(
            "Account post-processing failed",
            extra={
                "extra_data": {
                    "user_id": user_id,
                    "correlation_id": get_correlation_id(),
                }
            },
        )
        raise