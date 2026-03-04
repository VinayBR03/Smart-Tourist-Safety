from typing import Dict, Any, cast
from pathlib import Path

import numpy as np
from numpy.typing import NDArray

from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score, f1_score, brier_score_loss

from sklearn.base import ClassifierMixin

from models.zone.logistic_model import LogisticZoneModel
from models.zone.xgboost_model import XGBoostZoneModel

from data.feature_zone import ZoneFeatureEngineer
from data.preprocessing import DataPreprocessor

from config import ARTIFACTS_DIR, ZONE_ARTIFACT


# =========================================================
# Zone Trainer
# =========================================================

class ZoneTrainer:
    """
    Enterprise Zone Trainer

    - Feature engineering integrated
    - Preprocessing integrated
    - Strict typing
    - Drift scoring
    - Metadata enrichment
    """

    def __init__(self) -> None:
        self.zone_dir: Path = ARTIFACTS_DIR / ZONE_ARTIFACT.name
        self.zone_dir.mkdir(parents=True, exist_ok=True)

        self.feature_engineer = ZoneFeatureEngineer()
        self.preprocessor = DataPreprocessor(
            feature_order=ZoneFeatureEngineer.FEATURE_ORDER
        )

    # =========================================================
    # Public Training Entry
    # =========================================================

    def train(
        self,
        *,
        incident_counts: NDArray[np.float64],
        sos_counts: NDArray[np.float64],
        event_counts: NDArray[np.float64],
        previous_scores: NDArray[np.float64],
        window_minutes: NDArray[np.float64],
        labels: NDArray[np.int64],
    ) -> None:

        # 1️⃣ Feature Engineering
        X_raw: NDArray[np.float64] = self.feature_engineer.build_from_dataframe(
            incident_counts,
            sos_counts,
            event_counts,
            previous_scores,
            window_minutes,
        )

        # 2️⃣ Preprocessing
        X: NDArray[np.float64] = self.preprocessor.transform_batch(X_raw)
        y: NDArray[np.int64] = labels

        if len(X) < 50:
            raise ValueError("Insufficient training data")

        # 3️⃣ Train / Validation Split
        X_train, X_val, y_train, y_val = train_test_split(
            X,
            y,
            test_size=0.2,
            random_state=42,
            stratify=y,
        )

        self._train_and_save(
            LogisticZoneModel(),
            X_train,
            X_val,
            y_train,
            y_val,
            ZONE_ARTIFACT.small_model_filename,
            "zone_logistic_meta.json",
        )

        self._train_and_save(
            XGBoostZoneModel(),
            X_train,
            X_val,
            y_train,
            y_val,
            ZONE_ARTIFACT.large_model_filename,
            "zone_xgboost_meta.json",
        )

    # =========================================================
    # Train + Evaluate + Save
    # =========================================================

    def _train_and_save(
        self,
        model: LogisticZoneModel | XGBoostZoneModel,
        X_train: NDArray[np.float64],
        X_val: NDArray[np.float64],
        y_train: NDArray[np.int64],
        y_val: NDArray[np.int64],
        model_filename: str,
        meta_filename: str,
    ) -> None:

        model.train(X_train, y_train)

        metrics = self._evaluate(
            model,
            X_val,
            y_val,
            X_train,
        )

        model.metadata.update(metrics)

        model.save(
            self.zone_dir / model_filename,
            self.zone_dir / meta_filename,
        )

    # =========================================================
    # Evaluation
    # =========================================================

    def _evaluate(
        self,
        model: LogisticZoneModel | XGBoostZoneModel,
        X_val: NDArray[np.float64],
        y_val: NDArray[np.int64],
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
        preds: NDArray[np.int64] = (probs >= 0.5).astype(np.int64)

        auc: float = float(roc_auc_score(y_val, probs))
        f1: float = float(f1_score(y_val, preds))
        calibration: float = float(brier_score_loss(y_val, probs))
        drift: float = float(self._compute_drift(X_train, X_val))

        return {
            "validation_auc": round(auc, 6),
            "validation_f1": round(f1, 6),
            "calibration_error": round(calibration, 6),
            "drift_score": round(drift, 6),
            "dataset_size": int(len(X_train)),
        }

    # =========================================================
    # Drift Detection
    # =========================================================

    def _compute_drift(
        self,
        X_train: NDArray[np.float64],
        X_val: NDArray[np.float64],
    ) -> float:

        train_mean: NDArray[np.float64] = np.mean(X_train, axis=0)
        val_mean: NDArray[np.float64] = np.mean(X_val, axis=0)

        diff: NDArray[np.float64] = np.abs(train_mean - val_mean)
        drift: float = float(np.mean(diff))

        return min(1.0, drift)