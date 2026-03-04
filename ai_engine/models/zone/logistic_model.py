from typing import Dict, Any, List

import numpy as np
from numpy.typing import NDArray

from sklearn.linear_model import LogisticRegression

from models.base_model import SupervisedModel
from config import ZONE_HIGH_RISK_PROB_THRESHOLD


class LogisticZoneModel(SupervisedModel[LogisticRegression]):
    """
    Zone Risk Model (Small Dataset)
    Logistic Regression Implementation.
    """

    MODEL_VERSION: str = "zone_logistic_v1"

    def __init__(self) -> None:
        super().__init__(model_name="zone_logistic")

        self.feature_order: List[str] = [
            "incident_count",
            "sos_count",
            "event_count",
            "previous_risk_score",
            "window_minutes",
        ]

        self.metadata = {
            "model_type": "logistic_regression",
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

        model = LogisticRegression(
            class_weight="balanced",
            max_iter=500,
            solver="lbfgs",
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

        probs: NDArray[np.float64] = self.model.predict_proba(vector)

        if probs.ndim != 2 or probs.shape[1] < 2:
            raise RuntimeError("Invalid probability output from model")

        probability: float = float(probs[0][1])

        risk_level: str = self._map_risk_level(probability)

        return {
            "risk_score": round(probability, 6),
            "risk_level": risk_level,
            "model_version": self.metadata.get("model_version", self.MODEL_VERSION),
            "model_type": "logistic",
        }

    # =========================================================
    # Internal Helpers
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

    def _map_risk_level(self, probability: float) -> str:

        if probability >= ZONE_HIGH_RISK_PROB_THRESHOLD:
            return "HIGH"
        elif probability >= 0.4:
            return "MEDIUM"
        else:
            return "LOW"