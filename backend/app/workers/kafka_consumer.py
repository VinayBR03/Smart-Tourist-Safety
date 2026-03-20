# app/workers/kafka_consumer.py

import asyncio
import json
from typing import Dict, Any, List, Optional
from datetime import datetime

from kafka import KafkaConsumer
from kafka.consumer.fetcher import ConsumerRecord
from kafka.errors import KafkaError

from app.core.config import settings
from app.core.redis import get_redis
from app.utils.logger import get_logger


logger = get_logger(__name__)

# ─────────────────────────────────────────────────────────
# Topics
# ─────────────────────────────────────────────────────────

TOPIC_IOT_TELEMETRY = "iot.telemetry"       # published by Go MQTT ingestion worker

TOPICS: List[str] = [
    TOPIC_IOT_TELEMETRY,
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
        group_id="crowdguard-backend",
        value_deserializer=_deserialize_value,
        key_deserializer=_deserialize_key,
        consumer_timeout_ms=1000,
        max_poll_records=50,
    )


def _deserialize_value(raw: bytes) -> Dict[str, Any]:
    return json.loads(raw.decode("utf-8"))


def _deserialize_key(raw: Optional[bytes]) -> Optional[str]:
    if raw is None:
        return None
    return raw.decode("utf-8")


# =========================================================
# Redis Publisher (for non-IoT events → WebSocket fan-out)
# =========================================================

def _publish_to_redis(event: Dict[str, Any]) -> None:
    try:
        redis_client = get_redis(strict=False)
        if not redis_client:
            return
        redis_client.publish(REDIS_CHANNEL, json.dumps(event))
    except Exception:
        logger.exception("Redis publish failed")


# =========================================================
# IoT Telemetry Handler
# Called for every message on the iot.telemetry topic.
# The message was published by the Go MQTT ingestion worker.
# =========================================================

def _handle_iot_telemetry(data: Dict[str, Any]) -> None:
    """
    Process a single IoT telemetry event through the existing
    iot_service pipeline. Creates its own DB session so it is
    independent of the FastAPI request lifecycle.
    """
    from app.core.database import SessionLocal
    from app.services.iot_service import handle_location_event

    device_id: Optional[str] = data.get("device_id")
    if not device_id:
        logger.warning("iot.telemetry message missing device_id — skipping")
        return

    # Parse optional recorded_at
    device_timestamp: Optional[datetime] = None
    recorded_at_raw = data.get("recorded_at")
    if recorded_at_raw:
        try:
            device_timestamp = datetime.fromisoformat(recorded_at_raw)
        except (ValueError, TypeError):
            pass

    db = SessionLocal()
    try:
        handle_location_event(
            db=db,
            device_id=device_id,
            latitude=data.get("latitude"),
            longitude=data.get("longitude"),
            rssi=data.get("rssi"),
            sos_flag=data.get("sos_flag", False),
            heart_rate=data.get("heart_rate"),
            spo2=data.get("spo2"),
            temperature=data.get("body_temperature"),
            fall_detected=data.get("fall_detected", False),
            battery_percentage=data.get("battery_percentage"),
            battery_voltage=data.get("battery_voltage"),
            firmware_version=data.get("firmware_version"),
            device_timestamp=device_timestamp,
        )
        db.commit()
    except Exception:
        db.rollback()
        logger.exception(
            "IoT telemetry processing failed",
            extra={"extra_data": {"device_id": device_id}},
        )
    finally:
        db.close()


# =========================================================
# Event Routing
# =========================================================

def _handle_event(record: ConsumerRecord) -> None:
    try:
        event: Dict[str, Any] = record.value

        if not isinstance(event, dict):
            return

        topic: str = record.topic

        # ── IoT telemetry: process through iot_service pipeline ──
        if topic == TOPIC_IOT_TELEMETRY:
            _handle_iot_telemetry(event.get("data", {}))
            return

        # ── All other topics: fan-out via Redis → WebSocket ──
        redis_payload = {
            "event_type": event.get("event_type"),
            "data":        event.get("data", {}),
            "correlation_id": event.get("correlation_id"),
        }
        _publish_to_redis(redis_payload)

    except Exception:
        logger.exception("Failed processing Kafka message on topic %s", record.topic)


# =========================================================
# Async Consumer Loop
# =========================================================

async def start_kafka_consumer() -> None:
    if not settings.ENABLE_KAFKA:
        logger.info("Kafka consumer disabled")
        return

    logger.info("Starting Kafka consumer — topics: %s", TOPICS)

    loop = asyncio.get_running_loop()
    consumer: Optional[KafkaConsumer] = None

    while True:
        try:
            consumer = _create_consumer()
            logger.info("Kafka consumer connected")

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
                            await loop.run_in_executor(
                                None,
                                _handle_event,
                                record,
                            )

                except KafkaError:
                    logger.exception("Kafka polling error — reconnecting")
                    break   # break inner loop → reconnect

                except Exception:
                    logger.exception("Unexpected Kafka consumer error")
                    await asyncio.sleep(2)

        except Exception:
            logger.exception("Kafka consumer init failed — retrying in 5s")
            await asyncio.sleep(5)

        finally:
            if consumer:
                try:
                    consumer.close()
                except Exception:
                    logger.exception("Kafka consumer close error")
                consumer = None

        await asyncio.sleep(3)  # brief pause before reconnect