from typing import Dict, Any, cast
from pathlib import Path

import numpy as np
from numpy.typing import NDArray

from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score, f1_score
from sklearn.ensemble import IsolationForest

from models.crowd.isolation_forest_model import IsolationForestCrowdModel

from config import ARTIFACTS_DIR, CROWD_ARTIFACT


# =========================================================
# Crowd Trainer
# =========================================================

class CrowdTrainer:
    """
    Enterprise Crowd Trainer

    - Trains IsolationForest batch model
    - Optional supervised evaluation
    - Drift scoring
    - Online model is runtime-only (not persisted)
    """

    def __init__(self) -> None:
        self.crowd_dir: Path = ARTIFACTS_DIR / CROWD_ARTIFACT.name
        self.crowd_dir.mkdir(parents=True, exist_ok=True)

    # =========================================================
    # Public Training Entry
    # =========================================================

    def train(
        self,
        X: NDArray[np.float64],
        y: NDArray[np.int64] | None = None,
    ) -> None:

        if len(X) < 100:
            raise ValueError("Insufficient crowd training samples")

        if y is not None and len(y) != len(X):
            raise ValueError("X and y must have equal length")

        X_train, X_val, y_train, y_val = self._split_data(X, y)

        self._train_batch_model(
            IsolationForestCrowdModel(),
            X_train,
            X_val,
            y_val,
        )

    # =========================================================
    # Train Isolation Forest
    # =========================================================

    def _train_batch_model(
        self,
        model:   IsolationForestCrowdModel,
        X_train: NDArray[np.float64],
        X_val:   NDArray[np.float64],
        y_val:   NDArray[np.int64] | None,
    ) -> None:

        model.train(X_train)

        metrics: Dict[str, Any] = {}

        if y_val is not None and len(np.unique(y_val)) > 1:
            metrics = self._evaluate(model, X_val, y_val)

        drift: float = self._compute_drift(X_train, X_val)

        model.metadata.update(metrics)
        model.metadata.update({
            "dataset_size": int(len(X_train) + len(X_val)),
            "drift_score":  round(drift, 6),
        })

        model.save(
            self.crowd_dir / CROWD_ARTIFACT.small_model_filename,
            self.crowd_dir / CROWD_ARTIFACT.small_metadata_filename,  # from config
        )

    # =========================================================
    # Evaluation (Optional Supervised)
    # =========================================================

    def _evaluate(
        self,
        model: IsolationForestCrowdModel,
        X_val: NDArray[np.float64],
        y_val: NDArray[np.int64],
    ) -> Dict[str, float]:

        if model.model is None:
            raise RuntimeError("Model not trained")

        sklearn_model = cast(IsolationForest, model.model)

        raw_scores: NDArray[np.float64] = sklearn_model.decision_function(X_val)
        anomaly_scores: NDArray[np.float64] = np.clip(-raw_scores, 0.0, 1.0)
        preds: NDArray[np.int64] = (anomaly_scores >= 0.5).astype(np.int64)

        auc: float = float(roc_auc_score(y_val, anomaly_scores))
        f1:  float = float(f1_score(y_val, preds))

        return {
            "validation_auc": round(auc, 6),
            "validation_f1":  round(f1,  6),
        }

    # =========================================================
    # Data Split
    # =========================================================

    def _split_data(
        self,
        X: NDArray[np.float64],
        y: NDArray[np.int64] | None,
    ) -> tuple[
        NDArray[np.float64],
        NDArray[np.float64],
        NDArray[np.int64] | None,
        NDArray[np.int64] | None,
    ]:

        if y is None:
            X_train, X_val = train_test_split(
                X, test_size=0.2, random_state=42,
            )
            return X_train, X_val, None, None

        X_train, X_val, y_train, y_val = train_test_split(
            X, y,
            test_size=0.2,
            random_state=42,
            stratify=y if len(np.unique(y)) > 1 else None,
        )

        return X_train, X_val, y_train, y_val

    # =========================================================
    # Drift Detection
    # =========================================================

    def _compute_drift(
        self,
        X_train: NDArray[np.float64],
        X_val:   NDArray[np.float64],
    ) -> float:

        train_mean: NDArray[np.float64] = np.mean(X_train, axis=0)
        val_mean:   NDArray[np.float64] = np.mean(X_val,   axis=0)

        diff:  NDArray[np.float64] = np.abs(train_mean - val_mean)
        drift: float               = float(np.mean(diff))

        return min(1.0, drift)