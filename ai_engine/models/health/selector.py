from pathlib import Path
from typing import Optional, Dict, Any, Union

from models.health.random_forest_model import RandomForestHealthModel
from models.health.lstm_model import LSTMHealthModel
from config import HEALTH_ARTIFACT


HealthModelType = Union[
    RandomForestHealthModel,
    LSTMHealthModel,
]


class HealthModelSelector:
    """
    Enterprise Health Model Selector

    - Metric-based comparison
    - Drift-aware
    - Calibration-aware
    - Dataset bonus included
    - Safe fallback behavior
    """

    def __init__(self, model_dir: Path):
        self.model_dir = model_dir

    # =========================================================
    # Public API
    # =========================================================

    def load_best_model(self) -> HealthModelType:

        rf = self._safe_load(
            RandomForestHealthModel(),
            HEALTH_ARTIFACT.small_model_filename,
            "health_rf_meta.json",
        )

        lstm = self._safe_load(
            LSTMHealthModel(),
            HEALTH_ARTIFACT.large_model_filename,
            "health_lstm_meta.json",
        )

        if rf is None and lstm is None:
            raise FileNotFoundError("No trained health models found")

        if rf is not None and lstm is None:
            return rf

        if lstm is not None and rf is None:
            return lstm

        assert rf is not None
        assert lstm is not None

        return self._compare_models(rf, lstm)

    # =========================================================
    # Comparison Logic
    # =========================================================

    def _compare_models(
        self,
        model_a: HealthModelType,
        model_b: HealthModelType,
    ) -> HealthModelType:

        score_a = self._compute_selection_score(model_a.metadata)
        score_b = self._compute_selection_score(model_b.metadata)

        if score_b > score_a:
            return model_b

        return model_a

    # =========================================================
    # Composite Selection Score
    # =========================================================

    def _compute_selection_score(self, metadata: Dict[str, Any]) -> float:
        """
        Composite health model score.
        """

        auc = float(metadata.get("validation_auc", 0.0))
        f1 = float(metadata.get("validation_f1", 0.0))
        calibration = float(metadata.get("calibration_error", 1.0))
        drift = float(metadata.get("drift_score", 0.0))
        dataset_size = int(metadata.get("dataset_size", 0))

        calibration_score = 1.0 - calibration
        drift_penalty = 1.0 - drift

        score = (
            0.4 * auc +
            0.3 * f1 +
            0.15 * calibration_score +
            0.1 * drift_penalty +
            0.05 * self._dataset_bonus(dataset_size)
        )

        return float(score)

    # =========================================================
    # Dataset Bonus
    # =========================================================

    def _dataset_bonus(self, dataset_size: int) -> float:

        if dataset_size <= 0:
            return 0.0

        if dataset_size < 1000:
            return 0.1

        if dataset_size < 5000:
            return 0.5

        return 1.0

    # =========================================================
    # Safe Load
    # =========================================================

    def _safe_load(
        self,
        model: HealthModelType,
        model_file: str,
        meta_file: str,
    ) -> Optional[HealthModelType]:

        model_path = self.model_dir / model_file
        meta_path = self.model_dir / meta_file

        if not model_path.exists():
            return None

        model.load(model_path, meta_path)
        return model