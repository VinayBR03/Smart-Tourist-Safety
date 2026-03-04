from typing import Dict, Any, List
import numpy as np
from numpy.typing import NDArray


class DataPreprocessor:
    """
    Enterprise Data Preprocessing Utility

    - Strict numeric casting
    - Missing value sanitization
    - Feature clipping
    - Safe normalization
    - Deterministic transformation
    """

    def __init__(
        self,
        *,
        feature_order: List[str],
        clip_min: float = -1e6,
        clip_max: float = 1e6,
    ) -> None:

        if not feature_order:
            raise ValueError("feature_order must not be empty")

        self.feature_order: List[str] = feature_order
        self.clip_min: float = clip_min
        self.clip_max: float = clip_max

    # =========================================================
    # Public API
    # =========================================================

    def transform_dict(self, features: Dict[str, Any]) -> NDArray[np.float64]:
        """
        Convert dict → clipped numeric numpy array (shape: 1 x n_features)
        """

        if not isinstance(features, dict):
            raise ValueError("Features must be a dictionary")

        vector: List[float] = []

        for key in self.feature_order:

            if key not in features:
                raise ValueError(f"Missing required feature: {key}")

            try:
                value: float = float(features[key])
            except (TypeError, ValueError):
                raise ValueError(f"Invalid numeric value for feature: {key}")

            value = self._clip(value)
            vector.append(value)

        arr: NDArray[np.float64] = np.asarray(vector, dtype=np.float64)

        # Sanitize NaN / Inf
        arr = np.nan_to_num(arr, nan=0.0, posinf=0.0, neginf=0.0)

        return arr.reshape(1, -1)

    # =========================================================
    # Batch Transform
    # =========================================================

    def transform_batch(self, X: NDArray[np.float64]) -> NDArray[np.float64]:

        if not isinstance(X, np.ndarray):
            raise ValueError("X must be numpy array")

        if X.ndim != 2:
            raise ValueError("X must be 2D array")

        if X.shape[1] != len(self.feature_order):
            raise ValueError(
                "Feature dimension mismatch with feature_order"
            )

        X = X.astype(np.float64)

        # Clip
        X = np.clip(X, self.clip_min, self.clip_max)

        # Sanitize NaN / Inf
        X = np.nan_to_num(X, nan=0.0, posinf=0.0, neginf=0.0)

        return X

    # =========================================================
    # Helpers
    # =========================================================

    def _clip(self, value: float) -> float:
        return max(self.clip_min, min(self.clip_max, value))