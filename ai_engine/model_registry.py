from typing import Optional, Dict, Union
from pathlib import Path
from threading import RLock

from models.zone.selector import ZoneModelSelector, ZoneModelType
from models.health.selector import HealthModelSelector, HealthModelType
from models.crowd.selector import CrowdModelSelector, CrowdModelType

from config import ARTIFACTS_DIR, ZONE_ARTIFACT, HEALTH_ARTIFACT, CROWD_ARTIFACT


# =========================================================
# Unified Model Type
# =========================================================

LoadedModel = Union[
    ZoneModelType,
    HealthModelType,
    CrowdModelType,
]


# =========================================================
# Model Registry
# =========================================================

class ModelRegistry:
    """
    Enterprise Model Registry

    Responsibilities:
    - Load models at startup
    - Cache models in memory
    - Thread-safe access
    - Provide model metadata
    - Support hot reload
    """

    def __init__(self) -> None:
        self._zone_model: Optional[ZoneModelType] = None
        self._health_model: Optional[HealthModelType] = None
        self._crowd_model: Optional[CrowdModelType] = None

        self._lock = RLock()

        self.reload_all()

    # =========================================================
    # Public Reload
    # =========================================================

    def reload_all(self) -> None:
        """
        Thread-safe reload of all models.
        """
        with self._lock:
            self._zone_model = self._safe_load_zone()
            self._health_model = self._safe_load_health()
            self._crowd_model = self._safe_load_crowd()

    # =========================================================
    # Loaders
    # =========================================================

    def _safe_load_zone(self) -> Optional[ZoneModelType]:
        zone_dir: Path = ARTIFACTS_DIR / ZONE_ARTIFACT.name

        try:
            selector = ZoneModelSelector(zone_dir)
            model = selector.load_best_model()
            self._validate_model_metadata(model)
            return model
        except Exception:
            return None

    def _safe_load_health(self) -> Optional[HealthModelType]:
        health_dir: Path = ARTIFACTS_DIR / HEALTH_ARTIFACT.name

        try:
            selector = HealthModelSelector(health_dir)
            model = selector.load_best_model()
            self._validate_model_metadata(model)
            return model
        except Exception:
            return None

    def _safe_load_crowd(self) -> Optional[CrowdModelType]:
        crowd_dir: Path = ARTIFACTS_DIR / CROWD_ARTIFACT.name

        try:
            selector = CrowdModelSelector(crowd_dir)
            model = selector.load_best_model()
            self._validate_model_metadata(model)
            return model
        except Exception:
            return None

    # =========================================================
    # Metadata Validation
    # =========================================================

    @staticmethod
    def _validate_model_metadata(model: LoadedModel) -> None:
        if not hasattr(model, "metadata"):
            raise ValueError("Model missing metadata")

        metadata = model.metadata

        if not isinstance(metadata, dict):
            raise ValueError("Model metadata must be dict")

        if "model_version" not in metadata:
            raise ValueError("Model missing model_version")

        if "model_type" not in metadata:
            raise ValueError("Model missing model_type")

    # =========================================================
    # Accessors (Thread-safe)
    # =========================================================

    def get_zone_model(self) -> Optional[ZoneModelType]:
        with self._lock:
            return self._zone_model

    def get_health_model(self) -> Optional[HealthModelType]:
        with self._lock:
            return self._health_model

    def get_crowd_model(self) -> Optional[CrowdModelType]:
        with self._lock:
            return self._crowd_model

    # =========================================================
    # Status
    # =========================================================

    def status(self) -> Dict[str, str]:
        with self._lock:
            return {
                "zone": self._model_status(self._zone_model),
                "health": self._model_status(self._health_model),
                "crowd": self._model_status(self._crowd_model),
            }

    def detailed_status(self) -> Dict[str, Dict[str, str]]:
        with self._lock:
            return {
                "zone": self._model_details(self._zone_model),
                "health": self._model_details(self._health_model),
                "crowd": self._model_details(self._crowd_model),
            }

    # =========================================================
    # Helpers
    # =========================================================

    @staticmethod
    def _model_status(model: Optional[LoadedModel]) -> str:
        return "loaded" if model is not None else "not_loaded"

    @staticmethod
    def _model_details(model: Optional[LoadedModel]) -> Dict[str, str]:
        if model is None:
            return {"status": "not_loaded"}

        metadata = model.metadata

        return {
            "status": "loaded",
            "model_type": str(metadata.get("model_type", "unknown")),
            "model_version": str(metadata.get("model_version", "unknown")),
        }


# =========================================================
# Singleton
# =========================================================

model_registry = ModelRegistry()