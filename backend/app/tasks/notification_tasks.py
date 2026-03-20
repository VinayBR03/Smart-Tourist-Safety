from datetime import datetime, timezone

from celery import shared_task
from sqlalchemy import select, or_

from app.tasks.base import BaseTask
from app.models.notification import Notification
from app.core.enums import NotificationStatus
from app.core.database import SessionLocal
from app.services.notification_service import dispatch_notification_by_id
from app.utils.logger import get_logger

logger = get_logger(__name__)

BATCH_SIZE = 50
MAX_RETRIES = 5


@shared_task(
    bind=True,
    base=BaseTask,
    name="app.tasks.notification_tasks.process_notifications_task",
)
def process_notifications_task(self):
    """
    Enterprise Notification Processing Task.

    Guarantees:
    - Cluster-safe execution via Redis lock
    - Respects exponential backoff (next_retry_at filter)
    - skip_locked prevents double-processing across workers
    - Delegates all dispatch/retry logic to notification_service
    """

    with self.redis_lock("process_notifications", timeout=120) as acquired:
        if not acquired:
            return

        notification_ids = self.execute(_fetch_batch)

        if not notification_ids:
            return

        for notification_id in notification_ids:
            _dispatch_one(notification_id)


# ---------------------------------------------------------
# Phase 1: Fetch Eligible Notifications
# ---------------------------------------------------------

def _fetch_batch(db) -> list[int]:
    """
    Fetch notifications eligible for dispatch right now.

    Filters:
    - PENDING status only
    - Under retry limit
    - next_retry_at is NULL (first attempt) OR has elapsed
      (respects the exponential backoff window set by
       dispatch_notification_by_id on failure)
    """

    now = datetime.now(timezone.utc)

    stmt = (
        select(Notification)
        .where(
            Notification.status == NotificationStatus.PENDING,
            Notification.retry_count < MAX_RETRIES,
            or_(
                Notification.next_retry_at.is_(None),
                Notification.next_retry_at <= now,
            ),
        )
        .order_by(Notification.created_at)
        .limit(BATCH_SIZE)
        .with_for_update(skip_locked=True)
    )

    records = db.execute(stmt).scalars().all()
    return [r.id for r in records]


# ---------------------------------------------------------
# Phase 2: Dispatch via service layer
# ---------------------------------------------------------

def _dispatch_one(notification_id: int) -> None:
    """
    Delegates all channel routing and retry logic to
    notification_service.dispatch_notification_by_id —
    no channel or retry logic duplicated here.
    """

    db = SessionLocal()

    try:
        dispatch_notification_by_id(db=db, notification_id=notification_id)
        db.commit()

    except Exception:
        db.rollback()
        logger.exception(
            "Notification dispatch failed id=%s",
            notification_id,
        )

    finally:
        db.close()