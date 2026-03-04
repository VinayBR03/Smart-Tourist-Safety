from typing import Dict, Any, List, cast

import numpy as np
from numpy.typing import NDArray

from sklearn.ensemble import IsolationForest

from models.base_model import UnsupervisedModel
from config import CROWD_ANOMALY_THRESHOLD


class IsolationForestCrowdModel(UnsupervisedModel[IsolationForest]):
    """
    Enterprise Crowd Anomaly Model (Static / Batch)

    - Unsupervised anomaly detection
    - Deterministic behavior
    - Strict feature validation
    - Controlled anomaly normalization
    - Production-safe scoring
    """

    MODEL_VERSION: str = "crowd_isolation_v1"

    def __init__(self) -> None:
        super().__init__(model_name="crowd_isolation_forest")

        self.feature_order: List[str] = [
            "event_count",
            "unique_devices",
            "avg_dwell_time",
            "movement_entropy",
        ]

    # =========================================================
    # Training
    # =========================================================

    def train(self, X: NDArray[np.float64]) -> None:

        if X is None:
            raise ValueError("X is required for unsupervised training")

        if len(X) == 0:
            raise ValueError("Training dataset cannot be empty")

        model = IsolationForest(
            n_estimators=300,
            contamination=0.05,
            max_samples="auto",
            random_state=42,
            n_jobs=-1,
        )

        model.fit(X)

        self.model = model

        self.metadata = {
            "model_type": "isolation_forest",
            "model_version": self.MODEL_VERSION,
            "dataset_size": int(len(X)),
            "feature_order": self.feature_order,
        }

    # =========================================================
    # Prediction
    # =========================================================

    def predict(self, features: Dict[str, Any]) -> Dict[str, Any]:

        if self.model is None:
            raise RuntimeError("Model not trained or loaded")

        if not isinstance(features, dict):
            raise ValueError("Features must be a dictionary")

        vector: NDArray[np.float64] = self._dict_to_vector(features)

        raw_scores = self.model.decision_function(vector)
        scores: NDArray[np.float64] = cast(NDArray[np.float64], raw_scores)

        if scores.size == 0:
            raise RuntimeError("Model returned invalid anomaly score")

        raw_score: float = float(scores[0])

        anomaly_score: float = self._normalize_score(raw_score)

        is_anomaly: bool = anomaly_score >= CROWD_ANOMALY_THRESHOLD

        return {
            "anomaly_score": round(anomaly_score, 6),
            "is_anomaly": is_anomaly,
            "model_version": self.MODEL_VERSION,
            "model_type": "isolation_forest",
        }

    # =========================================================
    # Helpers
    # =========================================================

    def _dict_to_vector(
        self,
        features: Dict[str, Any],
    ) -> NDArray[np.float64]:

        values: List[float] = []

        for key in self.feature_order:
            raw_value = features.get(key)

            if raw_value is None:
                raise ValueError(f"Missing required feature: {key}")

            try:
                values.append(float(raw_value))
            except (TypeError, ValueError):
                raise ValueError(f"Invalid numeric value for feature: {key}")

        return np.asarray(values, dtype=np.float64).reshape(1, -1)

    @staticmethod
    def _normalize_score(raw_score: float) -> float:
        """
        IsolationForest decision_function:
        - Positive values → normal
        - Negative values → anomaly

        Convert to 0–1 anomaly score.
        """

        score: float = -raw_score  # flip sign

        if score < 0.0:
            return 0.0
        if score > 1.0:
            return 1.0

        return score