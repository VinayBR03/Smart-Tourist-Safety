from pathlib import Path
from typing import Dict, Any, Optional, Union

from models.zone.logistic_model import LogisticZoneModel
from models.zone.xgboost_model import XGBoostZoneModel
from config import ZONE_ARTIFACT


ZoneModelType = Union[LogisticZoneModel, XGBoostZoneModel]


class ZoneModelSelector:
    """
    Enterprise-grade model selector for zone risk.
    """

    def __init__(self, model_dir: Path):
        self.model_dir = model_dir

    # =========================================================
    # Public API
    # =========================================================

    def load_best_model(self) -> ZoneModelType:

        logistic = self._safe_load(
            LogisticZoneModel(),
            ZONE_ARTIFACT.small_model_filename,
            ZONE_ARTIFACT.small_metadata_filename,
        )

        xgb = self._safe_load(
            XGBoostZoneModel(),
            ZONE_ARTIFACT.large_model_filename,
            ZONE_ARTIFACT.large_metadata_filename,
        )

        if logistic is None and xgb is None:
            raise FileNotFoundError("No trained zone models found")

        if logistic is not None and xgb is None:
            return logistic

        if xgb is not None and logistic is None:
            return xgb

        assert logistic is not None
        assert xgb is not None

        return self._compare_models(logistic, xgb)

    # =========================================================
    # Model Comparison
    # =========================================================

    def _compare_models(
        self,
        model_a: ZoneModelType,
        model_b: ZoneModelType,
    ) -> ZoneModelType:

        score_a = self._compute_selection_score(model_a.metadata)
        score_b = self._compute_selection_score(model_b.metadata)

        if score_b > score_a:
            return model_b

        return model_a

    # =========================================================
    # Composite Score
    # =========================================================

    def _compute_selection_score(self, metadata: Dict[str, Any]) -> float:

        auc          = float(metadata.get("validation_auc",    0.0))
        f1           = float(metadata.get("validation_f1",     0.0))
        calibration  = float(metadata.get("calibration_error", 1.0))
        drift        = float(metadata.get("drift_score",       0.0))
        dataset_size = int(metadata.get("dataset_size",         0))

        calibration_score = 1.0 - calibration
        drift_penalty     = 1.0 - drift

        score = (
            0.40 * auc +
            0.30 * f1 +
            0.15 * calibration_score +
            0.10 * drift_penalty +
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
        model:      ZoneModelType,
        model_file: str,
        meta_file:  str,
    ) -> Optional[ZoneModelType]:

        model_path = self.model_dir / model_file
        meta_path  = self.model_dir / meta_file

        if not model_path.exists():
            return None

        model.load(model_path, meta_path)
        return model