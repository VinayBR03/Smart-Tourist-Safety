from typing import Dict, Any, cast
from pathlib import Path

import numpy as np
from numpy.typing import NDArray

from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score, f1_score, brier_score_loss
from sklearn.base import ClassifierMixin

from models.health.random_forest_model import RandomForestHealthModel

from data.feature_health import HealthFeatureEngineer
from data.preprocessing import DataPreprocessor

from config import ARTIFACTS_DIR, HEALTH_ARTIFACT


# =========================================================
# Health Trainer
# =========================================================

class HealthTrainer:
    """
    Enterprise Health Trainer

    - Integrated feature engineering
    - Strict typing
    - Drift scoring
    - Baseline statistics
    - Trains only RandomForest (LSTM is offline-trained)
    """

    def __init__(self) -> None:
        self.health_dir: Path = ARTIFACTS_DIR / HEALTH_ARTIFACT.name
        self.health_dir.mkdir(parents=True, exist_ok=True)

        self.feature_engineer = HealthFeatureEngineer()
        self.preprocessor     = DataPreprocessor(
            feature_order=HealthFeatureEngineer.FEATURE_ORDER,
        )

    # =========================================================
    # Public Training Entry
    # =========================================================

    def train(
        self,
        *,
        heart_rate:            NDArray[np.float64],
        spo2:                  NDArray[np.float64],
        temperature:           NDArray[np.float64],
        movement_variance:     NDArray[np.float64],   # was "motion_level" — fixed
        previous_health_score: NDArray[np.float64],   # temporal context feature
        labels:                NDArray[np.int64],
    ) -> None:

        sample_size: int = len(labels)

        if sample_size < 200:
            raise ValueError("Insufficient health training samples")

        if not (
            len(heart_rate)            == sample_size
            and len(spo2)              == sample_size
            and len(temperature)       == sample_size
            and len(movement_variance) == sample_size
            and len(previous_health_score) == sample_size
        ):
            raise ValueError("Feature arrays and labels must have equal length")

        if len(np.unique(labels)) < 2:
            raise ValueError("Training requires at least two classes")

        # Feature Engineering
        X_raw: NDArray[np.float64] = self.feature_engineer.build_from_arrays(
            heart_rate=heart_rate,
            spo2=spo2,
            temperature=temperature,
            movement_variance=movement_variance,
            previous_health_score=previous_health_score,
        )

        # Preprocessing
        X: NDArray[np.float64] = self.preprocessor.transform_batch(X_raw)
        y: NDArray[np.int64]   = labels

        X_train, X_val, y_train, y_val = train_test_split(
            X, y,
            test_size=0.2,
            random_state=42,
            stratify=y,
        )

        self._train_and_save(
            RandomForestHealthModel(),
            X_train, X_val, y_train, y_val,
            HEALTH_ARTIFACT.small_model_filename,
            HEALTH_ARTIFACT.small_metadata_filename,   # from config, not hardcoded
        )

    # =========================================================
    # Train + Evaluate + Save
    # =========================================================

    def _train_and_save(
        self,
        model:          RandomForestHealthModel,
        X_train:        NDArray[np.float64],
        X_val:          NDArray[np.float64],
        y_train:        NDArray[np.int64],
        y_val:          NDArray[np.int64],
        model_filename: str,
        meta_filename:  str,
    ) -> None:

        model.train(X_train, y_train)

        metrics = self._evaluate(model, X_val, y_val, X_train)

        model.metadata.update(metrics)
        model.metadata.update(self._baseline_stats(X_train))

        model.save(
            self.health_dir / model_filename,
            self.health_dir / meta_filename,
        )

    # =========================================================
    # Evaluation
    # =========================================================

    def _evaluate(
        self,
        model:   RandomForestHealthModel,
        X_val:   NDArray[np.float64],
        y_val:   NDArray[np.int64],
        X_train: NDArray[np.float64],
    ) -> Dict[str, Any]:

        if model.model is None:
            raise RuntimeError("Model not trained")

        sklearn_model = cast(ClassifierMixin, model.model)

        probs_full: NDArray[np.float64] = cast(
            NDArray[np.float64],
            sklearn_model.predict_proba(X_val),
        )

        if probs_full.ndim != 2 or probs_full.shape[1] < 2:
            raise RuntimeError("Invalid probability output")

        probs: NDArray[np.float64] = probs_full[:, 1]
        preds: NDArray[np.int64]   = (probs >= 0.5).astype(np.int64)

        auc:         float = float(roc_auc_score(y_val, probs))
        f1:          float = float(f1_score(y_val, preds))
        calibration: float = float(brier_score_loss(y_val, probs))
        drift:       float = float(self._compute_split_drift(X_train, X_val))

        return {
            "validation_auc":    round(auc,         6),
            "validation_f1":     round(f1,          6),
            "calibration_error": round(calibration, 6),
            "drift_score":       round(drift,        6),
            "dataset_size":      int(len(X_train)),
        }

    # =========================================================
    # Baseline Statistics
    # =========================================================

    def _baseline_stats(
        self,
        X: NDArray[np.float64],
    ) -> Dict[str, list[float]]:

        mean_arr: NDArray[np.float64] = np.mean(X, axis=0)
        std_arr:  NDArray[np.float64] = np.std(X,  axis=0)

        return {
            "baseline_feature_mean": mean_arr.tolist(),
            "baseline_feature_std":  std_arr.tolist(),
        }

    # =========================================================
    # Drift
    # =========================================================

    def _compute_split_drift(
        self,
        X_train: NDArray[np.float64],
        X_val:   NDArray[np.float64],
    ) -> float:

        train_mean: NDArray[np.float64] = np.mean(X_train, axis=0)
        val_mean:   NDArray[np.float64] = np.mean(X_val,   axis=0)

        diff:  NDArray[np.float64] = np.abs(train_mean - val_mean)
        drift: float               = float(np.mean(diff))

        return min(1.0, drift)