# app/tasks/device_tasks.py

from datetime import datetime, timedelta, timezone
from typing import List

from celery import shared_task
from sqlalchemy import select

from app.tasks.base import BaseTask
from app.models.iot_device import IoTDevice
from app.core.enums import DeviceStatus
from app.core.config import settings
from app.services.device_service import mark_device_offline
from app.core.logging_config import get_correlation_id
from app.utils.logger import get_logger


logger = get_logger(__name__)

BATCH_SIZE = 100


@shared_task(
    bind=True,
    base=BaseTask,
    name="app.tasks.device_tasks.detect_offline_devices_task",
)
def detect_offline_devices_task(self):
    """
    Enterprise Offline Device Detection.

    Guarantees:
    - Cluster-safe execution
    - Service-layer driven state transition
    - Idempotent
    - Transaction-safe
    - Retry-safe
    """

    with self.redis_lock("detect_offline_devices", timeout=180) as acquired:
        if not acquired:
            return

        self.execute(_process_batch)


# ---------------------------------------------------------
# Execution Logic
# ---------------------------------------------------------

def _process_batch(db):

    cutoff = datetime.now(timezone.utc) - timedelta(
        minutes=settings.DEVICE_OFFLINE_THRESHOLD_MINUTES
    )

    stmt = (
        select(IoTDevice)
        .where(IoTDevice.status == DeviceStatus.ACTIVE.value)
        .where(IoTDevice.last_seen < cutoff)
        .limit(BATCH_SIZE)
        .with_for_update(skip_locked=True)
    )

    devices: List[IoTDevice] = db.execute(stmt).scalars().all()

    if not devices:
        return

    for device in devices:
        mark_device_offline(db=db, device=device)

    logger.warning(
        "Offline devices detected",
        extra={
            "extra_data": {
                "count": len(devices),
                "correlation_id": get_correlation_id(),
            }
        },
    )