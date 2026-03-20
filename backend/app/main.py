import asyncio
from contextlib import suppress, asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.database import SessionLocal, engine, check_db_health, setup_timescaledb
from app.core.config import settings
from app.core.logging_config import setup_logging
from app.core.middleware import AppMiddleware
from app.core.redis import RedisClient
from app.core.kafka import KafkaClient
from app.core.websocket_manager import websocket_manager

from app.utils.logger import get_logger
from app.services.cleanup_service import permanently_delete_expired_accounts

from app.routers import (
    analytics,
    auth,
    incident,
    tourist,
    location,
    iot,
    websocket,
    device,
    media,
    notification,
    zone,
    user_admin,
    health,
    internal,
)

from app.workers.kafka_consumer import start_kafka_consumer
from app.realtime.redis_listener import start_redis_listener


# =========================================================
# Logging Setup
# =========================================================

setup_logging()
logger = get_logger(__name__)


cleanup_task_handle = None
kafka_task_handle   = None
redis_task_handle   = None


# =========================================================
# Lifespan
# =========================================================

@asynccontextmanager
async def lifespan(app: FastAPI):

    global cleanup_task_handle
    global kafka_task_handle
    global redis_task_handle

    logger.info("Application startup initiated")

    # ── TimescaleDB ───────────────────────────────────────
    # Idempotent — safe on every restart.
    # Skips gracefully if already configured or if
    # ENABLE_TIMESCALEDB=false in settings.
    try:
        setup_timescaledb()
    except Exception:
        logger.exception("TimescaleDB setup failed — continuing startup")

    if settings.ENVIRONMENT != "testing":

        # Only run cleanup loop if Celery disabled
        if not settings.ENABLE_CELERY:

            async def cleanup_loop():
                while True:
                    db = SessionLocal()
                    try:
                        permanently_delete_expired_accounts(db)
                    except Exception:
                        logger.exception("Cleanup task failed")
                    finally:
                        db.close()

                    await asyncio.sleep(86400)

            cleanup_task_handle = asyncio.create_task(cleanup_loop())
            logger.info("Cleanup scheduler started")

        if settings.ENABLE_KAFKA:
            try:
                kafka_task_handle = asyncio.create_task(start_kafka_consumer())
                logger.info("Kafka consumer started")
            except Exception:
                logger.exception("Failed to start Kafka consumer")

        if settings.ENABLE_REDIS:
            try:
                redis_task_handle = asyncio.create_task(start_redis_listener())
                logger.info("Redis realtime listener started")
            except Exception:
                logger.exception("Failed to start Redis listener")

    logger.info("Application startup complete")

    yield

    # =========================================================
    # Shutdown
    # =========================================================

    logger.info("Application shutdown initiated")

    for task in [cleanup_task_handle, kafka_task_handle, redis_task_handle]:
        if task:
            task.cancel()
            with suppress(asyncio.CancelledError):
                await task

    RedisClient.close()
    KafkaClient.close()

    if websocket_manager:
        await websocket_manager.shutdown()

    engine.dispose()
    logger.info("Application shutdown complete")


# =========================================================
# App Instance
# =========================================================

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    lifespan=lifespan,
)


# =========================================================
# Middleware
# =========================================================

app.add_middleware(AppMiddleware)

if settings.ALLOWED_ORIGINS == "*":
    allow_origins = ["http://172.21.112.1:3000", "http://localhost:3000"]
else:
    allow_origins = [origin.strip() for origin in settings.ALLOWED_ORIGINS.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# Routers
# =========================================================

app.include_router(auth.router)
app.include_router(incident.router)
app.include_router(tourist.router)
app.include_router(user_admin.router)
app.include_router(location.router)
app.include_router(iot.router)
app.include_router(health.router)
app.include_router(device.router)
app.include_router(media.router)
app.include_router(notification.router)
app.include_router(zone.router)
app.include_router(analytics.router)
app.include_router(websocket.router)
app.include_router(internal.router)


# =========================================================
# Health Checks
# =========================================================

@app.get("/")
def health_check():
    return {
        "status":      "running",
        "environment": settings.ENVIRONMENT,
    }


@app.get("/health")
def readiness_check():
    return {
        "database":    "healthy" if check_db_health() else "unhealthy",
        "environment": settings.ENVIRONMENT,
    }