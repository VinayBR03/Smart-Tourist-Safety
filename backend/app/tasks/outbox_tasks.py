from celery import shared_task

from app.tasks.base import BaseTask
from app.core.database import SessionLocal
from app.services.outbox_service import process_outbox_events
from app.utils.logger import get_logger

logger = get_logger(__name__)


@shared_task(
    bind=True,
    base=BaseTask,
    name="app.tasks.outbox_tasks.process_outbox_task",
)
def process_outbox_task(self):

    with self.redis_lock("outbox_processor", timeout=120) as acquired:
        if not acquired:
            logger.debug("Outbox already processing elsewhere")
            return

        def _run(db):
            process_outbox_events(db=db, batch_size=100)

        self.execute(_run)