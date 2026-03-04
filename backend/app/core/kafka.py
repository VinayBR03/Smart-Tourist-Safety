# app/core/kafka.py

import json
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, Optional

from kafka import KafkaProducer
from kafka.errors import KafkaError

from app.core.config import settings
from app.utils.logger import get_logger


logger = get_logger(__name__)


class KafkaClient:
    _producer: Optional[KafkaProducer] = None

    # =========================================================
    # Create Producer
    # =========================================================

    @classmethod
    def _create_producer(cls) -> KafkaProducer:
        return KafkaProducer(
            bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
            key_serializer=lambda k: str(k).encode("utf-8"),
            value_serializer=lambda v: json.dumps(v).encode("utf-8"),
            acks="all",
            retries=5,
            linger_ms=5,
            compression_type="gzip",
            enable_idempotence=True,
            max_in_flight_requests_per_connection=1,  # safer for idempotence
            request_timeout_ms=15000,
            delivery_timeout_ms=30000,
            retry_backoff_ms=200,
        )

    # =========================================================
    # Get Producer (Lazy Init)
    # =========================================================

    @classmethod
    def get_producer(cls) -> Optional[KafkaProducer]:

        if not settings.ENABLE_KAFKA:
            logger.debug("Kafka disabled via configuration")
            return None

        if not settings.KAFKA_BOOTSTRAP_SERVERS:
            logger.warning("Kafka enabled but no bootstrap servers configured")
            return None

        if cls._producer is None:
            try:
                cls._producer = cls._create_producer()
                logger.info("Kafka producer initialized")
            except Exception:
                logger.exception("Kafka initialization failed")
                cls._producer = None
                return None

        return cls._producer

    # =========================================================
    # Shutdown
    # =========================================================

    @classmethod
    def close(cls):
        if cls._producer:
            try:
                cls._producer.flush(timeout=10)
                cls._producer.close(timeout=5)
                logger.info("Kafka producer closed")
            except Exception:
                logger.exception("Kafka shutdown failed")
            finally:
                cls._producer = None


# =========================================================
# Publish Event
# =========================================================

def publish_event(
    *,
    topic: str,
    payload: Dict[str, Any],
    partition_key: Optional[str] = None,
    event_type: Optional[str] = None,
    correlation_id: Optional[str] = None,
    wait_for_ack: bool = False,
) -> None:

    producer = KafkaClient.get_producer()

    if not producer:
        logger.debug("Kafka unavailable. Event skipped.")
        return

    event = {
        "event_id": str(uuid.uuid4()),
        "event_type": event_type or topic,
        "event_version": "1.0",
        "occurred_at": datetime.now(timezone.utc).isoformat(),
        "correlation_id": correlation_id,
        "data": payload,
    }

    try:
        future = producer.send(
            topic=topic,
            key=partition_key,
            value=event,
        )

        if wait_for_ack:
            future.get(timeout=10)

        future.add_callback(_on_success)
        future.add_errback(_on_error)

    except KafkaError:
        logger.exception("Kafka publish failed")


# =========================================================
# Callbacks
# =========================================================

def _on_success(metadata):
    logger.debug(
        "Kafka delivered topic=%s partition=%s offset=%s",
        metadata.topic,
        metadata.partition,
        metadata.offset,
    )


def _on_error(exc):
    logger.error("Kafka delivery failed: %s", str(exc))