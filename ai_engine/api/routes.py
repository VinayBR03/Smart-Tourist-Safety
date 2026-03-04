from fastapi import APIRouter

from api.schemas import (
    PredictionRequest,
    PredictionSuccessResponse,
    PredictionErrorResponse,
    HealthCheckResponse,
)

from inference.engine import ai_engine


router = APIRouter()


# =========================================================
# Prediction Endpoint
# =========================================================

@router.post(
    "/predict",
    response_model=PredictionSuccessResponse | PredictionErrorResponse,
)
def predict(request: PredictionRequest):

    result = ai_engine.predict(
        domain=request.domain,
        features=request.features,
    )

    return result


# =========================================================
# Health Check Endpoint
# =========================================================

@router.get(
    "/health",
    response_model=HealthCheckResponse,
)
def health_check():

    return ai_engine.health_check()