# app/core/idempotency.py

import hashlib
import json
from typing import Optional, Callable, Any

from fastapi import Request
from redis.exceptions import RedisError

from app.core.redis import get_redis
from app.core.exceptions import ConflictError
from app.utils.logger import get_logger

logger = get_logger(__name__)


class IdempotencyManager:

    def __init__(self, ttl_seconds: int = 3600):
        try:
            self.redis = get_redis(strict=False)
        except Exception:
            self.redis = None
        self.ttl = ttl_seconds

    def _key(self, key: str) -> str:
        return f"idempotency:{key}"

    def _hash_payload(self, payload: dict) -> str:
        serialized = json.dumps(payload, sort_keys=True)
        return hashlib.sha256(serialized.encode()).hexdigest()

    def process(self, *, request: Request, payload: dict, operation: Callable[[], Any]) -> Any:

        if not self.redis:
            return operation()

        idempotency_key: Optional[str] = request.headers.get("Idempotency-Key")
        if not idempotency_key:
            return operation()

        redis_key = self._key(idempotency_key)
        payload_hash = self._hash_payload(payload)

        try:
            lock = self.redis.set(redis_key, "LOCKED", nx=True, ex=self.ttl)

            if lock:
                result = operation()

                snapshot = {
                    "payload_hash": payload_hash,
                    "response": result,
                }

                self.redis.setex(redis_key, self.ttl, json.dumps(snapshot))
                return result

            existing = self.redis.get(redis_key)
            if not existing:
                raise ConflictError("Idempotency state inconsistent")

            stored = json.loads(existing)

            if stored.get("payload_hash") != payload_hash:
                raise ConflictError("Idempotency key reused with different payload")

            return stored.get("response")

        except RedisError:
            logger.exception("Redis failure in idempotency")
            return operation()