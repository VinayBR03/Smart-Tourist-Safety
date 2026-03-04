from typing import Dict, Any

from models.health.selector import HealthModelType
from model_registry import model_registry


class HealthPredictor:
    """
    Production Health Risk Inference Layer

    Responsibilities:
    - Fetch loaded model from ModelRegistry
    - Validate input schema
    - Delegate prediction to model
    """

    REQUIRED_FEATURES = {
        "heart_rate",
        "spo2",
        "temperature",
        "movement_variance",
        "previous_health_score",
    }

    # =========================================================
    # Public Prediction
    # =========================================================

    def predict(self, features: Dict[str, Any]) -> Dict[str, Any]:

        if not isinstance(features, dict):
            raise ValueError("Features must be a dictionary")

        self._validate_features(features)

        model: HealthModelType | None = model_registry.get_health_model()

        if model is None:
            raise RuntimeError("Health model not loaded")

        return model.predict(features)

    # =========================================================
    # Validation
    # =========================================================

    def _validate_features(self, features: Dict[str, Any]) -> None:

        missing = self.REQUIRED_FEATURES - features.keys()

        if missing:
            raise ValueError(f"Missing required health features: {missing}")

        for key in self.REQUIRED_FEATURES:
            try:
                float(features[key])
            except (TypeError, ValueError):
                raise ValueError(f"Invalid numeric value for feature: {key}")