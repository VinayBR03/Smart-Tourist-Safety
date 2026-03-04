from typing import Dict, Any, Optional

import numpy as np
from numpy.typing import NDArray


class DriftMonitor:
    """
    Enterprise Drift Monitoring Service

    - Compare live feature distribution vs training baseline
    - Compute normalized drift score
    - Provide alert signal
    - Lightweight
    - Fully typed
    """

    DEFAULT_ALERT_THRESHOLD: float = 0.35

    # =========================================================
    # Public API
    # =========================================================

    def evaluate(
        self,
        *,
        live_batch: NDArray[np.float64],
        model_metadata: Dict[str, Any],
        alert_threshold: Optional[float] = None,
    ) -> Dict[str, Any]:

        if live_batch.ndim != 2:
            raise ValueError("Live batch must be 2D array")

        if live_batch.shape[0] == 0:
            raise ValueError("Live batch cannot be empty")

        if (
            "baseline_feature_mean" not in model_metadata
            or "baseline_feature_std" not in model_metadata
        ):
            return self._no_baseline_response()

        baseline_mean: NDArray[np.float64] = np.asarray(
            model_metadata["baseline_feature_mean"],
            dtype=np.float64,
        )

        baseline_std: NDArray[np.float64] = np.asarray(
            model_metadata["baseline_feature_std"],
            dtype=np.float64,
        )

        # Shape validation (critical)
        if baseline_mean.shape != baseline_std.shape:
            return self._invalid_baseline_response()

        if live_batch.shape[1] != baseline_mean.shape[0]:
            return self._invalid_baseline_response()

        live_mean: NDArray[np.float64] = np.mean(live_batch, axis=0)

        # Prevent division by zero
        safe_std: NDArray[np.float64] = np.where(
            baseline_std == 0.0,
            1.0,
            baseline_std,
        )

        z_scores: NDArray[np.float64] = np.abs(
            (live_mean - baseline_mean) / safe_std
        )

        raw_drift: float = float(np.mean(z_scores))

        # Logistic squash to keep bounded in [0,1]
        drift_score: float = float(
            1.0 / (1.0 + np.exp(-raw_drift))
        )

        threshold: float = (
            alert_threshold
            if alert_threshold is not None
            else self.DEFAULT_ALERT_THRESHOLD
        )

        alert: bool = drift_score >= threshold

        return {
            "drift_score": round(drift_score, 6),
            "alert": alert,
            "feature_z_scores": z_scores.astype(np.float64).tolist(),
        }

    # =========================================================
    # Fallback Responses
    # =========================================================

    @staticmethod
    def _no_baseline_response() -> Dict[str, Any]:
        return {
            "drift_score": 0.0,
            "alert": False,
            "feature_z_scores": [],
            "reason": "baseline_missing",
        }

    @staticmethod
    def _invalid_baseline_response() -> Dict[str, Any]:
        return {
            "drift_score": 0.0,
            "alert": False,
            "feature_z_scores": [],
            "reason": "baseline_invalid",
        }