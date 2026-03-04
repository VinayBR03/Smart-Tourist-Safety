from typing import Dict, Any, List

from pathlib import Path
import json
import numpy as np
from numpy.typing import NDArray

import torch
import torch.nn as nn
from torch import Tensor

from models.base_model import SupervisedModel
from config import HEALTH_ANOMALY_THRESHOLD


# =========================================================
# Typed LSTM Network
# =========================================================

class SimpleLSTM(nn.Module):
    """
    Lightweight LSTM network for health anomaly detection.
    """

    def __init__(self, input_size: int, hidden_size: int = 32) -> None:
        super().__init__()
        self.lstm = nn.LSTM(input_size, hidden_size, batch_first=True)
        self.fc = nn.Linear(hidden_size, 1)
        self.sigmoid = nn.Sigmoid()

    def forward(self, x: Tensor) -> Tensor:
        output, _ = self.lstm(x)
        output = output[:, -1, :]
        output = self.fc(output)
        return self.sigmoid(output)


# =========================================================
# LSTM Health Model
# =========================================================

class LSTMHealthModel(SupervisedModel[SimpleLSTM]):
    """
    Enterprise Health Sequence Model (Large Dataset)

    - Torch CPU safe
    - Strict feature validation
    - Deterministic inference
    - Offline-trained model only
    """

    MODEL_VERSION: str = "health_lstm_v1"

    def __init__(self) -> None:
        super().__init__(model_name="health_lstm")

        self.feature_order: List[str] = [
            "heart_rate",
            "spo2",
            "temperature",
            "movement_variance",
            "battery_level",
        ]

        self.input_size: int = len(self.feature_order)
        self.device: torch.device = torch.device("cpu")

        model = SimpleLSTM(self.input_size)
        model.to(self.device)
        model.eval()

        self.model = model

        self.metadata = {
            "model_type": "lstm",
            "model_version": self.MODEL_VERSION,
            "feature_order": self.feature_order,
        }

    # =========================================================
    # Training (Disabled in Runtime)
    # =========================================================

    def train(
        self,
        X: NDArray[np.float32],
        y: NDArray[np.int64],
    ) -> None:
        raise NotImplementedError(
            "LSTM training must be handled offline. "
            "Only inference supported in runtime service."
        )

    # =========================================================
    # Load Override (Torch State Dict)
    # =========================================================

    def load(self, model_path: Path, metadata_path: Path) -> None:

        if not model_path.exists():
            raise FileNotFoundError(f"Model file not found: {model_path}")

        if self.model is None:
            raise RuntimeError("Model instance not initialized")

        state_dict = torch.load(model_path, map_location=self.device)

        if not isinstance(state_dict, dict):
            raise ValueError("Invalid LSTM state dict")

        self.model.load_state_dict(state_dict)
        self.model.eval()

        if metadata_path.exists():
            with open(metadata_path, "r", encoding="utf-8") as f:
                self.metadata = json.load(f)
        else:
            self.metadata = {
                "model_type": "lstm",
                "model_version": self.MODEL_VERSION,
            }

    # =========================================================
    # Prediction
    # =========================================================

    def predict(self, features: Dict[str, Any]) -> Dict[str, Any]:

        if self.model is None:
            raise RuntimeError("Model not trained or loaded")

        if not isinstance(features, dict):
            raise ValueError("Features must be a dictionary")

        tensor: Tensor = self._dict_to_tensor(features)

        with torch.no_grad():
            output: Tensor = self.model(tensor)
            probability: float = float(
                output.squeeze().detach().cpu().numpy()
            )

        probability = self._clamp_probability(probability)

        is_anomaly: bool = probability >= HEALTH_ANOMALY_THRESHOLD

        return {
            "anomaly_score": round(probability, 6),
            "is_anomaly": is_anomaly,
            "model_version": self.metadata.get("model_version", self.MODEL_VERSION),
            "model_type": "lstm",
        }

    # =========================================================
    # Helpers
    # =========================================================

    def _dict_to_tensor(self, features: Dict[str, Any]) -> Tensor:

        values: List[float] = []

        for key in self.feature_order:
            raw_value = features.get(key)

            if raw_value is None:
                raise ValueError(f"Missing required feature: {key}")

            try:
                values.append(float(raw_value))
            except (TypeError, ValueError):
                raise ValueError(f"Invalid numeric value for feature: {key}")

        arr: NDArray[np.float32] = np.asarray(values, dtype=np.float32)
        arr = arr.reshape(1, 1, -1)

        tensor: Tensor = torch.tensor(
            arr,
            dtype=torch.float32,
            device=self.device,
        )

        return tensor

    @staticmethod
    def _clamp_probability(value: float) -> float:
        if value < 0.0:
            return 0.0
        if value > 1.0:
            return 1.0
        return value