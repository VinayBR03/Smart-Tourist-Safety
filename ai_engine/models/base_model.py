from abc import ABC, abstractmethod
from typing import Dict, Any, Generic, TypeVar, Optional, cast
from pathlib import Path
import joblib
import json


# =========================================================
# Generic Type For Underlying ML Model
# =========================================================

ModelT = TypeVar("ModelT")


# =========================================================
# Core Base Model (Type-Safe)
# =========================================================

class BaseModel(ABC, Generic[ModelT]):
    """
    Shared functionality for all ML models.

    - Strictly typed underlying model
    - No implicit Any propagation
    - Safe save / load
    """

    def __init__(self, model_name: str):
        self.model_name: str = model_name
        self.model: Optional[ModelT] = None
        self.metadata: Dict[str, Any] = {}

    # =========================================================
    # Prediction Interface (Mandatory)
    # =========================================================

    @abstractmethod
    def predict(self, features: Dict[str, Any]) -> Dict[str, Any]:
        raise NotImplementedError

    # =========================================================
    # Save / Load
    # =========================================================

    def save(self, model_path: Path, metadata_path: Path) -> None:
        if self.model is None:
            raise ValueError("Model is not trained")

        model_path.parent.mkdir(parents=True, exist_ok=True)

        joblib.dump(self.model, model_path)

        with open(metadata_path, "w", encoding="utf-8") as f:
            json.dump(self.metadata, f, indent=4)

    def load(self, model_path: Path, metadata_path: Path) -> None:
        if not model_path.exists():
            raise FileNotFoundError(f"Model file not found: {model_path}")

        loaded_model = joblib.load(model_path)

        if loaded_model is None:
            raise ValueError("Loaded model artifact is invalid")

        # Explicit cast preserves generic type safety
        self.model = cast(ModelT, loaded_model)

        if metadata_path.exists():
            with open(metadata_path, "r", encoding="utf-8") as f:
                self.metadata = json.load(f)
        else:
            self.metadata = {}

    def is_trained(self) -> bool:
        return self.model is not None


# =========================================================
# Supervised Model (Strictly Requires Labels)
# =========================================================

class SupervisedModel(BaseModel[ModelT], ABC):
    """
    For models that require labels (X, y).
    """

    @abstractmethod
    def train(self, X: Any, y: Any) -> None:
        raise NotImplementedError


# =========================================================
# Unsupervised Model (No Labels)
# =========================================================

class UnsupervisedModel(BaseModel[ModelT], ABC):
    """
    For models that do NOT require labels.
    """

    @abstractmethod
    def train(self, X: Any) -> None:
        raise NotImplementedError