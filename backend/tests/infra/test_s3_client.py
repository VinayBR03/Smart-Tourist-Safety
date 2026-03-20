import pytest
from unittest.mock import MagicMock
from botocore.exceptions import BotoCoreError, ClientError

from app.core.s3_client import S3Client
from app.core.exceptions import ServiceUnavailableError


# =========================================================
# FIXTURE
# =========================================================

@pytest.fixture
def mock_s3(mocker):

    from app.core.s3_client import S3Client

    # Reset cached client between tests
    S3Client._client = None

    mock_client = MagicMock()

    mocker.patch(
        "app.core.s3_client.boto3.client",
        return_value=mock_client,
    )

    mocker.patch("app.core.s3_client.settings.ENABLE_S3", True)
    mocker.patch("app.core.s3_client.settings.AWS_ACCESS_KEY_ID", "test-key")
    mocker.patch("app.core.s3_client.settings.AWS_SECRET_ACCESS_KEY", "test-secret")
    mocker.patch("app.core.s3_client.settings.AWS_REGION", "us-east-1")
    mocker.patch("app.core.s3_client.settings.AWS_S3_BUCKET", "test-bucket")

    return mock_client


# =========================================================
# PRESIGNED URL SUCCESS
# =========================================================

def test_generate_presigned_url_success(mock_s3):
    mock_s3.generate_presigned_url.return_value = "http://presigned-url"

    client = S3Client()

    url = client.generate_presigned_upload_url(
        key="file.jpg",
        content_type="image/jpeg",
    )

    assert url == "http://presigned-url"
    mock_s3.generate_presigned_url.assert_called_once()


# =========================================================
# PRESIGNED URL FAILURE
# =========================================================

def test_generate_presigned_url_failure(mock_s3):
    mock_s3.generate_presigned_url.side_effect = ClientError(
        {"Error": {"Code": "500"}}, "put_object"
    )

    client = S3Client()

    with pytest.raises(ServiceUnavailableError):
        client.generate_presigned_upload_url(
            key="file.jpg",
            content_type="image/jpeg",
        )


# =========================================================
# DELETE SUCCESS
# =========================================================

def test_delete_object_success(mock_s3, mocker):

    logger_info = mocker.patch("app.core.s3_client.logger.info")

    client = S3Client()

    client.delete_object("file.jpg")

    mock_s3.delete_object.assert_called_once()

    logger_info.assert_any_call(
        "S3 object deleted",
        extra={"key": "file.jpg"}
    )


# =========================================================
# DELETE NOT FOUND SUPPRESSED
# =========================================================

def test_delete_object_not_found_suppressed(mock_s3, mocker):
    error = ClientError(
        {"Error": {"Code": "NoSuchKey"}}, "delete_object"
    )

    mock_s3.delete_object.side_effect = error

    logger_warning = mocker.patch("app.core.s3_client.logger.warning")

    client = S3Client()

    client.delete_object("missing.jpg")

    logger_warning.assert_called_once()


# =========================================================
# DELETE NOT FOUND NOT SUPPRESSED
# =========================================================

def test_delete_object_not_found_not_suppressed(mock_s3):
    error = ClientError(
        {"Error": {"Code": "NoSuchKey"}}, "delete_object"
    )

    mock_s3.delete_object.side_effect = error

    client = S3Client()

    with pytest.raises(ServiceUnavailableError):
        client.delete_object("missing.jpg", suppress_not_found=False)


# =========================================================
# DELETE CLIENT ERROR
# =========================================================

def test_delete_object_client_error(mock_s3):
    error = ClientError(
        {"Error": {"Code": "AccessDenied"}}, "delete_object"
    )

    mock_s3.delete_object.side_effect = error

    client = S3Client()

    with pytest.raises(ServiceUnavailableError):
        client.delete_object("file.jpg")


# =========================================================
# DELETE BOTO CORE ERROR
# =========================================================

def test_delete_object_boto_core_error(mock_s3):
    mock_s3.delete_object.side_effect = BotoCoreError()

    client = S3Client()

    with pytest.raises(ServiceUnavailableError):
        client.delete_object("file.jpg")