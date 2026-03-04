from typing import Dict, Any, Optional

from celery import shared_task  # pyright: ignore[reportMissingImports]
from sqlalchemy.orm import Session  # pyright: ignore[reportMissingImports]

import numpy as np
from numpy.typing import NDArray

from backend.app.core.database import SessionLocal  # pyright: ignore[reportMissingImports]
from backend.app.services.dataset_service import (  # pyright: ignore[reportMissingImports]
    load_zone_training_data,
    load_health_training_data,
    load_crowd_training_data,
)

from training.zone_trainer import ZoneTrainer
from training.health_trainer import HealthTrainer
from training.crowd_trainer import CrowdTrainer

from monitoring.retraining_scheduler import RetrainingScheduler
from model_registry import model_registry


# =========================================================
# Shared Scheduler (Preserve Cooldown State)
# =========================================================

_scheduler = RetrainingScheduler()


# =========================================================
# ZONE RETRAINING TASK
# =========================================================

@shared_task(bind=True, name="ml.zone.retraining", max_retries=3, default_retry_delay=60)
def zone_retraining_task(self) -> Dict[str, Any]:

    db: Session = SessionLocal()

    try:
        dataset = load_zone_training_data(db)
        if dataset is None:
            return {"status": "no_data"}

        X: NDArray[np.float64] = dataset["X"]
        y: NDArray[np.int64] = dataset["y"]

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
                    "status": "skipped",
                    "reason": decision.get("reason"),
                    "drift_score": decision.get("drift_score"),
                }

        trainer = ZoneTrainer()
        trainer.train(
            incident_counts=dataset["incident_counts"],
            sos_counts=dataset["sos_counts"],
            event_counts=dataset["event_counts"],
            previous_scores=dataset["previous_scores"],
            window_minutes=dataset["window_minutes"],
            labels=y,
        )

        model_registry.reload_all()
        return {"status": "retrained"}

    except Exception as e:
        raise self.retry(exc=e)

    finally:
        db.close()


# =========================================================
# HEALTH RETRAINING TASK
# =========================================================

@shared_task(bind=True, name="ml.health.retraining", max_retries=3, default_retry_delay=60)
def health_retraining_task(self) -> Dict[str, Any]:

    db: Session = SessionLocal()

    try:
        dataset = load_health_training_data(db)
        if dataset is None:
            return {"status": "no_data"}

        X: NDArray[np.float64] = dataset["X"]
        y: NDArray[np.int64] = dataset["y"]

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
                    "status": "skipped",
                    "reason": decision.get("reason"),
                    "drift_score": decision.get("drift_score"),
                }

        trainer = HealthTrainer()
        trainer.train(
            heart_rate=dataset["heart_rate"],
            spo2=dataset["spo2"],
            temperature=dataset["temperature"],
            motion_level=dataset["motion_level"],
            labels=y,
        )

        model_registry.reload_all()
        return {"status": "retrained"}

    except Exception as e:
        raise self.retry(exc=e)

    finally:
        db.close()


# =========================================================
# CROWD RETRAINING TASK
# =========================================================

@shared_task(bind=True, name="ml.crowd.retraining", max_retries=3, default_retry_delay=60)
def crowd_retraining_task(self) -> Dict[str, Any]:

    db: Session = SessionLocal()

    try:
        dataset = load_crowd_training_data(db)
        if dataset is None:
            return {"status": "no_data"}

        X: NDArray[np.float64] = dataset["X"]
        y: Optional[NDArray[np.int64]] = dataset.get("y")

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
                    "status": "skipped",
                    "reason": decision.get("reason"),
                    "drift_score": decision.get("drift_score"),
                }

        trainer = CrowdTrainer()
        trainer.train(X=X, y=y)

        model_registry.reload_all()
        return {"status": "retrained"}

    except Exception as e:
        raise self.retry(exc=e)

    finally:
        db.close()