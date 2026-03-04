import pytest
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.core.database import get_db, SessionLocal, engine


# =========================================================
# get_db – happy path
# =========================================================

def test_get_db_yields_session():
    generator = get_db()
    session = next(generator)

    assert isinstance(session, Session)

    # close generator cleanly
    with pytest.raises(StopIteration):
        next(generator)


# =========================================================
# get_db – rollback on exception
# =========================================================

def test_get_db_rolls_back_on_exception():
    generator = get_db()
    session = next(generator)

    # execute something valid
    session.execute(text("SELECT 1"))

    # simulate exception inside dependency
    with pytest.raises(RuntimeError):
        generator.throw(RuntimeError("force failure"))


# =========================================================
# SessionLocal produces new session
# =========================================================

def test_sessionlocal_creates_new_session():
    session1 = SessionLocal()
    session2 = SessionLocal()

    assert isinstance(session1, Session)
    assert isinstance(session2, Session)
    assert session1 is not session2

    session1.close()
    session2.close()


# =========================================================
# Engine connectivity
# =========================================================

def test_engine_connectivity():
    from sqlalchemy import text

    with engine.connect() as connection:
        result = connection.execute(text("SELECT 1"))
        assert result.scalar() == 1


# =========================================================
# Session close does not break
# =========================================================

def test_session_close():
    session = SessionLocal()
    session.close()

    # session can still be used to open new transaction
    session.execute(text("SELECT 1"))
    session.close()