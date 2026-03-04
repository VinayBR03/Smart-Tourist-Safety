# app/tasks/incident_tasks.py

from datetime import datetime, timedelta, timezone
from typing import List

from celery import shared_task
from sqlalchemy import select

from app.tasks.base import BaseTask
from app.models.incident import Incident
from app.core.enums import IncidentStatus
from app.core.config import settings
from app.services.incident_service import (
    escalate_incident_if_breached,
    auto_close_incident,
)
from app.core.logging_config import get_correlation_id
from app.utils.logger import get_logger


logger = get_logger(__name__)

BATCH_SIZE = 50


@shared_task(
    bind=True,
    base=BaseTask,
    name="app.tasks.incident_tasks.sla_monitor_task",
)
def sla_monitor_task(self):
    """
    Enterprise Incident SLA Monitor.

    Guarantees:
    - Cluster-safe execution
    - Service-layer state transitions only
    - Idempotent
    - Transaction-safe
    - Retry-safe
    """

    with self.redis_lock("incident_sla_monitor", timeout=180) as acquired:
        if not acquired:
            return

        self.execute(_process_batch)


# ---------------------------------------------------------
# Execution Logic
# ---------------------------------------------------------

def _process_batch(db):

    now = datetime.now(timezone.utc)

    breach_cutoff = now - timedelta(
        minutes=settings.INCIDENT_SLA_MINUTES
    )

    stmt = (
        select(Incident)
        .where(Incident.status == IncidentStatus.OPEN.value)
        .where(Incident.created_at < breach_cutoff)
        .limit(BATCH_SIZE)
        .with_for_update(skip_locked=True)
    )

    incidents: List[Incident] = db.execute(stmt).scalars().all()

    for incident in incidents:
        escalate_incident_if_breached(
            db=db,
            incident=incident,
        )

    _auto_close_resolved(db, now)


def _auto_close_resolved(db, now):

    close_cutoff = now - timedelta(
        days=settings.INCIDENT_AUTO_CLOSE_DAYS
    )

    stmt = (
        select(Incident)
        .where(Incident.status == IncidentStatus.RESOLVED.value)
        .where(Incident.resolved_at < close_cutoff)
        .limit(BATCH_SIZE)
        .with_for_update(skip_locked=True)
    )

    incidents: List[Incident] = db.execute(stmt).scalars().all()

    for incident in incidents:
        auto_close_incident(
            db=db,
            incident=incident,
        )

    logger.info(
        "Incident SLA monitor completed",
        extra={
            "extra_data": {
                "processed": len(incidents),
                "correlation_id": get_correlation_id(),
            }
        },
    )