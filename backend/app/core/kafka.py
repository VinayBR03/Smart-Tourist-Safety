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

producer: Optional[KafkaProducer] = None


# =========================================================
# Topic Constants
# =========================================================

class KafkaTopic:
    # IoT ingestion — published by Go MQTT worker, consumed by kafka_consumer.py
    IOT_TELEMETRY          = "iot.telemetry"

    # Incident lifecycle
    INCIDENT_CREATED       = "incident.created"
    INCIDENT_UPDATED       = "incident.updated"
    INCIDENT_RESOLVED      = "incident.resolved"
    INCIDENT_SOS_TRIGGERED = "incident.sos_triggered"

    # Notifications
    NOTIFICATION_DISPATCH  = "notification.dispatch"

    # Media
    MEDIA_UPLOADED         = "media.uploaded"

    # Location
    LOCATION_EVENT         = "location.event"

    # Zone
    ZONE_RISK_UPDATED      = "zone.risk.updated"


# =========================================================
# Producer
# =========================================================

class KafkaClient:

    @staticmethod
    def create_producer() -> KafkaProducer:
        return KafkaProducer(
            bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
            key_serializer=lambda k: str(k).encode("utf-8"),
            value_serializer=lambda v: json.dumps(v).encode("utf-8"),
            acks="all",
            retries=5,
            linger_ms=5,
            compression_type="gzip",
            enable_idempotence=True,
            max_in_flight_requests_per_connection=1,
            request_timeout_ms=15000,
            delivery_timeout_ms=30000,
            retry_backoff_ms=200,
        )

    @staticmethod
    def close() -> None:
        global producer
        if producer:
            try:
                producer.flush(timeout=10)
                producer.close(timeout=5)
            except Exception:
                logger.exception("Kafka shutdown error")
            finally:
                producer = None


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

    global producer

    if producer is None:
        if not settings.ENABLE_KAFKA:
            logger.warning("Kafka disabled — event skipped: %s", topic)
            return
        try:
            producer = KafkaClient.create_producer()
        except Exception:
            logger.exception("Kafka producer init failed")
            return

    event = {
        "event_id":      str(uuid.uuid4()),
        "event_type":    event_type or topic,
        "event_version": "1.0",
        "occurred_at":   datetime.now(timezone.utc).isoformat(),
        "correlation_id": correlation_id,
        "data":          payload,
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
        logger.exception("Kafka publish failed — topic: %s", topic)


# =========================================================
# Callbacks
# =========================================================

def _on_success(metadata) -> None:
    logger.debug(
        "Kafka delivered topic=%s partition=%s offset=%s",
        metadata.topic,
        metadata.partition,
        metadata.offset,
    )


def _on_error(exc) -> None:
    logger.error("Kafka delivery failed: %s", str(exc))


def _shutdown() -> None:
    KafkaClient.close()