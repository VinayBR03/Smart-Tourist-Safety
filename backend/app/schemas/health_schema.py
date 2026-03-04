# app/schemas/health_schema.py

from datetime import datetime, timezone
from typing import Optional

from pydantic import (
    BaseModel,
    Field,
    ConfigDict,
    field_validator,
    model_validator,
)


# =========================================================
# Constants (Aligned with DB constraints)
# =========================================================

MIN_HEART_RATE = 20
MAX_HEART_RATE = 250

MIN_SPO2 = 50
MAX_SPO2 = 100

MIN_BODY_TEMP = 30
MAX_BODY_TEMP = 45

MAX_TIMESTAMP_DRIFT_MINUTES = 5


# =========================================================
# Health Telemetry Ingestion
# =========================================================

class HealthTelemetryRequest(BaseModel):
    """
    Sent by wristband devices.
    """

    heart_rate: Optional[float] = Field(None)
    spo2: Optional[float] = Field(None)
    body_temperature: Optional[float] = Field(None)

    is_alert: bool = False
    alert_type: Optional[str] = Field(None, max_length=50)

    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)

    recorded_at: Optional[datetime] = None

    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    # -----------------------------------------------------
    # At least one metric required (matches DB constraint)
    # -----------------------------------------------------

    @model_validator(mode="after")
    def validate_metrics_present(self):
        if not any([
            self.heart_rate is not None,
            self.spo2 is not None,
            self.body_temperature is not None,
        ]):
            raise ValueError("At least one health metric must be provided.")
        return self

    # -----------------------------------------------------
    # Heart rate realistic bounds
    # -----------------------------------------------------

    @field_validator("heart_rate")
    @classmethod
    def validate_heart_rate(cls, value: Optional[float]):
        if value is None:
            return value
        if not (MIN_HEART_RATE <= value <= MAX_HEART_RATE):
            raise ValueError("Heart rate outside realistic physiological range.")
        return round(value, 2)

    # -----------------------------------------------------
    # SPO2 realistic bounds
    # -----------------------------------------------------

    @field_validator("spo2")
    @classmethod
    def validate_spo2(cls, value: Optional[float]):
        if value is None:
            return value
        if not (MIN_SPO2 <= value <= MAX_SPO2):
            raise ValueError("SpO2 outside realistic range.")
        return round(value, 2)

    # -----------------------------------------------------
    # Temperature realistic bounds
    # -----------------------------------------------------

    @field_validator("body_temperature")
    @classmethod
    def validate_temperature(cls, value: Optional[float]):
        if value is None:
            return value
        if not (MIN_BODY_TEMP <= value <= MAX_BODY_TEMP):
            raise ValueError("Body temperature outside realistic range.")
        return round(value, 2)

    # -----------------------------------------------------
    # Normalize GPS precision
    # -----------------------------------------------------

    @field_validator("latitude", "longitude")
    @classmethod
    def normalize_coordinates(cls, value: Optional[float]):
        if value is not None:
            return round(value, 7)
        return value

    # -----------------------------------------------------
    # Timestamp drift protection
    # -----------------------------------------------------

    @field_validator("recorded_at")
    @classmethod
    def validate_timestamp(cls, value: Optional[datetime]):
        if value is None:
            return value

        now = datetime.now(timezone.utc)
        drift = abs((now - value).total_seconds()) / 60

        if drift > MAX_TIMESTAMP_DRIFT_MINUTES:
            raise ValueError("recorded_at drift exceeds allowed limit.")

        return value

    # -----------------------------------------------------
    # Alert consistency rule
    # -----------------------------------------------------

    @model_validator(mode="after")
    def validate_alert_consistency(self):
        if self.is_alert and not self.alert_type:
            raise ValueError("alert_type must be provided when is_alert=True.")
        return self


# =========================================================
# Health Telemetry Response
# =========================================================

class HealthTelemetryResponse(BaseModel):
    id: int
    tourist_id: int
    device_id: Optional[str]

    heart_rate: Optional[float]
    spo2: Optional[float]
    body_temperature: Optional[float]

    is_alert: bool
    alert_type: Optional[str]

    recorded_at: datetime
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
        frozen=True,
    )


# =========================================================
# Health Alert Summary (Authority Dashboard)
# =========================================================

class HealthAlertSummary(BaseModel):
    tourist_id: int
    alert_type: str
    recorded_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
        frozen=True,
    )