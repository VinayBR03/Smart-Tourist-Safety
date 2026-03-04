from typing import Dict, Any

from models.crowd.selector import CrowdModelType
from model_registry import model_registry


class CrowdPredictor:
    """
    Production Crowd Anomaly Inference Layer

    Responsibilities:
    - Fetch loaded model from ModelRegistry
    - Validate minimal input structure
    - Delegate inference to model
    - Return standardized output
    """

    REQUIRED_FEATURES = {
        "event_count",
        "unique_devices",
        "avg_dwell_time",
        "movement_entropy",
    }

    # =========================================================
    # Public Prediction
    # =========================================================

    def predict(self, features: Dict[str, Any]) -> Dict[str, Any]:

        if not isinstance(features, dict):
            raise ValueError("Features must be a dictionary")

        self._validate_features(features)

        model: CrowdModelType | None = model_registry.get_crowd_model()

        if model is None:
            raise RuntimeError("Crowd model not loaded")

        # All crowd models implement predict(dict)
        result = model.predict(features)

        return result

    # =========================================================
    # Validation
    # =========================================================

    def _validate_features(self, features: Dict[str, Any]) -> None:

        missing = self.REQUIRED_FEATURES - features.keys()

        if missing:
            raise ValueError(f"Missing required crowd features: {missing}")

        for key in self.REQUIRED_FEATURES:
            try:
                float(features[key])
            except (TypeError, ValueError):
                raise ValueError(f"Invalid numeric value for feature: {key}")