# app/core/database.py

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from sqlalchemy.pool import QueuePool
from sqlalchemy.exc import SQLAlchemyError
import atexit

from app.core.config import settings
from app.utils.logger import get_logger


logger = get_logger(__name__)


# =========================================================
# Engine
# =========================================================

engine = create_engine(
    settings.DATABASE_URL,

    poolclass=QueuePool,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_timeout=settings.DB_POOL_TIMEOUT,
    pool_recycle=settings.DB_POOL_RECYCLE,

    pool_pre_ping=True,
    pool_reset_on_return="rollback",

    future=True,
    echo=settings.DEBUG,
    isolation_level="READ COMMITTED",

    connect_args={
        "options": (
            f"-c statement_timeout={settings.DB_STATEMENT_TIMEOUT_MS} "
            f"-c application_name=crowdguard_backend"
        )
    },
)


# =========================================================
# Base Model
# =========================================================

class Base(DeclarativeBase):
    pass


# =========================================================
# Session Factory
# =========================================================

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
)


# =========================================================
# Dependency Injection
# =========================================================

def get_db():
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


# =========================================================
# TimescaleDB Setup
#
# Called once at application startup (from main.py lifespan).
# Safe to call on every restart — all statements use
# IF NOT EXISTS / OR REPLACE guards.
#
# What it does:
#   1. Enables the timescaledb extension
#   2. Converts health_telemetry to a hypertable partitioned
#      by recorded_at with 1-day chunks
#   3. Configures columnar compression segmented by tourist_id
#   4. Adds an automatic compression policy (compress chunks
#      older than 7 days)
#   5. Adds a data retention policy (drop chunks older than
#      settings.TELEMETRY_RETENTION_DAYS, default 365)
# =========================================================

def setup_timescaledb() -> None:
    """
    Idempotent TimescaleDB initialisation for health_telemetry.
    Safe to run on every application start.
    """

    if not getattr(settings, "ENABLE_TIMESCALEDB", True):
        logger.info("TimescaleDB setup skipped (ENABLE_TIMESCALEDB=false)")
        return

    retention_days: int = getattr(settings, "TELEMETRY_RETENTION_DAYS", 365)

    statements = [
        # 1. Extension
        (
            "TimescaleDB extension",
            "CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;",
        ),

        # 2. Hypertable
        # chunk_time_interval = 1 day is appropriate for ~200k rows/day.
        # Adjust to '1 week' if write rate is lower in non-event periods.
        (
            "health_telemetry hypertable",
            """
            SELECT create_hypertable(
                'health_telemetry',
                'recorded_at',
                chunk_time_interval  => INTERVAL '1 day',
                if_not_exists        => TRUE,
                migrate_data         => TRUE
            );
            """,
        ),

        # 3. Compression settings
        # segment by tourist_id → each compressed chunk groups one tourist's
        # data together, making per-tourist queries extremely fast.
        # orderby recorded_at DESC → most-recent-first queries skip decompression.
        (
            "health_telemetry compression settings",
            """
            ALTER TABLE health_telemetry SET (
                timescaledb.compress,
                timescaledb.compress_segmentby = 'tourist_id',
                timescaledb.compress_orderby   = 'recorded_at DESC'
            );
            """,
        ),

        # 4. Automatic compression policy (chunks older than 7 days)
        (
            "health_telemetry compression policy",
            """
            SELECT add_compression_policy(
                'health_telemetry',
                INTERVAL '7 days',
                if_not_exists => TRUE
            );
            """,
        ),

        # 5. Data retention policy
        (
            "health_telemetry retention policy",
            f"""
            SELECT add_retention_policy(
                'health_telemetry',
                INTERVAL '{retention_days} days',
                if_not_exists => TRUE
            );
            """,
        ),
    ]

    with engine.begin() as conn:
        for label, sql in statements:
            try:
                conn.execute(text(sql))
                logger.info("TimescaleDB: %s — OK", label)
            except Exception as exc:
                # Log and continue — a partial setup is better than blocking
                # startup. The most common cause is the extension already
                # being configured identically (harmless).
                logger.warning(
                    "TimescaleDB: %s — skipped (%s)",
                    label,
                    exc,
                )


# =========================================================
# Health Check
# =========================================================

def check_db_health() -> bool:
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return True
    except SQLAlchemyError:
        logger.exception("Database health check failed")
        return False


# =========================================================
# Shutdown
# =========================================================

def dispose_engine():
    try:
        engine.dispose()
    except Exception:
        logger.exception("Error disposing database engine")


atexit.register(dispose_engine)