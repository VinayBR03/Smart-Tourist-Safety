# app/tasks/zone_tasks.py

from typing import List

from celery import shared_task
from sqlalchemy import select

from app.tasks.base import BaseTask
from app.models.zone import Zone
from app.services.zone_service import validate_zone_integrity
from app.core.logging_config import get_correlation_id
from app.utils.logger import get_logger


logger = get_logger(__name__)

BATCH_SIZE = 50


@shared_task(
    bind=True,
    base=BaseTask,
    name="app.tasks.zone_tasks.zone_integrity_check_task",
)
def zone_integrity_check_task(self):
    """
    Enterprise Zone Integrity Monitor.

    Guarantees:
    - Cluster-safe execution
    - Service-layer validation only
    - No domain logic in task
    - Idempotent
    - Transaction-safe
    """

    with self.redis_lock("zone_integrity_check", timeout=300) as acquired:
        if not acquired:
            return

        self.execute(_process_batch)


# ---------------------------------------------------------
# Execution Logic
# ---------------------------------------------------------

def _process_batch(db):

    stmt = (
        select(Zone)
        .where(Zone.is_active.is_(True))
        .limit(BATCH_SIZE)
        .with_for_update(skip_locked=True)
    )

    zones: List[Zone] = db.execute(stmt).scalars().all()

    if not zones:
        return

    for zone in zones:
        validate_zone_integrity(
            db=db,
            zone=zone,
        )

    logger.info(
        "Zone integrity check completed",
        extra={
            "extra_data": {
                "processed": len(zones),
                "correlation_id": get_correlation_id(),
            }
        },
    )