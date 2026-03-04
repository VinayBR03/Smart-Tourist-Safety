import pytest
from datetime import datetime, timezone, timedelta

from app.services.notification_service import (
    create_notification,
    get_notifications_for_user,
    get_notification_by_id,
    mark_notification_as_read,
    get_unread_count,
    dispatch_notification_by_id,
)

from app.models.notification import Notification
from app.models.user import User

from app.core.enums import (
    NotificationChannel,
    NotificationSeverity,
    NotificationStatus,
    UserRole,
)

from app.core.exceptions import (
    NotFoundError,
    ForbiddenError,
    ValidationError,
)

from app.core.security import hash_password


# =========================================================
# TEST UTIL
# =========================================================

def create_active_user(db, email="user@test.com"):
    user = User(
        email=email,
        password_hash=hash_password("StrongPassword123!"),
        role=UserRole.TOURIST.value,
        is_active=True,
        is_pending_deletion=False,
    )
    db.add(user)
    db.commit()
    return user


# =========================================================
# GLOBAL MOCKS
# =========================================================

@pytest.fixture(autouse=True)
def mock_external_services(mocker):
    mocker.patch("app.services.notification_service.render_notification", return_value={
        "email_subject": "Test",
        "email_body": "Body",
        "push_title": "Push",
        "push_body": "PushBody",
        "sms_body": "SMS",
        "template_version": "V1",
        "language": "EN",
    })

    mocker.patch("app.services.notification_service.send_email")
    mocker.patch("app.services.notification_service.send_push")
    mocker.patch("app.services.notification_service.send_sms")
    mocker.patch("app.services.notification_service.publish_event")
    mocker.patch("app.services.notification_service.create_audit_log")


# =========================================================
# CREATE NOTIFICATION
# =========================================================

def test_create_notification_success(db_session):

    user = create_active_user(db_session)

    notification = create_notification(
        db=db_session,
        user_id=user.id,
        event_type="TEST_EVENT",
        channel=NotificationChannel.EMAIL,
        severity=NotificationSeverity.INFO,
    )

    db_session.commit()

    stored = db_session.query(Notification).first()

    assert stored is not None
    assert stored.status == NotificationStatus.PENDING
    assert stored.template_version == "V1"
    assert stored.language == "EN"


def test_create_notification_invalid_user(db_session):

    with pytest.raises(NotFoundError):
        create_notification(
            db=db_session,
            user_id=999,
            event_type="TEST_EVENT",
            channel=NotificationChannel.EMAIL,
            severity=NotificationSeverity.INFO,
        )


# =========================================================
# READ FUNCTIONS
# =========================================================

def test_get_notifications_for_user(db_session):

    user = create_active_user(db_session)

    create_notification(
        db=db_session,
        user_id=user.id,
        event_type="EVENT_A",
        channel=NotificationChannel.IN_APP,
        severity=NotificationSeverity.INFO,
    )

    db_session.commit()

    results = get_notifications_for_user(
        db=db_session,
        user_id=user.id,
    )

    assert len(results) == 1


def test_get_notification_by_id_not_found(db_session):

    with pytest.raises(NotFoundError):
        get_notification_by_id(db_session, notification_id=999)


# =========================================================
# MARK AS READ
# =========================================================

def test_mark_notification_as_read(db_session):

    user = create_active_user(db_session)

    notification = create_notification(
        db=db_session,
        user_id=user.id,
        event_type="READ_EVENT",
        channel=NotificationChannel.IN_APP,
        severity=NotificationSeverity.INFO,
    )

    db_session.commit()

    notification.status = NotificationStatus.SENT
    notification.sent_at = datetime.now(timezone.utc)
    db_session.commit()

    updated = mark_notification_as_read(
        db=db_session,
        notification_id=notification.id,
        user_id=user.id,
    )

    db_session.commit()

    assert updated.status == NotificationStatus.READ


def test_mark_notification_forbidden(db_session):

    user1 = create_active_user(db_session, email="a@test.com")
    user2 = create_active_user(db_session, email="b@test.com")

    notification = create_notification(
        db=db_session,
        user_id=user1.id,
        event_type="EVENT",
        channel=NotificationChannel.IN_APP,
        severity=NotificationSeverity.INFO,
    )

    db_session.commit()

    with pytest.raises(ForbiddenError):
        mark_notification_as_read(
            db=db_session,
            notification_id=notification.id,
            user_id=user2.id,
        )


# =========================================================
# UNREAD COUNT
# =========================================================

def test_unread_count(db_session):

    user = create_active_user(db_session)

    create_notification(
        db=db_session,
        user_id=user.id,
        event_type="E1",
        channel=NotificationChannel.IN_APP,
        severity=NotificationSeverity.INFO,
    )

    db_session.commit()

    count = get_unread_count(db_session, user_id=user.id)

    assert count == 1


# =========================================================
# DISPATCH SUCCESS
# =========================================================

def test_dispatch_notification_success(db_session):

    user = create_active_user(db_session)

    notification = create_notification(
        db=db_session,
        user_id=user.id,
        event_type="EMAIL_EVENT",
        channel=NotificationChannel.EMAIL,
        severity=NotificationSeverity.INFO,
    )

    db_session.commit()

    dispatch_notification_by_id(
        db=db_session,
        notification_id=notification.id,
    )

    db_session.commit()

    updated = db_session.query(Notification).first()

    assert updated.status == NotificationStatus.SENT
    assert updated.sent_at is not None


# =========================================================
# DISPATCH RETRY
# =========================================================

