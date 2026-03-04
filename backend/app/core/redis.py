# app/core/redis.py

from typing import Optional
import redis
from redis import Redis
from redis.exceptions import RedisError
from redis.connection import ConnectionPool

from app.core.config import settings
from app.utils.logger import get_logger


logger = get_logger(__name__)


class RedisClient:
    _instance: Optional[Redis] = None
    _pool: Optional[ConnectionPool] = None

    # =========================================================
    # Create Client
    # =========================================================

    @classmethod
    def _create_client(cls) -> Redis:
        cls._pool = ConnectionPool.from_url(
            settings.redis_url,
            max_connections=20,  # safer default for API
            decode_responses=True,
            socket_timeout=5,
            socket_connect_timeout=5,
            socket_keepalive=True,
        )

        return redis.Redis(
            connection_pool=cls._pool,
            retry_on_timeout=True,
        )

    # =========================================================
    # Get Client (Safe + Reconnect)
    # =========================================================

    @classmethod
    def get_client(cls, strict: bool = True) -> Optional[Redis]:

        if not settings.ENABLE_REDIS:
            logger.debug("Redis disabled via configuration")
            if strict:
                raise RuntimeError("Redis disabled")
            return None

        # Create if not exists
        if cls._instance is None:
            try:
                cls._instance = cls._create_client()
                cls._instance.ping()
                logger.info("Redis connection established")
            except RedisError as e:
                logger.exception("Redis connection failed")
                cls._instance = None
                if strict:
                    raise RuntimeError("Redis unavailable") from e
                return None

        # Health check
        try:
            cls._instance.ping()
        except RedisError:
            logger.warning("Redis connection lost. Attempting reconnect...")
            cls._instance = None
            return cls.get_client(strict=strict)

        return cls._instance

    # =========================================================
    # Graceful Shutdown
    # =========================================================

    @classmethod
    def close(cls):
        try:
            if cls._instance:
                cls._instance.close()
            if cls._pool:
                cls._pool.disconnect()
            logger.info("Redis connection closed")
        except Exception:
            logger.warning("Error closing Redis connection")


# =========================================================
# FastAPI Dependency
# =========================================================

def get_redis(strict: bool = True) -> Redis:
    client = RedisClient.get_client(strict=strict)
    if client is None:
        raise RuntimeError("Redis client unavailable")
    return client