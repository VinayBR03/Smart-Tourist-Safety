from typing import Dict, Any, List, Protocol, runtime_checkable, cast
from pathlib import Path
import pickle
import json

from river import anomaly, preprocessing

from models.base_model import UnsupervisedModel
from config import CROWD_ANOMALY_THRESHOLD


# =========================================================
# River Model Protocol (Strict Typing Layer)
# =========================================================

@runtime_checkable
class RiverAnomalyModel(Protocol):
    def score_one(self, x: Dict[str, float]) -> float: ...
    def learn_one(self, x: Dict[str, float]) -> None: ...


# =========================================================
# Online Crowd Model
# =========================================================

class OnlineCrowdModel(UnsupervisedModel[RiverAnomalyModel]):
    """
    Enterprise Crowd Online Adaptive Model

    - Streaming anomaly detection
    - Adaptive learning
    - Strict feature validation
    - Controlled normalization
    - Safe state mutation
    """

    MODEL_VERSION: str = "crowd_online_v1"

    def __init__(self) -> None:
        super().__init__(model_name="crowd_online")

        self.feature_order: List[str] = [
            "event_count",
            "unique_devices",
            "avg_dwell_time",
            "movement_entropy",
        ]

        pipeline = (
            preprocessing.StandardScaler()
            | anomaly.HalfSpaceTrees(
                n_trees=25,
                height=15,
                window_size=250,
                seed=42,
            )
        )

        self.model = cast(RiverAnomalyModel, pipeline)

        self.metadata = {
            "model_type": "online",
            "model_version": self.MODEL_VERSION,
        }

    # =========================================================
    # Training (Not Used)
    # =========================================================

    def train(self, X: Any) -> None:
        raise NotImplementedError(
            "Online model does not support batch training. "
            "Learning occurs during inference."
        )

    # =========================================================
    # Prediction
    # =========================================================

    def predict(self, features: Dict[str, Any]) -> Dict[str, Any]:
        if self.model is None:
            raise RuntimeError("Online model not initialized")

        if not isinstance(features, dict):
            raise ValueError("Features must be a dictionary")

        vector: Dict[str, float] = self._dict_to_vector(features)

        try:
            raw_score: float = float(self.model.score_one(vector))
        except Exception as e:
            raise RuntimeError(f"Online model scoring failed: {str(e)}")

        anomaly_score: float = self._normalize_score(raw_score)
        is_anomaly: bool = anomaly_score >= CROWD_ANOMALY_THRESHOLD

        # Controlled online learning AFTER scoring
        try:
            self.model.learn_one(vector)
        except Exception:
            pass

        return {
            "anomaly_score": round(anomaly_score, 6),
            "is_anomaly": is_anomaly,
            "model_version": self.metadata.get("model_version", self.MODEL_VERSION),
            "model_type": "online",
        }

    # =========================================================
    # Safe Save / Load (River-specific)
    # =========================================================

    def save(self, model_path: Path, metadata_path: Path) -> None:
        if self.model is None:
            raise ValueError("Model not initialized")

        model_path.parent.mkdir(parents=True, exist_ok=True)

        with open(model_path, "wb") as f:
            pickle.dump(self.model, f)

        with open(metadata_path, "w", encoding="utf-8") as f:
            json.dump(self.metadata, f, indent=4)

    def load(self, model_path: Path, metadata_path: Path) -> None:
        if not model_path.exists():
            raise FileNotFoundError(f"Model file not found: {model_path}")

        with open(model_path, "rb") as f:
            loaded_model = pickle.load(f)

        if loaded_model is None:
            raise ValueError("Loaded River model is invalid")

        self.model = cast(RiverAnomalyModel, loaded_model)

        if metadata_path.exists():
            with open(metadata_path, "r", encoding="utf-8") as f:
                self.metadata = json.load(f)
        else:
            self.metadata = {}

    # =========================================================
    # Helpers
    # =========================================================

    def _dict_to_vector(self, features: Dict[str, Any]) -> Dict[str, float]:
        result: Dict[str, float] = {}

        for key in self.feature_order:
            raw_value = features.get(key)

            if raw_value is None:
                raise ValueError(f"Missing required feature: {key}")

            try:
                result[key] = float(raw_value)
            except (TypeError, ValueError):
                raise ValueError(f"Invalid numeric value for feature: {key}")

        return result

    @staticmethod
    def _normalize_score(score: float) -> float:
        if score < 0.0:
            return 0.0
        if score > 1.0:
            return 1.0
        return score