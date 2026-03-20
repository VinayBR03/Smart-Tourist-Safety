from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from api.schemas import (
    PredictionRequest,
    PredictionSuccessResponse,
    PredictionErrorResponse,
    HealthCheckResponse,
)

from inference.engine import ai_engine
from core.settings import settings


router  = APIRouter()
_bearer = HTTPBearer(auto_error=True)


# =========================================================
# Internal Token Auth
# The AI engine is an internal service — only the FastAPI
# backend should be able to call /predict.
# Pass the token as:  Authorization: Bearer <AI_ENGINE_INTERNAL_TOKEN>
# =========================================================

def verify_internal_token(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> None:
    if credentials.credentials != settings.INTERNAL_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid internal token",
        )


# =========================================================
# Prediction Endpoint
# =========================================================

@router.post(
    "/predict",
    response_model=PredictionSuccessResponse | PredictionErrorResponse,
    dependencies=[Depends(verify_internal_token)],
)
def predict(request: PredictionRequest):
    result = ai_engine.predict(
        domain=request.domain,
        features=request.features,
    )
    return result


# =========================================================
# Health Check — public, no auth needed
# Used by Docker HEALTHCHECK and orchestrators.
# =========================================================

@router.get(
    "/health",
    response_model=HealthCheckResponse,
)
def health_check():
    return ai_engine.health_check()


# =========================================================
# Model Status — internal, token required
# =========================================================

@router.get(
    "/models/status",
    dependencies=[Depends(verify_internal_token)],
)
def model_status():
    from model_registry import model_registry
    return model_registry.detailed_status()


# =========================================================
# Hot Reload — internal, token required
# Triggers model_registry.reload_all() without restart.
# =========================================================

@router.post(
    "/models/reload",
    dependencies=[Depends(verify_internal_token)],
)
def reload_models():
    from model_registry import model_registry
    model_registry.reload_all()
    return {"status": "reloaded", "models": model_registry.status()}