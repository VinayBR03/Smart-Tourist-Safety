from typing import Dict, Any, Literal

from pydantic import BaseModel, Field


# =========================================================
# Prediction Request
# =========================================================

class PredictionRequest(BaseModel):
    """
    Unified prediction request schema.
    """

    domain: Literal["zone", "health", "crowd"]
    features: Dict[str, Any] = Field(
        ...,
        description="Feature dictionary required for selected domain",
    )


# =========================================================
# Prediction Success Response
# =========================================================

class PredictionSuccessResponse(BaseModel):
    status: Literal["success"]
    domain: Literal["zone", "health", "crowd"]
    prediction: Dict[str, Any]


# =========================================================
# Prediction Error Response
# =========================================================

class PredictionErrorResponse(BaseModel):
    status: Literal["error"]
    domain: str
    message: str


# =========================================================
# Health Check Response
# =========================================================

class HealthCheckResponse(BaseModel):
    status: Literal["ok"]
    supported_domains: list[str]