def test_dispatch_retry_logic(db_session, mocker):

    user = create_active_user(db_session)

    mocker.patch(
        "app.services.notification_service.send_email",
        side_effect=Exception("SMTP Failure"),
    )

    notification = create_notification(
        db=db_session,
        user_id=user.id,
        event_type="FAIL_EVENT",
        channel=NotificationChannel.EMAIL,
        severity=NotificationSeverity.INFO,
    )

    db_session.commit()

    dispatch_notification_by_id(
        db=db_session,
        notification_id=notification.id,
    )

    db_session.commit()

    updated = db_session.query(Notification).first()

    assert updated.retry_count == 1
    assert updated.status == NotificationStatus.PENDING
    assert updated.next_retry_at is not None


# =========================================================
# CREATE VALIDATION BRANCHES
# =========================================================

def test_create_invalid_channel(db_session):
    user = create_active_user(db_session)

    with pytest.raises(ValidationError):
        create_notification(
            db=db_session,
            user_id=user.id,
            event_type="TEST",
            channel="INVALID",   # not enum
            severity=NotificationSeverity.INFO,
        )


def test_create_event_type_too_long(db_session):
    user = create_active_user(db_session)

    with pytest.raises(ValidationError):
        create_notification(
            db=db_session,
            user_id=user.id,
            event_type="X" * 101,
            channel=NotificationChannel.EMAIL,
            severity=NotificationSeverity.INFO,
        )


def test_render_returns_invalid_structure(db_session, mocker):
    user = create_active_user(db_session)

    mocker.patch(
        "app.services.notification_service.render_notification",
        return_value="INVALID"
    )

    with pytest.raises(ValidationError):
        create_notification(
            db=db_session,
            user_id=user.id,
            event_type="TEST",
            channel=NotificationChannel.EMAIL,
            severity=NotificationSeverity.INFO,
        )


# =========================================================
# PAGINATION GUARD
# =========================================================

def test_get_notifications_limit_guard(db_session):
    user = create_active_user(db_session)

    results = get_notifications_for_user(
        db=db_session,
        user_id=user.id,
        limit=1000,  # over max
    )

    assert results == []


# =========================================================
# MARK READ EDGE CASE
# =========================================================

def test_mark_read_when_already_read(db_session):
    user = create_active_user(db_session)

    notification = create_notification(
        db=db_session,
        user_id=user.id,
        event_type="EVENT",
        channel=NotificationChannel.IN_APP,
        severity=NotificationSeverity.INFO,
    )

    db_session.commit()

    notification.status = NotificationStatus.READ
    db_session.commit()

    updated = mark_notification_as_read(
        db=db_session,
        notification_id=notification.id,
        user_id=user.id,
    )

    assert updated.status == NotificationStatus.READ


# =========================================================
# DISPATCH EDGE CASES
# =========================================================

def test_dispatch_already_sent(db_session):
    user = create_active_user(db_session)

    notification = create_notification(
        db=db_session,
        user_id=user.id,
        event_type="EVENT",
        channel=NotificationChannel.EMAIL,
        severity=NotificationSeverity.INFO,
    )
    db_session.commit()

    notification.status = NotificationStatus.SENT
    notification.sent_at = datetime.now(timezone.utc)   # REQUIRED
    db_session.commit()

    dispatch_notification_by_id(
        db=db_session,
        notification_id=notification.id,
    )


def test_dispatch_retry_limit_reached(db_session):
    user = create_active_user(db_session)

    notification = create_notification(
        db=db_session,
        user_id=user.id,
        event_type="EVENT",
        channel=NotificationChannel.EMAIL,
        severity=NotificationSeverity.INFO,
    )
    db_session.commit()

    notification.retry_count = 5
    db_session.commit()

    dispatch_notification_by_id(
        db=db_session,
        notification_id=notification.id,
    )

    assert notification.status == NotificationStatus.FAILED


def test_dispatch_future_retry_republish(db_session):
    user = create_active_user(db_session)

    notification = create_notification(
        db=db_session,
        user_id=user.id,
        event_type="EVENT",
        channel=NotificationChannel.EMAIL,
        severity=NotificationSeverity.INFO,
    )
    db_session.commit()

    notification.next_retry_at = datetime.now(timezone.utc) + timedelta(minutes=5)
    db_session.commit()

    dispatch_notification_by_id(
        db=db_session,
        notification_id=notification.id,
    )


def test_route_channel_missing_user(db_session):
    user = create_active_user(db_session)

    notification = create_notification(
        db=db_session,
        user_id=user.id,
        event_type="EVENT",
        channel=NotificationChannel.EMAIL,
        severity=NotificationSeverity.INFO,
    )
    db_session.commit()

    # Now deactivate user AFTER notification creation
    user.is_active = False
    db_session.commit()

    dispatch_notification_by_id(
        db=db_session,
        notification_id=notification.id,
    )

    assert notification.retry_count == 1
    assert notification.status == NotificationStatus.PENDING


def test_route_channel_missing_email(db_session, mocker):
    user = create_active_user(db_session)

    notification = create_notification(
        db=db_session,
        user_id=user.id,
        event_type="EVENT",
        channel=NotificationChannel.EMAIL,
        severity=NotificationSeverity.INFO,
    )
    db_session.commit()

    # Force email sending to fail
    mocker.patch(
        "app.services.notification_service.send_email",
        side_effect=Exception("Email missing"),
    )

    dispatch_notification_by_id(
        db=db_session,
        notification_id=notification.id,
    )

    assert notification.retry_count == 1
    assert notification.status == NotificationStatus.PENDING
    assert notification.next_retry_at is not None


def test_route_channel_unsupported(db_session):
    user = create_active_user(db_session)

    notification = create_notification(
        db=db_session,
        user_id=user.id,
        event_type="EVENT",
        channel=NotificationChannel.IN_APP,
        severity=NotificationSeverity.INFO,
    )
    db_session.commit()

    dispatch_notification_by_id(
        db=db_session,
        notification_id=notification.id,
    )