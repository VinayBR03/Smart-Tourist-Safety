from typing import Dict, Any, List, cast

import numpy as np
from numpy.typing import NDArray

from xgboost import XGBClassifier

from models.base_model import SupervisedModel
from config import ZONE_HIGH_RISK_PROB_THRESHOLD


class XGBoostZoneModel(SupervisedModel[XGBClassifier]):
    """
    Zone Risk Model (Large Dataset)
    XGBoost Implementation.
    """

    MODEL_VERSION: str = "zone_xgboost_v1"

    def __init__(self) -> None:
        super().__init__(model_name="zone_xgboost")

        self.feature_order: List[str] = [
            "incident_count",
            "sos_count",
            "event_count",
            "previous_risk_score",
            "window_minutes",
        ]

        self.metadata = {
            "model_type": "xgboost",
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

        positive: int = int(np.sum(y))
        negative: int = int(len(y) - positive)

        scale_pos_weight: float = 1.0
        if positive > 0:
            scale_pos_weight = float(negative / positive)

        model = XGBClassifier(
            n_estimators=200,
            max_depth=5,
            learning_rate=0.05,
            subsample=0.8,
            colsample_bytree=0.8,
            objective="binary:logistic",
            eval_metric="logloss",
            scale_pos_weight=scale_pos_weight,
            random_state=42,
        )

        model.fit(X, y)

        self.model = model

        self.metadata.update({
            "dataset_size": int(len(X)),
            "scale_pos_weight": scale_pos_weight,
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

        risk_level: str = self._map_risk_level(probability)

        return {
            "risk_score": round(probability, 6),
            "risk_level": risk_level,
            "model_version": self.metadata.get("model_version", self.MODEL_VERSION),
            "model_type": "xgboost",
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

    def _map_risk_level(self, probability: float) -> str:

        if probability >= ZONE_HIGH_RISK_PROB_THRESHOLD:
            return "HIGH"
        elif probability >= 0.4:
            return "MEDIUM"
        else:
            return "LOW"