# app/workers/kafka_consumer.py

import asyncio
import json
from typing import Dict, Any, List

from kafka import KafkaConsumer
from kafka.consumer.fetcher import ConsumerRecord
from kafka.errors import KafkaError

from app.core.config import settings
from app.core.redis import get_redis
from app.utils.logger import get_logger


logger = get_logger(__name__)

TOPICS: List[str] = [
    "incident.created",
    "incident.updated",
    "incident.resolved",
    "notification.dispatch",
    "media.uploaded",
]

REDIS_CHANNEL = "realtime.events"


# =========================================================
# Consumer Creation
# =========================================================

def _create_consumer() -> KafkaConsumer:
    return KafkaConsumer(
        *TOPICS,
        bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
        auto_offset_reset="latest",
        enable_auto_commit=True,
        group_id="smart-tourist-backend",
        value_deserializer=_deserialize_value,
        key_deserializer=_deserialize_key,
        consumer_timeout_ms=1000,
        max_poll_records=50,
    )


def _deserialize_value(raw: bytes) -> Dict[str, Any]:
    return json.loads(raw.decode("utf-8"))


def _deserialize_key(raw: bytes | None) -> str | None:
    if raw is None:
        return None
    return raw.decode("utf-8")


# =========================================================
# Redis Publisher
# =========================================================

def _publish_to_redis(event: Dict[str, Any]) -> None:
    try:
        redis_client = get_redis(strict=False)
        if not redis_client:
            return

        redis_client.publish(
            REDIS_CHANNEL,
            json.dumps(event),
        )

    except Exception:
        logger.exception("Redis publish failed")


# =========================================================
# Event Processing
# =========================================================

def _handle_event(record: ConsumerRecord) -> None:
    try:
        event: Dict[str, Any] = record.value

        if not isinstance(event, dict):
            return

        redis_payload = {
            "event_type": event.get("event_type"),
            "data": event.get("data", {}),
            "correlation_id": event.get("correlation_id"),
        }

        _publish_to_redis(redis_payload)

    except Exception:
        logger.exception("Failed processing Kafka message")


# =========================================================
# Async Consumer Loop
# =========================================================

async def start_kafka_consumer() -> None:
    if not settings.ENABLE_KAFKA:
        logger.info("Kafka consumer disabled")
        return

    logger.info("Starting Kafka consumer")

    loop = asyncio.get_running_loop()
    consumer: KafkaConsumer | None = None

    try:
        consumer = _create_consumer()

        while True:
            try:
                records = await loop.run_in_executor(
                    None,
                    consumer.poll,
                    1.0,
                )

                if not records:
                    await asyncio.sleep(0.1)
                    continue

                for messages in records.values():
                    for record in messages:
                        _handle_event(record)

            except KafkaError:
                logger.exception("Kafka polling error")
                await asyncio.sleep(2)

            except Exception:
                logger.exception("Unexpected Kafka consumer error")
                await asyncio.sleep(2)

    except Exception:
        logger.exception("Kafka consumer initialization failed")

    finally:
        if consumer:
            try:
                consumer.close()
            except Exception:
                logger.exception("Kafka consumer shutdown error")