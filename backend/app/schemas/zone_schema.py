from datetime import datetime, timezone
from typing import Optional, List, Tuple

from pydantic import (
    BaseModel,
    Field,
    ConfigDict,
    field_validator,
    model_validator,
)

from app.core.enums import RiskLevel


# =========================================================
# Shared Constants
# =========================================================

MAX_ZONE_NAME_LENGTH = 100
MAX_ZONE_TYPE_LENGTH = 50

MAX_ZONE_RADIUS_METERS = 50_000  # 50km safety cap
MIN_POLYGON_POINTS = 4  # closed polygon minimum

RISK_LOW_THRESHOLD = 0.4
RISK_MEDIUM_THRESHOLD = 0.7


# =========================================================
# Helpers
# =========================================================

def normalize_zone_name(value: str) -> str:
    return value.strip()


def normalize_zone_type(value: Optional[str]) -> Optional[str]:
    if value:
        return value.strip().upper()
    return value


# =========================================================
# Create Circular Zone
# =========================================================

class ZoneCreateCircularRequest(BaseModel):

    name: str = Field(..., max_length=MAX_ZONE_NAME_LENGTH)
    zone_type: Optional[str] = Field(None, max_length=MAX_ZONE_TYPE_LENGTH)

    center_latitude: float = Field(..., ge=-90, le=90)
    center_longitude: float = Field(..., ge=-180, le=180)

    radius_meters: float = Field(..., gt=0)

    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        value = normalize_zone_name(value)
        if len(value) < 3:
            raise ValueError("Zone name too short.")
        return value

    @field_validator("zone_type")
    @classmethod
    def validate_zone_type(cls, value: Optional[str]):
        return normalize_zone_type(value)

    @field_validator("radius_meters")
    @classmethod
    def validate_radius(cls, value: float):
        if value > MAX_ZONE_RADIUS_METERS:
            raise ValueError("Zone radius exceeds allowed limit.")
        return value

    @field_validator("center_latitude", "center_longitude")
    @classmethod
    def normalize_coordinates(cls, value: float):
        return round(value, 7)


# =========================================================
# Create Polygon Zone
# =========================================================

class ZoneCreatePolygonRequest(BaseModel):

    name: str = Field(..., max_length=MAX_ZONE_NAME_LENGTH)
    zone_type: Optional[str] = Field(None, max_length=MAX_ZONE_TYPE_LENGTH)

    coordinates: List[Tuple[float, float]] = Field(
        ...,
        description="List of (longitude, latitude) tuples",
    )

    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        value = normalize_zone_name(value)
        if len(value) < 3:
            raise ValueError("Zone name too short.")
        return value

    @field_validator("zone_type")
    @classmethod
    def validate_zone_type(cls, value: Optional[str]):
        return normalize_zone_type(value)

    @model_validator(mode="after")
    def validate_polygon(self):
        coords = self.coordinates

        if len(coords) < MIN_POLYGON_POINTS:
            raise ValueError("Polygon must have at least 4 points.")

        for lon, lat in coords:
            if not (-180 <= lon <= 180):
                raise ValueError("Invalid longitude value.")
            if not (-90 <= lat <= 90):
                raise ValueError("Invalid latitude value.")

        if coords[0] != coords[-1]:
            raise ValueError(
                "Polygon must be closed (first and last point must match)."
            )

        for i in range(1, len(coords)):
            if coords[i] == coords[i - 1]:
                raise ValueError(
                    "Duplicate consecutive polygon points detected."
                )

        return self


# =========================================================
# Update Zone
# =========================================================

class ZoneUpdateRequest(BaseModel):

    name: Optional[str] = Field(None, max_length=MAX_ZONE_NAME_LENGTH)
    zone_type: Optional[str] = Field(None, max_length=MAX_ZONE_TYPE_LENGTH)
    is_active: Optional[bool] = None

    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: Optional[str]):
        if value:
            value = normalize_zone_name(value)
            if len(value) < 3:
                raise ValueError("Zone name too short.")
        return value

    @field_validator("zone_type")
    @classmethod
    def validate_zone_type(cls, value: Optional[str]):
        return normalize_zone_type(value)


# =========================================================
# Zone Response
# =========================================================

class ZoneResponse(BaseModel):

    id: int
    name: str
    zone_type: Optional[str]
    is_active: bool

    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
        frozen=True,
    )


# =========================================================
# Zone Status Response
# =========================================================

class ZoneStatusResponse(BaseModel):

    zone_id: int
    risk_score: float
    risk_level: RiskLevel
    model_version: Optional[str]
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
        frozen=True,
    )

    @field_validator("risk_score")
    @classmethod
    def validate_score(cls, value: float):
        if not (0 <= value <= 1):
            raise ValueError("risk_score must be between 0 and 1.")
        return round(value, 4)

    @model_validator(mode="after")
    def validate_alignment(self):
        if self.risk_level.name == "LOW" and self.risk_score >= RISK_LOW_THRESHOLD:
            raise ValueError("LOW risk must have score < 0.4")

        if self.risk_level.name == "MEDIUM" and not (
            RISK_LOW_THRESHOLD <= self.risk_score < RISK_MEDIUM_THRESHOLD
        ):
            raise ValueError("MEDIUM risk must be between 0.4 and 0.7")

        if self.risk_level.name == "HIGH" and self.risk_score < RISK_MEDIUM_THRESHOLD:
            raise ValueError("HIGH risk must be >= 0.7")

        return self


# =========================================================
# Zone With Status (Dashboard View)
# =========================================================

class ZoneWithStatusResponse(BaseModel):

    id: int
    name: str
    zone_type: Optional[str]
    is_active: bool

    risk_score: Optional[float]
    risk_level: Optional[RiskLevel]
    status_updated_at: Optional[datetime]

    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
        frozen=True,
    )


# =========================================================
# Zone Risk History Response
# =========================================================

class ZoneRiskHistoryResponse(BaseModel):

    zone_id: int
    risk_score: float
    risk_level: RiskLevel
    model_version: Optional[str]
    recorded_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
        frozen=True,
    )

    @field_validator("risk_score")
    @classmethod
    def validate_score(cls, value: float):
        if not (0 <= value <= 1):
            raise ValueError("risk_score must be between 0 and 1.")
        return round(value, 4)

    @model_validator(mode="after")
    def validate_alignment(self):
        if self.risk_level.name == "LOW" and self.risk_score >= RISK_LOW_THRESHOLD:
            raise ValueError("LOW risk must have score < 0.4")

        if self.risk_level.name == "MEDIUM" and not (
            RISK_LOW_THRESHOLD <= self.risk_score < RISK_MEDIUM_THRESHOLD
        ):
            raise ValueError("MEDIUM risk must be between 0.4 and 0.7")

        if self.risk_level.name == "HIGH" and self.risk_score < RISK_MEDIUM_THRESHOLD:
            raise ValueError("HIGH risk must be >= 0.7")

        return self