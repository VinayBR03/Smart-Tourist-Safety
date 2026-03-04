import pytest
from unittest.mock import patch

from app.core.enums import MediaType, IncidentSource, IncidentStatus


# =========================================================
# GLOBAL MOCKS (S3 + Notifications safe)
# =========================================================

@pytest.fixture(autouse=True)
def mock_s3():
    with patch("app.services.media_service.s3_client") as mock:
        mock.generate_presigned_upload_url.return_value = "https://fake-upload-url"
        mock.get_object_metadata.return_value = {
            "size": 1024,
            "content_type": "image/jpeg",
        }
        yield mock


# =========================================================
# HELPERS
# =========================================================

def create_incident(client, auth_headers):
    response = client.post(
        "/incidents",
        json={
            "description": "Media test incident",
            "latitude": 12.0,
            "longitude": 77.0,
            "source": IncidentSource.MOBILE.name,
        },
        headers=auth_headers,
    )
    return response.json()["id"]


# =========================================================
# PROFILE PHOTO UPLOAD
# =========================================================

def test_tourist_generate_profile_photo_upload(client, auth_headers):
    payload = {
        "media_type": MediaType.PROFILE_PHOTO.name,
        "content_type": "image/jpeg",
        "file_size_bytes": 1000,
    }

    response = client.post(
        "/media/upload",
        json=payload,
        headers=auth_headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert "upload_url" in data
    assert "s3_key" in data


def test_profile_photo_rejects_incident_id(client, auth_headers):
    payload = {
        "media_type": MediaType.PROFILE_PHOTO.name,
        "incident_id": 1,
        "content_type": "image/jpeg",
        "file_size_bytes": 1000,
    }

    response = client.post(
        "/media/upload",
        json=payload,
        headers=auth_headers,
    )

    assert response.status_code == 422


# =========================================================
# INCIDENT EVIDENCE UPLOAD
# =========================================================

def test_tourist_can_generate_incident_evidence_upload(
    client, auth_headers
):
    incident_id = create_incident(client, auth_headers)

    payload = {
        "media_type": MediaType.INCIDENT_EVIDENCE_PHOTO.name,
        "incident_id": incident_id,
        "content_type": "image/jpeg",
        "file_size_bytes": 2048,
    }

    response = client.post(
        "/media/upload",
        json=payload,
        headers=auth_headers,
    )

    assert response.status_code == 200


def test_authority_cannot_upload_evidence(
    client, authority_headers, auth_headers
):
    incident_id = create_incident(client, auth_headers)

    payload = {
        "media_type": MediaType.INCIDENT_EVIDENCE_PHOTO.name,
        "incident_id": incident_id,
        "content_type": "image/jpeg",
        "file_size_bytes": 2048,
    }

    response = client.post(
        "/media/upload",
        json=payload,
        headers=authority_headers,
    )

    assert response.status_code == 403


# =========================================================
# CONFIRM UPLOAD
# =========================================================

def test_confirm_profile_photo_upload(client, auth_headers):
    upload_res = client.post(
        "/media/upload",
        json={
            "media_type": MediaType.PROFILE_PHOTO.name,
            "content_type": "image/jpeg",
            "file_size_bytes": 1000,
        },
        headers=auth_headers,
    )

    s3_key = upload_res.json()["s3_key"]

    confirm_res = client.post(
        "/media/confirm",
        json={
            "media_type": MediaType.PROFILE_PHOTO.name,
            "s3_key": s3_key,
        },
        headers=auth_headers,
    )

    assert confirm_res.status_code == 200
    assert confirm_res.json()["s3_key"] == s3_key


def test_confirm_invalid_s3_key(client, auth_headers):
    response = client.post(
        "/media/confirm",
        json={
            "media_type": MediaType.PROFILE_PHOTO.name,
            "s3_key": "../bad-key",
        },
        headers=auth_headers,
    )

    assert response.status_code in (400, 422)


# =========================================================
# GET MEDIA
# =========================================================

def test_owner_can_fetch_media(client, auth_headers):
    upload_res = client.post(
        "/media/upload",
        json={
            "media_type": MediaType.PROFILE_PHOTO.name,
            "content_type": "image/jpeg",
            "file_size_bytes": 1000,
        },
        headers=auth_headers,
    )

    s3_key = upload_res.json()["s3_key"]

    confirm_res = client.post(
        "/media/confirm",
        json={
            "media_type": MediaType.PROFILE_PHOTO.name,
            "s3_key": s3_key,
        },
        headers=auth_headers,
    )

    media_id = confirm_res.json()["id"]

    response = client.get(
        f"/media/{media_id}",
        headers=auth_headers,
    )

    assert response.status_code == 200


def test_other_user_cannot_fetch_media(
    client, auth_headers, create_user
):
    upload_res = client.post(
        "/media/upload",
        json={
            "media_type": MediaType.PROFILE_PHOTO.name,
            "content_type": "image/jpeg",
            "file_size_bytes": 1000,
        },
        headers=auth_headers,
    )

    s3_key = upload_res.json()["s3_key"]

    confirm_res = client.post(
        "/media/confirm",
        json={
            "media_type": MediaType.PROFILE_PHOTO.name,
            "s3_key": s3_key,
        },
        headers=auth_headers,
    )

    media_id = confirm_res.json()["id"]

    other_user = create_user(email="other_media@test.com")

    from app.core.security import create_access_token

    token = create_access_token(
        user_id=other_user.id,
        role=other_user.role.value,
        token_version=other_user.token_version,
    )

    headers = {"Authorization": f"Bearer {token}"}

    response = client.get(
        f"/media/{media_id}",
        headers=headers,
    )

    assert response.status_code == 403


# =========================================================
# LIST MEDIA
# =========================================================

def test_list_my_media(client, auth_headers):
    # Step 1: generate upload URL
    upload_res = client.post(
        "/media/upload",
        json={
            "media_type": MediaType.PROFILE_PHOTO.name,
            "content_type": "image/jpeg",
            "file_size_bytes": 1000,
        },
        headers=auth_headers,
    )
    assert upload_res.status_code == 200

    s3_key = upload_res.json()["s3_key"]

    # Step 2: confirm upload (this creates DB record)
    confirm_res = client.post(
        "/media/confirm",
        json={
            "media_type": MediaType.PROFILE_PHOTO.name,
            "s3_key": s3_key,
        },
        headers=auth_headers,
    )
    assert confirm_res.status_code == 200

    # Step 3: list media
    response = client.get(
        "/media/me",
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_generate_upload_validation_error(client, auth_headers, monkeypatch):
    def raise_validation(*args, **kwargs):
        from app.core.exceptions import ValidationError
        raise ValidationError("Invalid")

    monkeypatch.setattr(
        "app.routers.media.generate_presigned_upload",
        raise_validation,
    )

    payload = {
        "media_type": MediaType.PROFILE_PHOTO.name,
        "content_type": "image/jpeg",
        "file_size_bytes": 1000,
    }

    response = client.post("/media/upload", json=payload, headers=auth_headers)

    assert response.status_code == 400

def test_generate_upload_forbidden_error(client, auth_headers, monkeypatch):
    def raise_forbidden(*args, **kwargs):
        from app.core.exceptions import ForbiddenError
        raise ForbiddenError("Denied")

    monkeypatch.setattr(
        "app.routers.media.generate_presigned_upload",
        raise_forbidden,
    )

    payload = {
        "media_type": MediaType.PROFILE_PHOTO.name,
        "content_type": "image/jpeg",
        "file_size_bytes": 1000,
    }

    response = client.post("/media/upload", json=payload, headers=auth_headers)

    assert response.status_code == 403

def test_confirm_upload_validation_error(client, auth_headers, monkeypatch):
    def raise_validation(*args, **kwargs):
        from app.core.exceptions import ValidationError
        raise ValidationError("Invalid")

    monkeypatch.setattr(
        "app.routers.media.confirm_media_upload",
        raise_validation,
    )

    payload = {
        "media_type": MediaType.PROFILE_PHOTO.name,
        "s3_key": "profile/1/testkey",
    }

    response = client.post("/media/confirm", json=payload, headers=auth_headers)

    assert response.status_code == 400

def test_confirm_upload_not_found(client, auth_headers, monkeypatch):
    def raise_not_found(*args, **kwargs):
        from app.core.exceptions import NotFoundError
        raise NotFoundError("Missing")

    monkeypatch.setattr(
        "app.routers.media.confirm_media_upload",
        raise_not_found,
    )

    payload = {
        "media_type": MediaType.PROFILE_PHOTO.name,
        "s3_key": "profile/1/testkey",
    }

    response = client.post("/media/confirm", json=payload, headers=auth_headers)

    assert response.status_code == 404

def test_confirm_upload_forbidden(client, auth_headers, monkeypatch):
    def raise_forbidden(*args, **kwargs):
        from app.core.exceptions import ForbiddenError
        raise ForbiddenError("Denied")

    monkeypatch.setattr(
        "app.routers.media.confirm_media_upload",
        raise_forbidden,
    )

    payload = {
        "media_type": MediaType.PROFILE_PHOTO.name,
        "s3_key": "profile/1/testkey",
    }

    response = client.post("/media/confirm", json=payload, headers=auth_headers)

    assert response.status_code == 403

def test_fetch_media_not_found(client, auth_headers, monkeypatch):
    def raise_not_found(*args, **kwargs):
        from app.core.exceptions import NotFoundError
        raise NotFoundError("Missing")

    monkeypatch.setattr(
        "app.routers.media.get_media_by_id",
        raise_not_found,
    )

    response = client.get("/media/999", headers=auth_headers)

    assert response.status_code == 404

def test_list_incident_media_not_found(client, auth_headers, monkeypatch):
    def raise_not_found(*args, **kwargs):
        from app.core.exceptions import NotFoundError
        raise NotFoundError("Missing")

    monkeypatch.setattr(
        "app.routers.media.list_media_for_incident",
        raise_not_found,
    )

    response = client.get("/media/incident/999", headers=auth_headers)

    assert response.status_code == 404

