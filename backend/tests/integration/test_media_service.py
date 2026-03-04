import pytest
from datetime import datetime, timezone

from app.services.media_service import (
    generate_presigned_upload,
    confirm_media_upload,
    get_media_by_id,
    list_media_for_user,
    list_media_for_incident,
)

from app.models.user import User
from app.models.incident import Incident
from app.models.media import Media

from app.core.enums import (
    MediaType,
    IncidentStatus,
    UserRole,
)

from app.core.exceptions import (
    ValidationError,
    NotFoundError,
    ForbiddenError,
    ConflictError,
)

from app.core.security import hash_password


# =========================================================
# GLOBAL MOCKS
# =========================================================

@pytest.fixture(autouse=True)
def mock_external_services(mocker):

    mocker.patch("app.services.media_service.rate_limiter.enforce")
    mocker.patch("app.services.media_service.create_audit_log")
    mocker.patch("app.services.media_service.create_outbox_event")

    mock_s3 = mocker.patch("app.services.media_service.s3_client")

    mock_s3.generate_presigned_upload_url.return_value = "https://fake-upload-url"

    mock_s3.get_object_metadata.return_value = {
        "size": 1024,
        "content_type": "image/jpeg",
    }


# =========================================================
# UTIL
# =========================================================

def create_user(db, email="user@test.com", role=UserRole.TOURIST):
    user = User(
        email=email,
        password_hash=hash_password("StrongPassword123!"),
        role=role.value,
        is_active=True,
        is_pending_deletion=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


from app.core.enums import IncidentStatus, EventSource

def create_valid_incident(db, tourist_id, status=IncidentStatus.IN_PROGRESS.value):
    incident = Incident(
        tourist_id=tourist_id,
        description="Test incident description",
        status=status,
        source=EventSource.IOT.value,  # or any valid enum value
    )
    db.add(incident)
    db.commit()
    db.refresh(incident)
    return incident


# =========================================================
# GENERATE PRESIGNED UPLOAD
# =========================================================

def test_generate_invalid_content_type(db_session):
    user = create_user(db_session)

    with pytest.raises(ValidationError):
        generate_presigned_upload(
            db=db_session,
            user_id=user.id,
            user_role=UserRole.TOURIST,
            media_type=MediaType.PROFILE_PHOTO,
            content_type="application/pdf",
            file_size_bytes=100,
            incident_id=None,
        )


def test_generate_invalid_file_size(db_session):
    user = create_user(db_session)

    with pytest.raises(ValidationError):
        generate_presigned_upload(
            db=db_session,
            user_id=user.id,
            user_role=UserRole.TOURIST,
            media_type=MediaType.PROFILE_PHOTO,
            content_type="image/jpeg",
            file_size_bytes=0,
            incident_id=None,
        )


def test_profile_photo_with_incident_forbidden(db_session):
    user = create_user(db_session)

    with pytest.raises(ValidationError):
        generate_presigned_upload(
            db=db_session,
            user_id=user.id,
            user_role=UserRole.TOURIST,
            media_type=MediaType.PROFILE_PHOTO,
            content_type="image/jpeg",
            file_size_bytes=100,
            incident_id=1,
        )


def test_evidence_upload_wrong_user(db_session):
    user1 = create_user(db_session, email="a@test.com")
    user2 = create_user(db_session, email="b@test.com")

    incident = create_valid_incident(db_session, tourist_id=user1.id)

    with pytest.raises(ForbiddenError):
        generate_presigned_upload(
            db=db_session,
            user_id=user2.id,
            user_role=UserRole.TOURIST,
            media_type=MediaType.INCIDENT_EVIDENCE_PHOTO,
            content_type="image/jpeg",
            file_size_bytes=100,
            incident_id=incident.id,
        )


def test_resolution_upload_admin(db_session):
    admin = create_user(db_session, role=UserRole.ADMIN)

    incident = create_valid_incident(db_session, tourist_id=admin.id)

    result = generate_presigned_upload(
        db=db_session,
        user_id=admin.id,
        user_role=UserRole.ADMIN,
        media_type=MediaType.INCIDENT_RESOLUTION_PHOTO,
        content_type="image/jpeg",
        file_size_bytes=100,
        incident_id=incident.id,
    )

    assert "resolution" in result["s3_key"]


# =========================================================
# CONFIRM MEDIA UPLOAD
# =========================================================

def test_confirm_invalid_s3_key(db_session):
    with pytest.raises(ValidationError):
        confirm_media_upload(
            db=db_session,
            user_id=1,
            media_type=MediaType.PROFILE_PHOTO,
            s3_key="../hack",
            incident_id=None,
        )


def test_confirm_invalid_metadata(db_session, mocker):
    mocker.patch(
        "app.services.media_service.s3_client.get_object_metadata",
        return_value="invalid",
    )

    with pytest.raises(ValidationError):
        confirm_media_upload(
            db=db_session,
            user_id=1,
            media_type=MediaType.PROFILE_PHOTO,
            s3_key="profile/1/test",
            incident_id=None,
        )


def test_confirm_media_success(db_session):
    user = create_user(db_session)

    media = confirm_media_upload(
        db=db_session,
        user_id=user.id,
        media_type=MediaType.PROFILE_PHOTO,
        s3_key="profile/1/testkey",
        incident_id=None,
    )

    db_session.commit()

    assert media.id is not None


def test_confirm_incident_media_limit(db_session):
    user = create_user(db_session)
    incident = create_valid_incident(db_session, tourist_id=user.id)

    for i in range(20):
        db_session.add(
            Media(
                incident_id=incident.id,
                uploaded_by=user.id,
                media_type=MediaType.INCIDENT_EVIDENCE_PHOTO,
                s3_key=f"incident/{incident.id}/evidence/{i}",
                content_type="image/jpeg",
                file_size_bytes=1024,
                uploaded_at=datetime.now(timezone.utc),
            )
        )

    db_session.commit()

    with pytest.raises(ConflictError):
        confirm_media_upload(
            db=db_session,
            user_id=user.id,
            media_type=MediaType.INCIDENT_EVIDENCE_PHOTO,
            s3_key=f"incident/{incident.id}/evidence/new",
            incident_id=incident.id,
        )


# =========================================================
# READ FUNCTIONS
# =========================================================

def test_get_media_not_found(db_session):
    with pytest.raises(NotFoundError):
        get_media_by_id(db_session, media_id=999)


def test_list_media_for_user(db_session):
    user = create_user(db_session)

    confirm_media_upload(
        db=db_session,
        user_id=user.id,
        media_type=MediaType.PROFILE_PHOTO,
        s3_key="profile/1/key1",
        incident_id=None,
    )

    db_session.commit()

    results = list_media_for_user(db_session, user_id=user.id)
    assert len(results) == 1


def test_list_media_for_incident(db_session):
    user = create_user(db_session)
    incident = create_valid_incident(db_session, tourist_id=user.id)

    confirm_media_upload(
        db=db_session,
        user_id=user.id,
        media_type=MediaType.INCIDENT_EVIDENCE_PHOTO,
        s3_key=f"incident/{incident.id}/evidence/key",
        incident_id=incident.id,
    )

    db_session.commit()

    results = list_media_for_incident(db_session, incident_id=incident.id)
    assert len(results) == 1