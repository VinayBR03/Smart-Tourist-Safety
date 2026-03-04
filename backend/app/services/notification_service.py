from datetime import datetime, timezone, timedelta
from typing import Optional, List

from sqlalchemy.orm import Session
from sqlalchemy import select, func

from app.models.notification import Notification
from app.models.user import User

from app.core.enums import (
    NotificationChannel,
    NotificationSeverity,
    NotificationStatus,
    AuditAction,
    EntityType,
)

from app.core.exceptions import (
    ValidationError,
    NotFoundError,
    ForbiddenError,
)

from app.core.kafka import publish_event

from app.services.audit_service import create_audit_log
from app.templates.email_template import render_notification
from app.services.email_service import send_email
from app.services.push_service import send_push
from app.services.sms_service import send_sms


# =========================================================
# CONFIG
# =========================================================

MAX_RETRY_LIMIT = 5
BASE_BACKOFF_SECONDS = 30
MAX_BACKOFF_SECONDS = 3600
MAX_PAGE_SIZE = 100

DISPATCH_TOPIC = "notification.dispatch"
DLQ_TOPIC = "notification.dlq"


def _now():
    return datetime.now(timezone.utc)


# =========================================================
# CREATE NOTIFICATION
# =========================================================

def create_notification(
    db: Session,
    *,
    user_id: Optional[int],
    event_type: str,
    channel: NotificationChannel,
    severity: NotificationSeverity,
    related_entity_type: Optional[EntityType] = None,
    related_entity_id: Optional[int] = None,
    context: Optional[dict] = None,
) -> Notification:

    if not isinstance(channel, NotificationChannel):
        raise ValidationError("Invalid notification channel")

    if not isinstance(severity, NotificationSeverity):
        raise ValidationError("Invalid notification severity")

    if not event_type or not isinstance(event_type, str):
        raise ValidationError("Invalid event_type")

    event_type = event_type.strip()
    if len(event_type) > 100:
        raise ValidationError("event_type too long")

    user = None
    if user_id:
        user = (
            db.query(User)
            .filter(
                User.id == user_id,
                User.deleted_at.is_(None),
                User.is_active.is_(True),
            )
            .first()
        )
        if not user:
            raise NotFoundError("User")

    rendered = render_notification(
        event_type=event_type,
        user=user,
        context=context,
    )

    if not isinstance(rendered, dict):
        raise ValidationError("Invalid rendered template")
    
    if not rendered.get("template_version"):
        raise ValidationError("Rendered template missing version")
    
    if not rendered.get("language"):
        raise ValidationError("Rendered template missing language")

    notification = Notification(
        user_id=user_id,
        event_type=event_type,
        channel=channel,
        severity=severity,
        payload=dict(rendered),
        template_version=rendered.get("template_version"),
        language=rendered.get("language"),
        status=NotificationStatus.PENDING,
        retry_count=0,
    )

    db.add(notification)
    db.flush()

    create_audit_log(
        db=db,
        user_id=user_id,
        action=AuditAction.CREATE_NOTIFICATION,
        entity_type=EntityType.NOTIFICATION,
        entity_id=notification.id,
    )

    db.info.setdefault("kafka_events", []).append(
        {
            "notification_id": notification.id,
            "partition_key": str(user_id) if user_id else "system",
        }
    )

    return notification


# =========================================================
# READ / QUERY FUNCTIONS (Router Uses These)
# =========================================================

def get_notifications_for_user(
    db: Session,
    *,
    user_id: Optional[int],
    limit: int = 50,
    offset: int = 0,
) -> List[Notification]:

    if limit <= 0 or limit > MAX_PAGE_SIZE:
        limit = 50

    stmt = (
        select(Notification)
        .where(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc())
        .limit(limit)
        .offset(offset)
    )

    return db.execute(stmt).scalars().all()


def get_notification_by_id(
    db: Session,
    *,
    notification_id: int,
) -> Notification:

    notification = (
        db.query(Notification)
        .filter(Notification.id == notification_id)
        .first()
    )

    if not notification:
        raise NotFoundError("Notification")

    return notification


