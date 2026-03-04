from datetime import datetime, timedelta, timezone
from contextlib import suppress
from typing import Callable
import time
import threading

from sqlalchemy.orm import Session

from app.models.iot_device import IoTDevice
from app.models.zone import Zone

from app.services.cleanup_service import permanently_delete_expired_accounts
from app.services.outbox_service import process_outbox_events, create_outbox_event
from app.services.risk_engine_service import update_zone_status
from app.services.notification_service import publish_after_commit
from app.services.audit_service import create_audit_log

from app.core.enums import DeviceStatus, AuditAction, EntityType
from app.core.logging_config import get_correlation_id
from app.core.config import settings
from app.utils.logger import get_logger


logger = get_logger(__name__)

OFFLINE_THRESHOLD_MINUTES = getattr(
    settings,
    "DEVICE_OFFLINE_THRESHOLD_MINUTES",
    15,
)

MAX_OFFLINE_DEVICES_PER_RUN = 1000

_scheduler_lock = threading.Lock()


# =========================================================
# Master Scheduler Entry
# =========================================================

def run_scheduled_jobs(db_factory: Callable[[], Session]) -> None:

    if not getattr(settings, "ENABLE_SCHEDULER", True):
        return

    if not _scheduler_lock.acquire(blocking=False):
        logger.info("Scheduler skipped (already running)")
        return

    start = time.time()
    logger.info("Background scheduler started")

    try:
        _execute_job(db_factory, _cleanup_accounts, "cleanup_accounts")
        _execute_job(db_factory, _process_outbox, "process_outbox")
        _execute_job(db_factory, _detect_offline_devices, "detect_offline_devices")
        _execute_job(db_factory, _recalculate_zone_risks, "recalculate_zone_risks")

    finally:
        duration = int((time.time() - start) * 1000)
        logger.info("Background scheduler completed", extra={"duration_ms": duration})
        _scheduler_lock.release()


# =========================================================
# Safe Job Executor
# =========================================================

def _execute_job(
    db_factory: Callable[[], Session],
    job_fn: Callable[[Session], None],
    job_name: str,
) -> None:

    db = db_factory()
    start = time.time()

    try:
        job_fn(db)
        db.commit()

        try:
            publish_after_commit(db)
        except Exception:
            logger.exception("After-commit publish failed")

        duration = int((time.time() - start) * 1000)

        logger.info(
            "Scheduler job completed",
            extra={"job": job_name, "duration_ms": duration},
        )

    except Exception:
        with suppress(Exception):
            db.rollback()

        logger.exception(
            "Scheduler job failed",
            extra={"job": job_name, "correlation_id": get_correlation_id()},
        )

    finally:
        with suppress(Exception):
            db.close()


# =========================================================
# 1️⃣ Account Cleanup
# =========================================================

def _cleanup_accounts(db: Session) -> None:

    deleted_count = permanently_delete_expired_accounts(db)

    create_audit_log(
        db=db,
        user_id=None,
        action=AuditAction.SYSTEM_MAINTENANCE,
        entity_type=EntityType.SYSTEM,
        new_value={
            "job": "cleanup_accounts",
            "deleted_count": deleted_count,
        },
    )


# =========================================================
# 2️⃣ Outbox Processing
# =========================================================

def _process_outbox(db: Session) -> None:
    process_outbox_events(db)


# =========================================================
# 3️⃣ Device Offline Detection
# =========================================================

def _detect_offline_devices(db: Session) -> None:

    threshold = datetime.now(timezone.utc) - timedelta(
        minutes=OFFLINE_THRESHOLD_MINUTES
    )

    devices = (
        db.query(IoTDevice)
        .filter(
            IoTDevice.deleted_at.is_(None),
            IoTDevice.last_seen.is_not(None),
            IoTDevice.last_seen < threshold,
            IoTDevice.status == DeviceStatus.ACTIVE.value,
        )
        .with_for_update()
        .limit(MAX_OFFLINE_DEVICES_PER_RUN)
        .all()
    )

    if not devices:
        return

    for device in devices:

        old_status = device.status
        device.status = DeviceStatus.INACTIVE.value

        create_outbox_event(
            db=db,
            topic="device.status_updated",
            payload={
                "device_id": device.device_id,
                "old_status": old_status,
                "new_status": DeviceStatus.INACTIVE.value,
            },
        )

        create_audit_log(
            db=db,
            user_id=None,
            action=AuditAction.UPDATE_DEVICE_STATUS,
            entity_type=EntityType.DEVICE,
            entity_id=device.id,
            old_value={"status": old_status},
            new_value={"status": DeviceStatus.INACTIVE.value},
        )

    logger.info("Devices marked inactive", extra={"count": len(devices)})


# =========================================================
# 4️⃣ Zone Risk Recalculation
# =========================================================

def _recalculate_zone_risks(db: Session) -> None:

    zone_ids = (
        db.query(Zone.id)
        .filter(
            Zone.is_active.is_(True),
            Zone.deleted_at.is_(None),
        )
        .all()
    )

    for (zone_id,) in zone_ids:
        try:
            update_zone_status(db, zone_id)
            db.flush()
        except Exception:
            logger.exception(
                "Zone recalculation failed",
                extra={"zone_id": zone_id},
            )

    logger.info("Zone recalculation completed", extra={"zone_count": len(zone_ids)})