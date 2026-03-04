from datetime import datetime, timezone
from typing import Optional

from pydantic import (
    BaseModel,
    Field,
    ConfigDict,
    field_validator,
    model_validator,
)

from app.core.enums import MediaType


# =========================================================
# Shared Constraints (Aligned With DB)
# =========================================================

ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "video/mp4",
}

MAX_FILE_SIZE = 52_428_800  # 50MB
MIN_FILE_SIZE = 1


# =========================================================
# Generate Presigned Upload URL
# =========================================================

class MediaUploadRequest(BaseModel):
    """
    Used to request presigned upload URL.
    """

    media_type: MediaType

    incident_id: Optional[int] = Field(
        None,
        ge=1,
        description="Required for incident media uploads",
    )

    content_type: str = Field(
        ...,
        max_length=100,
    )

    file_size_bytes: int = Field(
        ...,
        ge=MIN_FILE_SIZE,
        le=MAX_FILE_SIZE,
    )

    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    # -----------------------------------------------------
    # Content type validation
    # -----------------------------------------------------

    @field_validator("content_type")
    @classmethod
    def validate_content_type(cls, value: str) -> str:
        value = value.strip().lower()

        if value not in ALLOWED_CONTENT_TYPES:
            raise ValueError("Unsupported content type.")

        return value

    # -----------------------------------------------------
    # Ownership integrity
    # -----------------------------------------------------

    @model_validator(mode="after")
    def validate_media_context(self):

        # PROFILE_PHOTO must not be linked to incident
        if self.media_type.name == "PROFILE_PHOTO":
            if self.incident_id is not None:
                raise ValueError(
                    "Profile photo cannot be linked to an incident."
                )
            return self

        # All other media types must belong to an incident
        if self.incident_id is None:
            raise ValueError(
                "Incident media must include incident_id."
            )

        return self


# =========================================================
# Presigned Upload Response
# =========================================================

class MediaUploadResponse(BaseModel):

    upload_url: str
    s3_key: str

    model_config = ConfigDict(
        from_attributes=True,
        frozen=True,
    )


# =========================================================
# Media Confirmation (After Upload)
# =========================================================

class MediaConfirmRequest(BaseModel):
    media_type: MediaType

    incident_id: Optional[int] = Field(
        None,
        ge=1,
        description="Required for incident media confirmation",
    )

    s3_key: str = Field(..., max_length=500)

    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    @field_validator("s3_key")
    @classmethod
    def validate_s3_key(cls, value: str):
        value = value.strip()

        if ".." in value:
            raise ValueError("Invalid S3 key.")

        if value.startswith("/") or value.startswith("\\"):
            raise ValueError("Invalid S3 key.")

        if "//" in value or "\\\\" in value:
            raise ValueError("Invalid S3 key.")

        if len(value) < 5:
            raise ValueError("Invalid S3 key length.")

        return value

    @model_validator(mode="after")
    def validate_context(self):
        if self.media_type == MediaType.PROFILE_PHOTO:
            if self.incident_id is not None:
                raise ValueError("Profile photo cannot have incident_id.")
        else:
            if self.incident_id is None:
                raise ValueError("Incident media requires incident_id.")
        return self


# =========================================================
# Media Response
# =========================================================

class MediaResponse(BaseModel):

    id: int

    user_id: Optional[int]
    incident_id: Optional[int]

    media_type: MediaType
    s3_key: str
    content_type: str
    file_size_bytes: int

    uploaded_by: Optional[int]
    uploaded_at: datetime

    is_deleted: bool

    model_config = ConfigDict(
        from_attributes=True,
        frozen=True,
    )

    # Defense in depth: re-validate metadata
    @field_validator("content_type")
    @classmethod
    def validate_content_type(cls, value: str):
        value = value.strip().lower()
        if value not in ALLOWED_CONTENT_TYPES:
            raise ValueError("Invalid stored content type.")
        return value

    @field_validator("file_size_bytes")
    @classmethod
    def validate_file_size(cls, value: int):
        if not (MIN_FILE_SIZE <= value <= MAX_FILE_SIZE):
            raise ValueError("Invalid stored file size.")
        return value


# =========================================================
# Media Summary View (Incident Page)
# =========================================================

class IncidentMediaSummary(BaseModel):

    id: int
    media_type: MediaType
    uploaded_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
        frozen=True,
    )