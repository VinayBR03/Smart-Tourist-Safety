from typing import Dict, Any

from models.zone.selector import ZoneModelType
from model_registry import model_registry


class ZonePredictor:
    """
    Production Inference Layer for Zone Risk.

    Responsibilities:
    - Fetch loaded model from ModelRegistry
    - Validate input schema
    - Delegate prediction to model
    """

    REQUIRED_FEATURES = {
        "incident_count",
        "sos_count",
        "event_count",
        "previous_risk_score",
        "window_minutes",
    }

    # =========================================================
    # Public Prediction
    # =========================================================

    def predict(self, features: Dict[str, Any]) -> Dict[str, Any]:

        if not isinstance(features, dict):
            raise ValueError("Features must be a dictionary")

        self._validate_features(features)

        model: ZoneModelType | None = model_registry.get_zone_model()

        if model is None:
            raise RuntimeError("Zone model not loaded")

        return model.predict(features)

    # =========================================================
    # Feature Validation
    # =========================================================

    def _validate_features(self, features: Dict[str, Any]) -> None:

        missing = self.REQUIRED_FEATURES - features.keys()

        if missing:
            raise ValueError(f"Missing required features: {missing}")

        for key in self.REQUIRED_FEATURES:
            try:
                float(features[key])
            except (TypeError, ValueError):
                raise ValueError(f"Invalid numeric value for feature: {key}")