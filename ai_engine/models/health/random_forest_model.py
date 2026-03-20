from typing import Dict, Any, List, cast

import numpy as np
from numpy.typing import NDArray

from sklearn.ensemble import RandomForestClassifier

from models.base_model import SupervisedModel
from config import HEALTH_ANOMALY_THRESHOLD


class RandomForestHealthModel(SupervisedModel[RandomForestClassifier]):
    """
    Enterprise Health Anomaly Model (Small / Medium Dataset)

    - Supervised binary classifier
    - Balanced class handling
    - Deterministic inference
    - Strict feature validation
    """

    MODEL_VERSION: str = "health_rf_v1"

    def __init__(self) -> None:
        super().__init__(model_name="health_random_forest")

        # Strictly physiological features — matches LSTMHealthModel
        # and HealthPredictor.REQUIRED_FEATURES exactly.
        self.feature_order: List[str] = [
            "heart_rate",
            "spo2",
            "temperature",
            "movement_variance",
            "previous_health_score",
        ]

        self.metadata = {
            "model_type":    "random_forest",
            "model_version": self.MODEL_VERSION,
            "feature_order": self.feature_order,
        }

    # =========================================================
    # Training
    # =========================================================

    def train(
        self,
        X: NDArray[np.float64],
        y: NDArray[np.int64],
    ) -> None:

        if X is None or y is None:
            raise ValueError("X and y are required for supervised training")

        if len(X) == 0:
            raise ValueError("Training dataset cannot be empty")

        if len(X) != len(y):
            raise ValueError("X and y length mismatch")

        model = RandomForestClassifier(
            n_estimators=300,
            max_depth=10,
            min_samples_split=5,
            min_samples_leaf=2,
            class_weight="balanced",
            random_state=42,
            n_jobs=-1,
        )

        model.fit(X, y)

        self.model = model

        self.metadata.update({
            "dataset_size": int(len(X)),
        })

    # =========================================================
    # Prediction
    # =========================================================

    def predict(self, features: Dict[str, Any]) -> Dict[str, Any]:

        if self.model is None:
            raise RuntimeError("Model not trained or loaded")

        if not isinstance(features, dict):
            raise ValueError("Features must be a dictionary")

        vector: NDArray[np.float64] = self._dict_to_vector(features)

        raw_probs = self.model.predict_proba(vector)
        probs: NDArray[np.float64] = cast(NDArray[np.float64], raw_probs)

        if probs.ndim != 2 or probs.shape[1] < 2:
            raise RuntimeError("Invalid probability output from model")

        probability: float = float(probs[0][1])
        probability = self._clamp_probability(probability)

        is_anomaly: bool = probability >= HEALTH_ANOMALY_THRESHOLD

        return {
            "anomaly_score": round(probability, 6),
            "is_anomaly":    is_anomaly,
            "model_version": self.metadata.get("model_version", self.MODEL_VERSION),
            "model_type":    "random_forest",
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
    def _clamp_probability(value: float) -> float:
        if value < 0.0:
            return 0.0
        if value > 1.0:
            return 1.0
        return value