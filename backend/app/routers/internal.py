# app/routers/internal.py
#
# Internal-only endpoints consumed by the AI engine service.
# Protected by INTERNAL_SERVICE_TOKEN — never expose publicly.

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.config import settings
from app.services.dataset_service import (
    load_zone_training_data,
    load_health_training_data,
    load_crowd_training_data,
)
from app.utils.logger import get_logger

logger = get_logger(__name__)

router  = APIRouter(prefix="/internal", tags=["Internal"])
_bearer = HTTPBearer(auto_error=True)


# =========================================================
# Auth
# =========================================================

def verify_internal_token(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> None:
    if credentials.credentials != settings.INTERNAL_SERVICE_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid internal token",
        )


# =========================================================
# Zone Dataset
# GET /internal/datasets/zone
# =========================================================

@router.get(
    "/datasets/zone",
    dependencies=[Depends(verify_internal_token)],
)
def get_zone_dataset(
    window_minutes: int = 60,
    db: Session = Depends(get_db),
):
    dataset = load_zone_training_data(db, window_minutes=window_minutes)

    if dataset is None:
        raise HTTPException(status_code=status.HTTP_204_NO_CONTENT)

    # Convert numpy arrays to lists for JSON serialisation
    return {
        "X":               dataset["X"].tolist(),
        "y":               dataset["y"].tolist(),
        "incident_counts": dataset["incident_counts"].tolist(),
        "sos_counts":      dataset["sos_counts"].tolist(),
        "event_counts":    dataset["event_counts"].tolist(),
        "previous_scores": dataset["previous_scores"].tolist(),
        "window_minutes":  dataset["window_minutes"].tolist(),
    }


# =========================================================
# Health Dataset
# GET /internal/datasets/health
# =========================================================

@router.get(
    "/datasets/health",
    dependencies=[Depends(verify_internal_token)],
)
def get_health_dataset(
    window_minutes: int = 30,
    db: Session = Depends(get_db),
):
    dataset = load_health_training_data(db, window_minutes=window_minutes)

    if dataset is None:
        raise HTTPException(status_code=status.HTTP_204_NO_CONTENT)

    return {
        "X":                     dataset["X"].tolist(),
        "y":                     dataset["y"].tolist(),
        "heart_rate":            dataset["heart_rate"].tolist(),
        "spo2":                  dataset["spo2"].tolist(),
        "temperature":           dataset["temperature"].tolist(),
        "movement_variance":     dataset["movement_variance"].tolist(),
        "previous_health_score": dataset["previous_health_score"].tolist(),
    }


# =========================================================
# Crowd Dataset
# GET /internal/datasets/crowd
# =========================================================

@router.get(
    "/datasets/crowd",
    dependencies=[Depends(verify_internal_token)],
)
def get_crowd_dataset(
    window_minutes: int = 30,
    db: Session = Depends(get_db),
):
    dataset = load_crowd_training_data(db, window_minutes=window_minutes)

    if dataset is None:
        raise HTTPException(status_code=status.HTTP_204_NO_CONTENT)

    payload = {
        "X": dataset["X"].tolist(),
    }

    if "y" in dataset:
        payload["y"] = dataset["y"].tolist()

    return payload