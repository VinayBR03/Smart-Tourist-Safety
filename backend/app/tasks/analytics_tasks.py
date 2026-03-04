# app/tasks/analytics_tasks.py

from typing import List

from celery import shared_task
from sqlalchemy import select

from app.tasks.base import BaseTask
from app.models.zone import Zone
from app.services.risk_engine_service import update_zone_status
from app.core.logging_config import get_correlation_id
from app.utils.logger import get_logger


logger = get_logger(__name__)

BATCH_SIZE = 25


@shared_task(
    bind=True,
    base=BaseTask,
    name="app.tasks.analytics_tasks.recalculate_zone_risk_task",
)
def recalculate_zone_risk_task(self):
    """
    Enterprise Zone Risk Recalculation Task.

    Guarantees:
    - Cluster-safe execution
    - Delegates to risk_engine_service
    - No scoring logic in task layer
    - Idempotent
    - Transaction-safe
    """

    with self.redis_lock("recalculate_zone_risk", timeout=300) as acquired:
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
        update_zone_status(
            db=db,
            zone_id=zone.id,
        )

    logger.info(
        "Zone risk recalculation completed",
        extra={
            "extra_data": {
                "processed": len(zones),
                "correlation_id": get_correlation_id(),
            }
        },
    )