def mark_notification_as_read(
    db: Session,
    *,
    notification_id: int,
    user_id: int,
) -> Notification:

    stmt = (
        select(Notification)
        .where(Notification.id == notification_id)
        .with_for_update()
    )

    notification = db.execute(stmt).scalar_one_or_none()

    if not notification:
        raise NotFoundError("Notification")

    if notification.user_id != user_id:
        raise ForbiddenError("Access denied")

    if notification.status == NotificationStatus.SENT:
        notification.status = NotificationStatus.READ

    notification.updated_at = _now()

    create_audit_log(
        db=db,
        user_id=user_id,
        action=AuditAction.UPDATE_NOTIFICATION,
        entity_type=EntityType.NOTIFICATION,
        entity_id=notification.id,
    )

    return notification


def get_unread_count(
    db: Session,
    *,
    user_id: int,
) -> int:

    count = (
        db.query(func.count(Notification.id))
        .filter(
            Notification.user_id == user_id,
            Notification.status != NotificationStatus.READ,
        )
        .scalar()
    )

    return count or 0


# =========================================================
# AFTER COMMIT PUBLISH
# =========================================================

def publish_after_commit(db: Session):

    events = db.info.pop("kafka_events", [])

    for event in events:
        publish_event(
            topic=DISPATCH_TOPIC,
            payload={"notification_id": event["notification_id"]},
            partition_key=event["partition_key"],
            event_type="NOTIFICATION_DISPATCH_REQUESTED",
        )


# =========================================================
# WORKER DISPATCH
# =========================================================

def dispatch_notification_by_id(
    db: Session,
    *,
    notification_id: int,
) -> None:

    stmt = (
        select(Notification)
        .where(Notification.id == notification_id)
        .with_for_update()
    )

    notification = db.execute(stmt).scalar_one_or_none()
    if not notification:
        return

    if notification.status == NotificationStatus.SENT:
        return

    if notification.retry_count >= MAX_RETRY_LIMIT:
        notification.status = NotificationStatus.FAILED
        _publish_dlq(notification)
        return

    if notification.next_retry_at and _now() < notification.next_retry_at:
        _republish(notification)
        return

    try:
        _route_channel(db, notification)

        notification.status = NotificationStatus.SENT
        notification.sent_at = _now()
        notification.last_error = None
        notification.next_retry_at = None

    except Exception as e:
        notification.retry_count += 1
        notification.last_error = str(e)[:1000]

        backoff = min(
            BASE_BACKOFF_SECONDS * (2 ** notification.retry_count),
            MAX_BACKOFF_SECONDS,
        )

        notification.next_retry_at = _now() + timedelta(seconds=backoff)

        _republish(notification)


# =========================================================
# CHANNEL ROUTER
# =========================================================

def _route_channel(db: Session, notification: Notification):

    if notification.channel == NotificationChannel.IN_APP:
        return

    user = (
        db.query(User)
        .filter(
            User.id == notification.user_id,
            User.deleted_at.is_(None),
            User.is_active.is_(True),
        )
        .first()
    )

    if not user:
        raise ValidationError("User not found")

    payload = notification.payload or {}

    if notification.channel == NotificationChannel.EMAIL:
        if not user.email:
            raise ValidationError("User email missing")

        send_email(
            to=user.email,
            subject=payload.get("email_subject", ""),
            body=payload.get("email_body", ""),
        )
        return

    if notification.channel == NotificationChannel.PUSH:
        send_push(
            user_id=user.id,
            title=payload.get("push_title", ""),
            body=payload.get("push_body", ""),
        )
        return

    if notification.channel == NotificationChannel.SMS:
        if not user.phone:
            raise ValidationError("User phone missing")

        send_sms(
            phone=user.phone,
            message=payload.get("sms_body", ""),
        )
        return

    raise ValidationError("Unsupported notification channel")


# =========================================================
# RETRY + DLQ
# =========================================================

def _republish(notification: Notification):

    publish_event(
        topic=DISPATCH_TOPIC,
        payload={"notification_id": notification.id},
        partition_key=str(notification.user_id) if notification.user_id else "system",
        event_type="NOTIFICATION_RETRY",
    )


def _publish_dlq(notification: Notification):

    publish_event(
        topic=DLQ_TOPIC,
        payload={
            "notification_id": notification.id,
            "error": notification.last_error,
        },
        partition_key=str(notification.user_id) if notification.user_id else "system",
        event_type="NOTIFICATION_DEAD_LETTER",
    )