from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any
import json
import copy

from sqlalchemy.orm import Session
from sqlalchemy import select

from app.models.event_outbox import EventOutbox
from app.core.kafka import publish_event
from app.core.exceptions import ValidationError
from app.core.logging_config import get_correlation_id
from app.utils.logger import get_logger


logger = get_logger(__name__)


MAX_RETRY_ATTEMPTS = 5
BASE_BACKOFF_SECONDS = 30
MAX_BACKOFF_SECONDS = 3600  # 🔒 Hard cap (1 hour)
MAX_OUTBOX_PAYLOAD_BYTES = 50_000
MAX_STRING_FIELD_LENGTH = 100
MAX_BATCH_SIZE = 1000  # 🔒 Prevent accidental massive locking


# =========================================================
# Create Outbox Event (Transactional Only – NO COMMIT)
# =========================================================

def create_outbox_event(
    db: Session,
    *,
    topic: str,
    payload: Dict[str, Any],
    event_type: Optional[str] = None,
    partition_key: Optional[str] = None,
    correlation_id: Optional[str] = None,
) -> EventOutbox:

    if db is None:
        raise ValidationError("Database session required")

    if not topic or not isinstance(topic, str):
        raise ValidationError("Outbox event requires valid topic")

    topic = topic.strip()
    if not topic:
        raise ValidationError("Topic cannot be empty")

    if len(topic) > MAX_STRING_FIELD_LENGTH:
        raise ValidationError("Topic too long")

    if not isinstance(payload, dict):
        raise ValidationError("Outbox payload must be dict")

    event_type = _validate_optional_string(event_type, "event_type")
    partition_key = _validate_optional_string(partition_key, "partition_key")
    correlation_id = _validate_optional_string(
        correlation_id or get_correlation_id(),
        "correlation_id",
    )

    safe_payload = _safe_payload(payload)

    event = EventOutbox(
        topic=topic,
        payload=safe_payload,
        is_published=False,
        retry_count=0,
        event_type=event_type,
        partition_key=partition_key,
        correlation_id=correlation_id,
        next_retry_at=None,
    )

    db.add(event)

    logger.debug(
        "Outbox event created",
        extra={
            "extra_data": {
                "topic": topic,
                "event_type": event_type,
                "correlation_id": correlation_id,
            }
        },
    )

    return event


# =========================================================
# Publish Pending Events (Worker Safe)
# =========================================================

def process_outbox_events(
    db: Session,
    *,
    batch_size: int = 100,
) -> None:

    if db is None:
        raise ValidationError("Database session required")

    if batch_size <= 0:
        raise ValidationError("batch_size must be positive")

    if batch_size > MAX_BATCH_SIZE:
        raise ValidationError("batch_size too large")

    now = datetime.now(timezone.utc)

    stmt = (
        select(EventOutbox)
        .where(
            EventOutbox.is_published.is_(False),
            EventOutbox.retry_count < MAX_RETRY_ATTEMPTS,
            (
                (EventOutbox.next_retry_at.is_(None)) |
                (EventOutbox.next_retry_at <= now)
            )
        )
        .order_by(EventOutbox.created_at.asc())
        .limit(batch_size)
        .with_for_update(skip_locked=True)
    )

    events: List[EventOutbox] = db.execute(stmt).scalars().all()

    if not events:
        return

    for event in events:
        _publish_single_event(event)


# =========================================================
# Publish Single Event
# =========================================================

def _publish_single_event(event: EventOutbox) -> None:

    if event.is_published:
        return

    if event.retry_count >= MAX_RETRY_ATTEMPTS:
        logger.error(
            "Outbox event exceeded retry limit",
            extra={"extra_data": {"event_id": event.id}},
        )
        return

    try:
        publish_event(
            topic=event.topic,
            payload=event.payload,
            partition_key=event.partition_key,
            event_type=event.event_type,
            correlation_id=event.correlation_id,
        )

        event.is_published = True
        event.published_at = datetime.now(timezone.utc)
        event.last_error = None
        event.next_retry_at = None

        logger.info(
            "Outbox event published",
            extra={"extra_data": {"event_id": event.id}},
        )

    except Exception as e:
        event.retry_count += 1
        event.last_error = str(e)[:1000]

        backoff_seconds = min(
            BASE_BACKOFF_SECONDS * (2 ** event.retry_count),
            MAX_BACKOFF_SECONDS,
        )

        event.next_retry_at = datetime.now(timezone.utc) + timedelta(
            seconds=backoff_seconds
        )

        logger.exception(
            "Outbox publish failed",
            extra={
                "extra_data": {
                    "event_id": event.id,
                    "retry_count": event.retry_count,
                }
            },
        )


# =========================================================
# Helpers
# =========================================================

def _safe_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    copied = copy.deepcopy(payload)

    try:
        serialized = json.dumps(copied, sort_keys=True)
    except Exception:
        raise ValidationError("Outbox payload must be JSON serializable")

    if len(serialized.encode("utf-8")) > MAX_OUTBOX_PAYLOAD_BYTES:
        raise ValidationError("Outbox payload exceeds maximum allowed size")

    return copied


def _validate_optional_string(
    value: Optional[str],
    field_name: str,
) -> Optional[str]:

    if value is None:
        return None

    if not isinstance(value, str):
        raise ValidationError(f"{field_name} must be string")

    value = value.strip()

    if not value:
        raise ValidationError(f"{field_name} cannot be empty")

    if len(value) > MAX_STRING_FIELD_LENGTH:
        raise ValidationError(f"{field_name} too long")

    return value