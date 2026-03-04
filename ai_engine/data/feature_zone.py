from typing import Dict
import numpy as np
from numpy.typing import NDArray


class ZoneFeatureEngineer:
    """
    Enterprise Zone Feature Engineering

    - Compute derived risk features
    - Normalize window metrics
    - Ensure deterministic feature ordering
    - Prevent division-by-zero
    """

    FEATURE_ORDER = [
        "incident_count",
        "sos_count",
        "event_count",
        "previous_risk_score",
        "window_minutes",
    ]

    # =========================================================
    # Public API (Inference)
    # =========================================================

    def build_features(
        self,
        *,
        incident_count: int,
        sos_count: int,
        event_count: int,
        previous_risk_score: float,
        window_minutes: float,
    ) -> Dict[str, float]:

        if window_minutes <= 0:
            raise ValueError("window_minutes must be > 0")

        incident_rate: float = self._safe_rate(
            max(incident_count, 0),
            window_minutes,
        )

        sos_rate: float = self._safe_rate(
            max(sos_count, 0),
            window_minutes,
        )

        event_rate: float = self._safe_rate(
            max(event_count, 0),
            window_minutes,
        )

        return {
            "incident_count": incident_rate,
            "sos_count": sos_rate,
            "event_count": event_rate,
            "previous_risk_score": self._clip_score(previous_risk_score),
            "window_minutes": float(window_minutes),
        }

    # =========================================================
    # Batch Build (Training)
    # =========================================================

    def build_from_dataframe(
        self,
        incident_counts: NDArray[np.float64],
        sos_counts: NDArray[np.float64],
        event_counts: NDArray[np.float64],
        previous_scores: NDArray[np.float64],
        window_minutes: NDArray[np.float64],
    ) -> NDArray[np.float64]:

        n_samples: int = len(incident_counts)

        if not (
            len(sos_counts) == n_samples
            and len(event_counts) == n_samples
            and len(previous_scores) == n_samples
            and len(window_minutes) == n_samples
        ):
            raise ValueError("Input arrays must have equal length")

        # Enforce float64
        incident_counts = np.asarray(incident_counts, dtype=np.float64)
        sos_counts = np.asarray(sos_counts, dtype=np.float64)
        event_counts = np.asarray(event_counts, dtype=np.float64)
        previous_scores = np.asarray(previous_scores, dtype=np.float64)
        window_minutes = np.asarray(window_minutes, dtype=np.float64)

        # Clamp values safely
        incident_counts = np.maximum(incident_counts, 0.0)
        sos_counts = np.maximum(sos_counts, 0.0)
        event_counts = np.maximum(event_counts, 0.0)
        window_minutes = np.where(window_minutes <= 0.0, 1.0, window_minutes)

        # Compute rates
        incident_rate: NDArray[np.float64] = incident_counts / window_minutes
        sos_rate: NDArray[np.float64] = sos_counts / window_minutes
        event_rate: NDArray[np.float64] = event_counts / window_minutes

        previous_scores = np.clip(previous_scores, 0.0, 1.0)

        return np.column_stack(
            [
                incident_rate,
                sos_rate,
                event_rate,
                previous_scores,
                window_minutes,
            ]
        ).astype(np.float64)

    # =========================================================
    # Helpers
    # =========================================================

    def _safe_rate(self, count: float, window: float) -> float:
        if window <= 0.0:
            return 0.0
        return float(count) / float(window)

    def _clip_score(self, score: float) -> float:
        return float(max(0.0, min(1.0, score)))