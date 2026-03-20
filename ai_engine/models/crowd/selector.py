from pathlib import Path
from typing import Optional, Dict, Any, Union

from models.crowd.isolation_forest_model import IsolationForestCrowdModel
from models.crowd.online_model import OnlineCrowdModel
from config import CROWD_ARTIFACT


CrowdModelType = Union[
    IsolationForestCrowdModel,
    OnlineCrowdModel,
]


class CrowdModelSelector:
    """
    Enterprise Crowd Model Selector

    - Metric-based comparison
    - Drift-aware
    - Dataset bonus
    - Safe fallback behavior
    """

    def __init__(self, model_dir: Path):
        self.model_dir = model_dir

    # =========================================================
    # Public API
    # =========================================================

    def load_best_model(self) -> CrowdModelType:

        isolation = self._safe_load(
            IsolationForestCrowdModel(),
            CROWD_ARTIFACT.small_model_filename,
            CROWD_ARTIFACT.small_metadata_filename,
        )

        online = self._safe_load(
            OnlineCrowdModel(),
            CROWD_ARTIFACT.large_model_filename,
            CROWD_ARTIFACT.large_metadata_filename,
        )

        if isolation is None and online is None:
            raise FileNotFoundError("No trained crowd models found")

        if isolation is not None and online is None:
            return isolation

        if online is not None and isolation is None:
            return online

        assert isolation is not None
        assert online is not None

        return self._compare_models(isolation, online)

    # =========================================================
    # Comparison Logic
    # =========================================================

    def _compare_models(
        self,
        model_a: CrowdModelType,
        model_b: CrowdModelType,
    ) -> CrowdModelType:

        score_a = self._compute_selection_score(model_a.metadata)
        score_b = self._compute_selection_score(model_b.metadata)

        if score_b > score_a:
            return model_b

        return model_a

    # =========================================================
    # Composite Score
    # =========================================================

    def _compute_selection_score(self, metadata: Dict[str, Any]) -> float:

        auc          = float(metadata.get("validation_auc",  0.0))
        f1           = float(metadata.get("validation_f1",   0.0))
        drift        = float(metadata.get("drift_score",     0.0))
        dataset_size = int(metadata.get("dataset_size",       0))

        drift_penalty = 1.0 - drift

        score = (
            0.45 * auc +
            0.25 * f1 +
            0.20 * drift_penalty +
            0.10 * self._dataset_bonus(dataset_size)
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
        model:      CrowdModelType,
        model_file: str,
        meta_file:  str,
    ) -> Optional[CrowdModelType]:

        model_path = self.model_dir / model_file
        meta_path  = self.model_dir / meta_file

        if not model_path.exists():
            return None

        model.load(model_path, meta_path)
        return model