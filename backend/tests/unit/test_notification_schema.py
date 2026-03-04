import pytest
from datetime import datetime, timedelta, timezone
from app.schemas.notification_schema import (
    NotificationCreateRequest,
    NotificationResponse,
)
from app.core.enums import (
    NotificationChannel,
    NotificationSeverity,
    NotificationStatus,
    UserLanguage,
)


# =========================================================
# CREATE REQUEST VALIDATION
# =========================================================

def test_event_type_normalization():
    obj = NotificationCreateRequest(
        user_id=1,
        event_type=" test_event ",
        channel=NotificationChannel.EMAIL,
        severity=NotificationSeverity.INFO,
    )
    assert obj.event_type == "TEST_EVENT"


def test_invalid_short_event_type():
    with pytest.raises(ValueError):
        NotificationCreateRequest(
            user_id=1,
            event_type="ab",
            channel=NotificationChannel.EMAIL,
            severity=NotificationSeverity.INFO,
        )


def test_invalid_correlation_id_with_space():
    with pytest.raises(ValueError):
        NotificationCreateRequest(
            user_id=1,
            event_type="VALID_EVENT",
            channel=NotificationChannel.EMAIL,
            severity=NotificationSeverity.INFO,
            correlation_id="bad id",
        )


def test_invalid_idempotency_key_with_space():
    with pytest.raises(ValueError):
        NotificationCreateRequest(
            user_id=1,
            event_type="VALID_EVENT",
            channel=NotificationChannel.EMAIL,
            severity=NotificationSeverity.INFO,
            idempotency_key="bad key",
        )


def test_entity_integrity_mismatch_type_only():
    with pytest.raises(ValueError):
        NotificationCreateRequest(
            user_id=1,
            event_type="VALID_EVENT",
            channel=NotificationChannel.EMAIL,
            severity=NotificationSeverity.INFO,
            related_entity_type="incident",
        )


def test_entity_integrity_mismatch_id_only():
    with pytest.raises(ValueError):
        NotificationCreateRequest(
            user_id=1,
            event_type="VALID_EVENT",
            channel=NotificationChannel.EMAIL,
            severity=NotificationSeverity.INFO,
            related_entity_id=5,
        )


def test_entity_type_normalization():
    obj = NotificationCreateRequest(
        user_id=1,
        event_type="VALID_EVENT",
        channel=NotificationChannel.EMAIL,
        severity=NotificationSeverity.INFO,
        related_entity_type="incident",
        related_entity_id=1,
    )
    assert obj.related_entity_type == "INCIDENT"


# =========================================================
# RESPONSE VALIDATION
# =========================================================

def build_valid_notification(**overrides):
    base = dict(
        id=1,
        user_id=1,
        event_type="TEST_EVENT",
        channel=NotificationChannel.EMAIL,
        severity=NotificationSeverity.INFO,
        status=NotificationStatus.PENDING,
        payload={"a": 1},
        template_version="v1",
        language=UserLanguage.EN,
        retry_count=0,
        next_retry_at=None,
        sent_at=None,
        last_error=None,
        version=1,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    base.update(overrides)
    return NotificationResponse(**base)


def test_retry_count_negative():
    with pytest.raises(ValueError):
        build_valid_notification(retry_count=-1)


def test_retry_count_too_large():
    with pytest.raises(ValueError):
        build_valid_notification(retry_count=25)


def test_sent_status_without_sent_at():
    with pytest.raises(ValueError):
        build_valid_notification(
            status=NotificationStatus.SENT,
            sent_at=None,
        )


def test_sent_at_in_future():
    future_time = datetime.now(timezone.utc) + timedelta(days=1)
    with pytest.raises(ValueError):
        build_valid_notification(
            status=NotificationStatus.SENT,
            sent_at=future_time,
        )


def test_valid_sent_notification():
    now = datetime.now(timezone.utc)
    obj = build_valid_notification(
        status=NotificationStatus.SENT,
        sent_at=now,
    )
    assert obj.status == NotificationStatus.SENT