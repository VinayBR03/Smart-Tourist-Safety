from typing import Dict, Any, Optional

import numpy as np
from numpy.typing import NDArray
import requests

from celery import shared_task  # pyright: ignore[reportMissingImports]

from training.zone_trainer import ZoneTrainer
from training.health_trainer import HealthTrainer
from training.crowd_trainer import CrowdTrainer

from monitoring.retraining_scheduler import RetrainingScheduler
from model_registry import model_registry
from core.settings import settings


# =========================================================
# Shared Scheduler
#
# NOTE: _scheduler state (last_retrain_time) is in-memory
# and is NOT shared across Celery worker processes.
# If you run multiple workers, cooldown enforcement is
# per-worker only. For true cross-worker cooldown, store
# last_retrain_time in Redis using the key:
#   "ml:cooldown:{model_name}"
# and check/set it via the Redis client.
# =========================================================

_scheduler = RetrainingScheduler()


# =========================================================
# Data Fetch Helpers
#
# The AI engine is a separate service and must NOT import
# from the backend's database or services directly.
# Data is fetched via HTTP from the backend's internal
# dataset endpoints using the shared internal token.
# =========================================================

BACKEND_URL = settings.BACKEND_URL  # e.g. "http://backend:8000"

_headers = {"Authorization": f"Bearer {settings.INTERNAL_TOKEN}"}


def _fetch_zone_data() -> Optional[Dict[str, Any]]:
    try:
        resp = requests.get(
            f"{BACKEND_URL}/internal/datasets/zone",
            headers=_headers,
            timeout=30,
        )
        if resp.status_code == 204:
            return None
        resp.raise_for_status()
        return resp.json()
    except Exception:
        return None


def _fetch_health_data() -> Optional[Dict[str, Any]]:
    try:
        resp = requests.get(
            f"{BACKEND_URL}/internal/datasets/health",
            headers=_headers,
            timeout=30,
        )
        if resp.status_code == 204:
            return None
        resp.raise_for_status()
        return resp.json()
    except Exception:
        return None


def _fetch_crowd_data() -> Optional[Dict[str, Any]]:
    try:
        resp = requests.get(
            f"{BACKEND_URL}/internal/datasets/crowd",
            headers=_headers,
            timeout=30,
        )
        if resp.status_code == 204:
            return None
        resp.raise_for_status()
        return resp.json()
    except Exception:
        return None


# =========================================================
# ZONE RETRAINING TASK
# =========================================================

@shared_task(
    bind=True,
    name="ml.zone.retraining",
    max_retries=3,
    default_retry_delay=60,
)
def zone_retraining_task(self) -> Dict[str, Any]:
    try:
        dataset = _fetch_zone_data()

        if dataset is None:
            return {"status": "no_data"}

        X: NDArray[np.float64] = np.asarray(dataset["X"], dtype=np.float64)
        y: NDArray[np.int64]   = np.asarray(dataset["y"], dtype=np.int64)

        if len(X) < 100:
            return {"status": "insufficient_data"}

        model = model_registry.get_zone_model()

        if model is not None:
            decision = _scheduler.should_retrain(
                model_name="zone",
                live_batch=X,
                model_metadata=model.metadata,
                current_dataset_size=len(X),
            )

            if not decision["retrain"]:
                return {
                    "status":      "skipped",
                    "reason":      decision.get("reason"),
                    "drift_score": decision.get("drift_score"),
                }

        trainer = ZoneTrainer()
        trainer.train(
            incident_counts = np.asarray(dataset["incident_counts"], dtype=np.float64),
            sos_counts      = np.asarray(dataset["sos_counts"],      dtype=np.float64),
            event_counts    = np.asarray(dataset["event_counts"],    dtype=np.float64),
            previous_scores = np.asarray(dataset["previous_scores"], dtype=np.float64),
            window_minutes  = np.asarray(dataset["window_minutes"],  dtype=np.float64),
            labels          = y,
        )

        model_registry.reload_all()
        return {"status": "retrained"}

    except Exception as e:
        raise self.retry(exc=e)


# =========================================================
# HEALTH RETRAINING TASK
# =========================================================

@shared_task(
    bind=True,
    name="ml.health.retraining",
    max_retries=3,
    default_retry_delay=60,
)
def health_retraining_task(self) -> Dict[str, Any]:
    try:
        dataset = _fetch_health_data()

        if dataset is None:
            return {"status": "no_data"}

        X: NDArray[np.float64] = np.asarray(dataset["X"], dtype=np.float64)
        y: NDArray[np.int64]   = np.asarray(dataset["y"], dtype=np.int64)

        if len(X) < 200:
            return {"status": "insufficient_data"}

        model = model_registry.get_health_model()

        if model is not None:
            decision = _scheduler.should_retrain(
                model_name="health",
                live_batch=X,
                model_metadata=model.metadata,
                current_dataset_size=len(X),
            )

            if not decision["retrain"]:
                return {
                    "status":      "skipped",
                    "reason":      decision.get("reason"),
                    "drift_score": decision.get("drift_score"),
                }

        trainer = HealthTrainer()
        trainer.train(
            heart_rate            = np.asarray(dataset["heart_rate"],            dtype=np.float64),
            spo2                  = np.asarray(dataset["spo2"],                  dtype=np.float64),
            temperature           = np.asarray(dataset["temperature"],           dtype=np.float64),
            movement_variance     = np.asarray(dataset["movement_variance"],     dtype=np.float64),
            previous_health_score = np.asarray(dataset["previous_health_score"], dtype=np.float64),
            labels                = y,
        )

        model_registry.reload_all()
        return {"status": "retrained"}

    except Exception as e:
        raise self.retry(exc=e)


# =========================================================
# CROWD RETRAINING TASK
# =========================================================

@shared_task(
    bind=True,
    name="ml.crowd.retraining",
    max_retries=3,
    default_retry_delay=60,
)
def crowd_retraining_task(self) -> Dict[str, Any]:
    try:
        dataset = _fetch_crowd_data()

        if dataset is None:
            return {"status": "no_data"}

        X: NDArray[np.float64]          = np.asarray(dataset["X"], dtype=np.float64)
        y: Optional[NDArray[np.int64]]  = (
            np.asarray(dataset["y"], dtype=np.int64)
            if "y" in dataset
            else None
        )

        if len(X) < 100:
            return {"status": "insufficient_data"}

        model = model_registry.get_crowd_model()

        if model is not None:
            decision = _scheduler.should_retrain(
                model_name="crowd",
                live_batch=X,
                model_metadata=model.metadata,
                current_dataset_size=len(X),
            )

            if not decision["retrain"]:
                return {
                    "status":      "skipped",
                    "reason":      decision.get("reason"),
                    "drift_score": decision.get("drift_score"),
                }

        trainer = CrowdTrainer()
        trainer.train(X=X, y=y)

        model_registry.reload_all()
        return {"status": "retrained"}

    except Exception as e:
        raise self.retry(exc=e)