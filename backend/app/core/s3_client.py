# app/core/s3_client.py

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from typing import Optional

from app.core.config import settings
from app.core.exceptions import ServiceUnavailableError
from app.utils.logger import get_logger


logger = get_logger(__name__)


class S3Client:
    """
    Production-grade S3 wrapper.

    - Toggle safe
    - Lazy initialization
    - Controlled error surface
    - Docker safe
    """

    _client: Optional[boto3.client] = None

    # =========================================================
    # Lazy Client Initialization
    # =========================================================

    @classmethod
    def _get_client(cls):

        if not settings.ENABLE_S3:
            logger.debug("S3 disabled via configuration")
            raise ServiceUnavailableError("S3 disabled")

        if not all([
            settings.AWS_ACCESS_KEY_ID,
            settings.AWS_SECRET_ACCESS_KEY,
            settings.AWS_REGION,
            settings.AWS_S3_BUCKET,
        ]):
            raise ServiceUnavailableError("S3 configuration incomplete")

        if cls._client is None:
            try:
                cls._client = boto3.client(
                    "s3",
                    aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                    aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                    region_name=settings.AWS_REGION,
                )
                logger.info("S3 client initialized")
            except Exception:
                logger.exception("S3 initialization failed")
                raise ServiceUnavailableError("S3 unavailable")

        return cls._client

    # =========================================================
    # Presigned Upload URL
    # =========================================================

    @classmethod
    def generate_presigned_upload_url(
        cls,
        *,
        key: str,
        content_type: str,
        expires_in: int = 600,
    ) -> str:

        client = cls._get_client()

        try:
            return client.generate_presigned_url(
                ClientMethod="put_object",
                Params={
                    "Bucket": settings.AWS_S3_BUCKET,
                    "Key": key,
                    "ContentType": content_type,
                },
                ExpiresIn=expires_in,
            )
        except (BotoCoreError, ClientError) as e:
            logger.exception(
                "Failed to generate presigned URL",
                extra={"key": key, "error": str(e)},
            )
            raise ServiceUnavailableError("S3 unavailable")

    # =========================================================
    # Delete Object (Idempotent)
    # =========================================================

    @classmethod
    def delete_object(
        cls,
        key: str,
        *,
        suppress_not_found: bool = True,
    ) -> None:

        client = cls._get_client()

        try:
            client.delete_object(
                Bucket=settings.AWS_S3_BUCKET,
                Key=key,
            )

            logger.info(
                "S3 object deleted",
                extra={"key": key},
            )

        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code")

            if suppress_not_found and error_code in ("NoSuchKey", "404"):
                logger.warning(
                    "S3 object not found during delete",
                    extra={"key": key},
                )
                return

            logger.exception(
                "S3 delete failed",
                extra={"key": key, "error": str(e)},
            )
            raise ServiceUnavailableError("S3 deletion failed")

        except BotoCoreError as e:
            logger.exception(
                "S3 connection error",
                extra={"key": key, "error": str(e)},
            )
            raise ServiceUnavailableError("S3 unavailable")