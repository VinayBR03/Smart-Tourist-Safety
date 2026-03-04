import pytest
from datetime import datetime, timedelta, timezone

from app.models.user import User
from app.tasks.cleanup_tasks import run_account_cleanup_task
from app.core.config import settings


@pytest.mark.e2e
def test_cleanup_flow(client, auth_headers, db_session, monkeypatch):
    """
    End-to-end account deletion lifecycle.

    Flow:
    1. Tourist requests deletion
    2. Grace period expires
    3. Cleanup task runs
    4. User is soft-deleted properly
    """

    # ---------------------------------------------------------
    # 1. Request account deletion
    # ---------------------------------------------------------
    response = client.post(
        "/tourists/me/request-deletion",
        headers=auth_headers,
    )
    assert response.status_code == 204

    # ---------------------------------------------------------
    # 2. Refresh DB state and fetch user
    # ---------------------------------------------------------
    db_session.commit()
    db_session.expire_all()

    user = db_session.query(User).filter(
        User.deletion_requested_at.isnot(None)
    ).first()

    assert user is not None
    user_id = user.id

    # ---------------------------------------------------------
    # 3. Force grace period expiration
    # ---------------------------------------------------------
    user.deletion_requested_at = (
        datetime.now(timezone.utc)
        - timedelta(days=settings.ACCOUNT_DELETION_GRACE_DAYS + 1)
    )

    user.is_pending_deletion = True
    db_session.commit()

    # ---------------------------------------------------------
    # 4. Patch get_db for Celery task execution
    # ---------------------------------------------------------
    def fake_get_db():
        yield db_session

    monkeypatch.setattr(
        "app.tasks.base.get_db",
        fake_get_db,
    )

    # Run task synchronously
    run_account_cleanup_task.apply()

    # ---------------------------------------------------------
    # 5. Validate soft-delete state
    # ---------------------------------------------------------
    db_session.commit()
    db_session.expire_all()

    deleted_user = db_session.get(User, user_id)

    assert deleted_user is not None

    # Soft-delete flags
    assert deleted_user.is_deleted is True
    assert deleted_user.deleted_at is not None

    # Account lifecycle flags
    assert deleted_user.is_active is False
    assert deleted_user.is_pending_deletion is False