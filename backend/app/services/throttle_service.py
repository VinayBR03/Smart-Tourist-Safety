from datetime import datetime, timedelta, timezone
from typing import Optional
import uuid

from redis import Redis
from redis.exceptions import RedisError

from app.core.redis import get_redis
from app.core.exceptions import ValidationError, ForbiddenError
from app.core.config import settings
from app.core.logging_config import get_correlation_id
from app.utils.logger import get_logger


logger = get_logger(__name__)

MAX_IDENTIFIER_LENGTH = 200
MAX_PREFIX_LENGTH = 50
MAX_RATE_LIMIT = 10_000
MAX_WINDOW_SECONDS = 86400


# =========================================================
# Location Snapshot Throttle
# =========================================================

def should_accept_location(
    *,
    last_timestamp: Optional[datetime],
    battery_percentage: Optional[float],
) -> bool:

    if not last_timestamp:
        return True

    now = datetime.now(timezone.utc)

    if last_timestamp.tzinfo is None:
        last_timestamp = last_timestamp.replace(tzinfo=timezone.utc)

    if last_timestamp > now:
        logger.warning(
            "Future timestamp detected in location throttle",
            extra={"extra_data": {"correlation_id": get_correlation_id()}},
        )
        return True

    interval = _resolve_interval(battery_percentage)

    return (now - last_timestamp) >= timedelta(seconds=interval)


def _resolve_interval(battery_percentage: Optional[float]) -> int:

    default_interval = getattr(
        settings,
        "LOCATION_DEFAULT_INTERVAL_SECONDS",
        15,
    )

    low_battery_interval = getattr(
        settings,
        "LOCATION_LOW_BATTERY_INTERVAL_SECONDS",
        60,
    )

    low_threshold = getattr(
        settings,
        "LOCATION_LOW_BATTERY_THRESHOLD",
        20,
    )

    if battery_percentage is None:
        return default_interval

    try:
        battery = float(battery_percentage)
    except (TypeError, ValueError):
        return default_interval

    battery = max(0.0, min(100.0, battery))

    if battery <= low_threshold:
        return low_battery_interval

    return default_interval


# =========================================================
# Redis Sliding Window Rate Limiter
# =========================================================

def enforce_rate_limit(
    *,
    identifier: str,
    prefix: str,
    limit: int,
    window_seconds: int,
    redis_client: Optional[Redis] = None,
    fail_open: bool = True,
) -> None:

    identifier, prefix = _validate_inputs(
        identifier, prefix, limit, window_seconds
    )

    try:
        redis_client = redis_client or get_redis(strict=False)
    except Exception:
        redis_client = None

    if not redis_client:
        if fail_open:
            return
        raise ForbiddenError("Rate limiter unavailable")

    key = f"rate_limit:{prefix}:{identifier}"

    now = datetime.now(timezone.utc).timestamp()
    window_start = now - window_seconds

    unique_member = f"{now}:{uuid.uuid4()}"

    try:
        pipeline = redis_client.pipeline()

        pipeline.zremrangebyscore(key, 0, window_start)
        pipeline.zadd(key, {unique_member: now})
        pipeline.zcard(key)
        pipeline.expire(key, window_seconds + 5)

        _, _, request_count, _ = pipeline.execute()

        if request_count > limit:
            logger.warning(
                "Rate limit exceeded",
                extra={
                    "extra_data": {
                        "identifier": identifier,
                        "prefix": prefix,
                        "correlation_id": get_correlation_id(),
                    }
                },
            )
            raise ForbiddenError("Too many requests")

    except RedisError:
        logger.exception(
            "Redis rate limiter failure",
            extra={
                "extra_data": {
                    "identifier": identifier,
                    "prefix": prefix,
                }
            },
        )

        if not fail_open:
            raise ForbiddenError("Rate limiter unavailable")


# =========================================================
# Input Validation
# =========================================================

def _validate_inputs(
    identifier: str,
    prefix: str,
    limit: int,
    window_seconds: int,
) -> tuple[str, str]:

    if not identifier or not isinstance(identifier, str):
        raise ValidationError("Rate limit identifier required")

    if not prefix or not isinstance(prefix, str):
        raise ValidationError("Rate limit prefix required")

    identifier = identifier.strip()
    prefix = prefix.strip()

    if not identifier:
        raise ValidationError("Rate limit identifier required")

    if not prefix:
        raise ValidationError("Rate limit prefix required")

    if ":" in prefix:
        raise ValidationError("Invalid rate limit prefix")

    if len(identifier) > MAX_IDENTIFIER_LENGTH:
        raise ValidationError("Rate limit identifier too long")

    if len(prefix) > MAX_PREFIX_LENGTH:
        raise ValidationError("Rate limit prefix too long")

    if limit <= 0 or limit > MAX_RATE_LIMIT:
        raise ValidationError("Invalid rate limit value")

    if window_seconds <= 0 or window_seconds > MAX_WINDOW_SECONDS:
        raise ValidationError("Invalid rate limit window")

    return identifier, prefix