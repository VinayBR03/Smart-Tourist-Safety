import pytest
from unittest.mock import MagicMock

import app.core.database as db_module
from sqlalchemy.exc import SQLAlchemyError


# =========================================================
# get_db - normal execution
# =========================================================

def test_get_db_yields_and_closes(monkeypatch):

    fake_session = MagicMock()

    monkeypatch.setattr(db_module, "SessionLocal", lambda: fake_session)

    generator = db_module.get_db()
    session = next(generator)

    assert session == fake_session

    try:
        next(generator)
    except StopIteration:
        pass

    fake_session.close.assert_called_once()


# =========================================================
# get_db - rollback on exception
# =========================================================

def test_get_db_rollback_on_exception(monkeypatch):

    fake_session = MagicMock()

    monkeypatch.setattr(db_module, "SessionLocal", lambda: fake_session)

    generator = db_module.get_db()
    session = next(generator)

    assert session == fake_session

    with pytest.raises(RuntimeError):
        generator.throw(RuntimeError("failure"))

    fake_session.rollback.assert_called_once()
    fake_session.close.assert_called_once()


# =========================================================
# check_db_health - success
# =========================================================

def test_check_db_health_success(monkeypatch):

    fake_connection = MagicMock()
    fake_context = MagicMock()
    fake_context.__enter__.return_value = fake_connection
    fake_context.__exit__.return_value = None

    monkeypatch.setattr(db_module.engine, "connect", lambda: fake_context)

    assert db_module.check_db_health() is True


# =========================================================
# check_db_health - failure
# =========================================================

def test_check_db_health_failure(monkeypatch):

    def raise_error():
        raise SQLAlchemyError("db down")

    monkeypatch.setattr(db_module.engine, "connect", raise_error)

    assert db_module.check_db_health() is False


# =========================================================
# dispose_engine
# =========================================================

def test_dispose_engine(monkeypatch):

    fake_dispose = MagicMock()

    monkeypatch.setattr(db_module.engine, "dispose", fake_dispose)

    db_module.dispose_engine()

    fake_dispose.assert_called_once()


def test_dispose_engine_swallow_exception(monkeypatch):

    def raise_error():
        raise Exception("dispose failure")

    monkeypatch.setattr(db_module.engine, "dispose", raise_error)

    # Should not raise
    db_module.dispose_engine()