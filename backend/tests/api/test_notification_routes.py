import pytest
from fastapi.testclient import TestClient
from datetime import datetime, timezone
from types import SimpleNamespace

import app.main as main_module

from app.core.exceptions import (
    NotFoundError,
    ForbiddenError,
    ValidationError,
)

from app.core.enums import (
    NotificationChannel,
    NotificationSeverity,
    NotificationStatus,
    UserLanguage,
)

from app.routers.notification import (
    get_current_user,
    require_roles,
)

client = TestClient(main_module.app)


# =========================================================
# Dependency Overrides
# =========================================================

@pytest.fixture(autouse=True)
def override_dependencies():

    from app.core.enums import UserRole

    def fake_user():
        return SimpleNamespace(id=1, role=UserRole.TOURIST)

    def fake_admin():
        return SimpleNamespace(id=99, role=UserRole.ADMIN)

    main_module.app.dependency_overrides[get_current_user] = fake_user

    # Proper override for require_roles
    def override_require_roles(role):
        return lambda: fake_admin()

    main_module.app.dependency_overrides[require_roles] = override_require_roles

    yield
    main_module.app.dependency_overrides.clear()


# =========================================================
# Helpers
# =========================================================

def fake_notification(user_id=1):
    now = datetime.now(timezone.utc)
    return SimpleNamespace(
        id=1,
        user_id=user_id,
        event_type="ALERT",
        channel=NotificationChannel.IN_APP,
        severity=NotificationSeverity.INFO,
        status=NotificationStatus.SENT,
        payload={"message": "hello"},
        template_version="v1",
        language=UserLanguage.EN,
        retry_count=0,
        next_retry_at=None,
        sent_at=now,
        last_error=None,
        version=1,
        created_at=now,
        updated_at=now,
    )


# =========================================================
# LIST NOTIFICATIONS
# =========================================================

def test_list_my_notifications(monkeypatch):

    monkeypatch.setattr(
        "app.routers.notification.get_notifications_for_user",
        lambda db, user_id: [
            SimpleNamespace(
                id=1,
                event_type="ALERT",
                severity=NotificationSeverity.INFO,
                status=NotificationStatus.SENT,
                created_at=datetime.now(timezone.utc),
            )
        ],
    )

    response = client.get("/notifications")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


# =========================================================
# GET DETAIL
# =========================================================

def test_get_notification_success(monkeypatch):

    monkeypatch.setattr(
        "app.routers.notification.get_notification_by_id",
        lambda db, notification_id: fake_notification(user_id=1),
    )

    response = client.get("/notifications/1")
    assert response.status_code == 200
    assert response.json()["id"] == 1


def test_get_notification_not_found(monkeypatch):

    monkeypatch.setattr(
        "app.routers.notification.get_notification_by_id",
        lambda db, notification_id: (_ for _ in ()).throw(NotFoundError()),
    )

    response = client.get("/notifications/1")
    assert response.status_code == 404


def test_get_notification_forbidden(monkeypatch):

    monkeypatch.setattr(
        "app.routers.notification.get_notification_by_id",
        lambda db, notification_id: fake_notification(user_id=999),
    )

    response = client.get("/notifications/1")
    assert response.status_code == 403


# =========================================================
# MARK AS READ
# =========================================================

def test_mark_as_read_success(monkeypatch):

    monkeypatch.setattr(
        "app.routers.notification.mark_notification_as_read",
        lambda db, notification_id, user_id: fake_notification(user_id=1),
    )

    response = client.post("/notifications/1/read", json={})
    assert response.status_code == 200
    assert response.json()["id"] == 1


def test_mark_as_read_not_found(monkeypatch):

    monkeypatch.setattr(
        "app.routers.notification.mark_notification_as_read",
        lambda db, notification_id, user_id: (_ for _ in ()).throw(NotFoundError()),
    )

    response = client.post("/notifications/1/read", json={})
    assert response.status_code == 404


def test_mark_as_read_forbidden(monkeypatch):

    monkeypatch.setattr(
        "app.routers.notification.mark_notification_as_read",
        lambda db, notification_id, user_id: (_ for _ in ()).throw(ForbiddenError()),
    )

    response = client.post("/notifications/1/read", json={})
    assert response.status_code == 403


def test_mark_as_read_validation_error(monkeypatch):

    monkeypatch.setattr(
        "app.routers.notification.mark_notification_as_read",
        lambda db, notification_id, user_id: (_ for _ in ()).throw(ValidationError("Invalid")),
    )

    response = client.post("/notifications/1/read", json={})
    assert response.status_code == 400


# =========================================================
# UNREAD COUNT
# =========================================================

def test_unread_count(monkeypatch):

    monkeypatch.setattr(
        "app.routers.notification.get_unread_count",
        lambda db, user_id: 5,
    )

    response = client.get("/notifications/unread-count")
    assert response.status_code == 200
    assert response.json()["unread_count"] == 5


# =========================================================
# ADMIN SYSTEM LIST
# =========================================================

def test_admin_system_notifications(monkeypatch):

    from app.core.enums import UserRole
    from app.routers.notification import get_current_user

    # Override current user to ADMIN
    main_module.app.dependency_overrides[get_current_user] = (
        lambda: SimpleNamespace(id=99, role=UserRole.ADMIN)
    )

    monkeypatch.setattr(
        "app.routers.notification.get_notifications_for_user",
        lambda db, user_id: [],
    )

    response = client.get("/notifications/admin/system")

    assert response.status_code == 200

    main_module.app.dependency_overrides.clear()