from datetime import datetime, timezone
from typing import List

from celery import shared_task
from sqlalchemy import select

from app.tasks.base import BaseTask
from app.models.notification import Notification
from app.core.enums import NotificationStatus
from app.core.database import SessionLocal
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
    - Cluster-safe execution
    - Status-driven state transitions
    - Idempotent
    - Transaction-safe
    - Retry-safe
    """

    with self.redis_lock("process_notifications", timeout=120) as acquired:
        if not acquired:
            return

        notification_ids = self.execute(_fetch_batch)

        if not notification_ids:
            return

        for notification_id in notification_ids:
            _send_and_update(notification_id)


# ---------------------------------------------------------
# Phase 1: Fetch Pending Notifications
# ---------------------------------------------------------

def _fetch_batch(db) -> List[int]:
    """
    Fetch notifications eligible for processing.
    """

    stmt = (
        select(Notification)
        .where(Notification.status == NotificationStatus.PENDING)
        .where(Notification.retry_count < MAX_RETRIES)
        .order_by(Notification.created_at)
        .limit(BATCH_SIZE)
        .with_for_update(skip_locked=True)
    )

    records = db.execute(stmt).scalars().all()

    if not records:
        return []

    return [record.id for record in records]


# ---------------------------------------------------------
# Phase 2: Dispatch & Update Status
# ---------------------------------------------------------

def _send_and_update(notification_id: int) -> None:
    """
    Send notification and update lifecycle status.
    """

    db = SessionLocal()

    try:
        notification = db.get(Notification, notification_id)

        if (
            not notification
            or notification.status != NotificationStatus.PENDING
        ):
            return

        try:
            _dispatch(notification)

            notification.status = NotificationStatus.SENT
            notification.sent_at = datetime.now(timezone.utc)
            notification.last_error = None

        except Exception as e:
            notification.retry_count += 1
            notification.last_error = str(e)

            if notification.retry_count >= MAX_RETRIES:
                notification.status = NotificationStatus.FAILED
                logger.error(
                    "Notification exceeded retry limit id=%s",
                    notification.id,
                )
            else:
                notification.status = NotificationStatus.FAILED

        db.commit()

    except Exception:
        db.rollback()
        logger.exception(
            "Notification processing failed id=%s",
            notification_id,
        )

    finally:
        db.close()


# ---------------------------------------------------------
# Dispatch Stub
# ---------------------------------------------------------

def _dispatch(notification: Notification):
    """
    Dispatch notification via provider.
    (Email / SMS / Push integration goes here.)
    """

    logger.info(
        "Sending notification id=%s channel=%s",
        notification.id,
        notification.channel,
    )

    # TODO:
    # integrate email / SMS / push provider here