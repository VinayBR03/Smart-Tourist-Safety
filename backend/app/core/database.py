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
# Engine Configuration (Config-Driven, Production Safe)
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

    execution_options={"stream_results": True},

    connect_args={
        "options": (
            f"-c statement_timeout={settings.DB_STATEMENT_TIMEOUT_MS} "
            f"-c application_name=smart_tourist_backend"
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
    """
    FastAPI dependency for DB session.
    Ensures safe open/close handling.
    """

    db = SessionLocal()

    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


# =========================================================
# Health Check Utility
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
# Graceful Shutdown
# =========================================================

def dispose_engine():
    try:
        logger.info("Disposing database engine")
        engine.dispose()
    except Exception:
        logger.exception("Error disposing database engine")


atexit.register(dispose_engine)