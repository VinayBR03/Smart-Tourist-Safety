# app/core/rate_limiter.py

import time
import uuid
from typing import Optional

from redis import Redis
from redis.exceptions import RedisError
from fastapi import HTTPException, status

from app.core.redis import get_redis
from app.core.config import settings
from app.utils.logger import get_logger


logger = get_logger(__name__)


class RateLimiter:

    def __init__(
        self,
        redis_client: Optional[Redis] = None,
        fail_open: bool = True,
    ):
        self.fail_open = fail_open

        if not settings.ENABLE_RATE_LIMITER:
            self.redis = None
            return

        try:
            self.redis = redis_client or get_redis(strict=False)
        except Exception:
            self.redis = None

    def _key(self, prefix: str, identifier: str) -> str:
        return f"rate_limit:{prefix}:{identifier}"

    def enforce(
        self,
        *,
        prefix: str,
        identifier: str,
        limit: int,
        window_seconds: int,
    ) -> None:

        if not self.redis:
            return

        now = int(time.time())
        window_start = now - window_seconds
        key = self._key(prefix, identifier)
        member = f"{now}-{uuid.uuid4()}"

        try:
            pipeline = self.redis.pipeline()

            # Remove expired entries
            pipeline.zremrangebyscore(key, 0, window_start)

            # Add current request
            pipeline.zadd(key, {member: now})

            # Count current window
            pipeline.zcard(key)

            # Set expiry only if key new
            pipeline.expire(key, window_seconds)

            _, _, request_count, _ = pipeline.execute()

            if request_count > limit:
                logger.warning(
                    "Rate limit exceeded",
                    extra={
                        "extra_data": {
                            "prefix": prefix,
                            "identifier": identifier,
                            "limit": limit,
                            "window_seconds": window_seconds,
                        }
                    },
                )

                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many requests",
                )

        except RedisError:
            logger.exception("Rate limiter Redis failure")

            if not self.fail_open:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Rate limiter unavailable",
                )