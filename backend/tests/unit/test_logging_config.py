import logging
import json
import pytest
import sys

from app.core import logging_config


# =========================================================
# Correlation ID
# =========================================================

def test_correlation_id_set_and_get():
    logging_config.set_correlation_id("abc123")
    assert logging_config.get_correlation_id() == "abc123"


# =========================================================
# JSON Formatter
# =========================================================

def test_json_formatter_basic():
    formatter = logging_config.JSONFormatter()

    record = logging.LogRecord(
        name="test.logger",
        level=logging.INFO,
        pathname=__file__,
        lineno=10,
        msg="hello world",
        args=(),
        exc_info=None,
    )

    logging_config.set_correlation_id("cid-1")

    output = formatter.format(record)
    data = json.loads(output)

    assert data["level"] == "INFO"
    assert data["logger"] == "test.logger"
    assert data["message"] == "hello world"
    assert data["correlation_id"] == "cid-1"
    assert "timestamp" in data


def test_json_formatter_with_exception():
    formatter = logging_config.JSONFormatter()

    try:
        raise ValueError("boom")
    except ValueError:
        exc_info = logging.getLogger().handlers

    try:
        raise ValueError("boom")
    except ValueError:
        record = logging.LogRecord(
            name="test.logger",
            level=logging.ERROR,
            pathname=__file__,
            lineno=20,
            msg="error happened",
            args=(),
            exc_info=sys.exc_info(),
        )

    output = formatter.format(record)
    data = json.loads(output)

    assert "exception" in data


def test_json_formatter_with_extra_data():
    formatter = logging_config.JSONFormatter()

    record = logging.LogRecord(
        name="test.logger",
        level=logging.INFO,
        pathname=__file__,
        lineno=30,
        msg="extra test",
        args=(),
        exc_info=None,
    )

    record.extra_data = {"key": "value"}

    output = formatter.format(record)
    data = json.loads(output)

    assert "extra" in data
    assert data["extra"]["key"] == "value"


# =========================================================
# Dev Formatter
# =========================================================

def test_dev_formatter_basic():
    formatter = logging_config.DevFormatter()

    logging_config.set_correlation_id("dev-cid")

    record = logging.LogRecord(
        name="dev.logger",
        level=logging.DEBUG,
        pathname=__file__,
        lineno=40,
        msg="dev message",
        args=(),
        exc_info=None,
    )

    output = formatter.format(record)

    assert "[DEBUG]" in output
    assert "[dev-cid]" in output
    assert "dev.logger" in output
    assert "dev message" in output


def test_dev_formatter_with_exception():
    formatter = logging_config.DevFormatter()

    try:
        raise RuntimeError("fail")
    except RuntimeError:
        record = logging.LogRecord(
            name="dev.logger",
            level=logging.ERROR,
            pathname=__file__,
            lineno=50,
            msg="error",
            args=(),
            exc_info=sys.exc_info(),
        )

    output = formatter.format(record)

    assert "RuntimeError" in output


# =========================================================
# setup_logging
# =========================================================

def test_setup_logging_production(monkeypatch):
    monkeypatch.setattr(logging_config.settings, "ENVIRONMENT", "production")

    logging_config.setup_logging()

    root = logging.getLogger()

    assert root.level == logging.INFO
    assert len(root.handlers) == 1
    assert isinstance(root.handlers[0].formatter, logging_config.JSONFormatter)


def test_setup_logging_development(monkeypatch):
    monkeypatch.setattr(logging_config.settings, "ENVIRONMENT", "development")

    logging_config.setup_logging()

    root = logging.getLogger()

    assert root.level == logging.DEBUG
    assert len(root.handlers) == 1
    assert isinstance(root.handlers[0].formatter, logging_config.DevFormatter)


# =========================================================
# get_logger
# =========================================================

def test_get_logger_returns_logger():
    logger = logging_config.get_logger("my.test.logger")
    assert isinstance(logger, logging.Logger)
    assert logger.name == "my.test.logger"