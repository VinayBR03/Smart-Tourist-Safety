from contextlib import contextmanager
from typing import Generator, Optional, Callable, Any

from celery import Task
from sqlalchemy.orm import Session
from redis import Redis

from app.core.database import get_db
from app.core.redis import get_redis
from app.core.logging_config import set_correlation_id, get_correlation_id
from app.utils.logger import get_logger

logger = get_logger(__name__)


class BaseTask(Task):
    """
    Production-grade Celery base task.

    Guarantees:
    - Fresh DB session per task
    - Proper commit/rollback handling
    - Preserves original exceptions (retry-safe)
    - Correlation ID propagation
    - Optional Redis distributed locking
    """

    abstract = True

    # Celery reliability defaults
    autoretry_for = (Exception,)
    retry_backoff = True
    retry_backoff_max = 300
    retry_jitter = True
    max_retries = 5
    acks_late = True
    reject_on_worker_lost = True

    # ---------------------------------------------------------
    # Correlation ID
    # ---------------------------------------------------------

    def bind_correlation(self) -> None:
        if not self.request:
            return

        headers = getattr(self.request, "headers", None)
        correlation = None

        if headers:
            correlation = headers.get("X-Correlation-ID")

        set_correlation_id(correlation or self.request.id)

    # ---------------------------------------------------------
    # Safe DB Execution Wrapper (FIXED)
    # ---------------------------------------------------------

    def execute(self, fn: Callable[[Session], Any]) -> Any:
        """
        Execute function inside managed DB session.

        Fix:
        - Uses next(get_db())
        - Explicit commit
        - No nested TransactionManager
        """

        db_generator = get_db()
        db: Session = next(db_generator)

        try:
            result = fn(db)
            db.commit()
            return result

        except Exception:
            db.rollback()
            raise

        finally:
            db.close()

    # ---------------------------------------------------------
    # Redis Distributed Lock
    # ---------------------------------------------------------

    @contextmanager
    def redis_lock(
        self,
        key: str,
        timeout: int = 60,
        blocking_timeout: int = 5,
    ) -> Generator[bool, None, None]:

        redis: Optional[Redis] = None

        try:
            redis = get_redis(strict=False)
        except Exception:
            logger.warning("Redis unavailable — proceeding without lock")
            yield True
            return

        lock = redis.lock(
            name=f"task-lock:{key}",
            timeout=timeout,
            blocking_timeout=blocking_timeout,
        )

        acquired = False

        try:
            acquired = lock.acquire(blocking=True)

            if not acquired:
                logger.warning("Could not acquire Redis lock: %s", key)
                yield False
                return

            yield True

        finally:
            if acquired:
                try:
                    lock.release()
                except Exception:
                    logger.warning("Redis lock release failed (ignored)")

    # ---------------------------------------------------------
    # Celery Call Override
    # ---------------------------------------------------------

    def __call__(self, *args, **kwargs):
        self.bind_correlation()

        logger.info(
            "Task started",
            extra={"extra_data": {"task": self.name, "correlation_id": get_correlation_id()}},
        )

        try:
            result = super().__call__(*args, **kwargs)

            logger.info(
                "Task completed",
                extra={"extra_data": {"task": self.name, "correlation_id": get_correlation_id()}},
            )

            return result

        except Exception:
            logger.exception(
                "Task failed",
                extra={"extra_data": {"task": self.name, "correlation_id": get_correlation_id()}},
            )
            raise