from typing import Dict
import numpy as np
from numpy.typing import NDArray


class CrowdFeatureEngineer:
    """
    Enterprise Crowd Feature Engineering

    - Compute density metrics
    - Compute movement entropy
    - Normalize safely
    - Prevent numeric instability
    """

    FEATURE_ORDER = [
        "event_count",
        "unique_devices",
        "avg_dwell_time",
        "movement_entropy",
    ]

    # =========================================================
    # Public API (Inference)
    # =========================================================

    def build_features(
        self,
        *,
        event_count: float,
        unique_devices: float,
        dwell_times: NDArray[np.float64],
        movement_distribution: NDArray[np.float64],
    ) -> Dict[str, float]:

        event_density: float = self._safe_positive(event_count)
        device_count: float = self._safe_positive(unique_devices)
        avg_dwell: float = self._compute_avg_dwell(dwell_times)
        entropy: float = self._compute_entropy(movement_distribution)

        return {
            "event_count": event_density,
            "unique_devices": device_count,
            "avg_dwell_time": avg_dwell,
            "movement_entropy": entropy,
        }

    # =========================================================
    # Batch Build (Training)
    # =========================================================

    def build_from_arrays(
        self,
        event_counts: NDArray[np.float64],
        unique_devices: NDArray[np.float64],
        avg_dwell_times: NDArray[np.float64],
        movement_distributions: NDArray[np.float64],
    ) -> NDArray[np.float64]:

        n_samples: int = len(event_counts)

        if not (
            len(unique_devices) == n_samples
            and len(avg_dwell_times) == n_samples
            and movement_distributions.shape[0] == n_samples
        ):
            raise ValueError("All input arrays must have equal sample length")

        if movement_distributions.ndim != 2:
            raise ValueError("movement_distributions must be 2D array")

        event_counts = np.maximum(event_counts, 0.0).astype(np.float64)
        unique_devices = np.maximum(unique_devices, 0.0).astype(np.float64)
        avg_dwell_times = np.maximum(avg_dwell_times, 0.0).astype(np.float64)

        entropy: NDArray[np.float64] = np.apply_along_axis(
            self._compute_entropy,
            1,
            movement_distributions.astype(np.float64),
        )

        return np.column_stack(
            [
                event_counts,
                unique_devices,
                avg_dwell_times,
                entropy.astype(np.float64),
            ]
        )

    # =========================================================
    # Core Computations
    # =========================================================

    def _compute_avg_dwell(self, dwell_times: NDArray[np.float64]) -> float:

        if dwell_times is None or len(dwell_times) == 0:
            return 0.0

        dwell_times = np.asarray(dwell_times, dtype=np.float64)
        dwell_times = np.maximum(dwell_times, 0.0)

        return float(np.mean(dwell_times))

    def _compute_entropy(self, distribution: NDArray[np.float64]) -> float:
        """
        Normalized Shannon entropy.
        """

        if distribution is None or len(distribution) <= 1:
            return 0.0

        distribution = np.asarray(distribution, dtype=np.float64)

        total: float = float(np.sum(distribution))

        if total <= 0.0:
            return 0.0

        probabilities: NDArray[np.float64] = distribution / total
        probabilities = probabilities[probabilities > 0]

        entropy: float = float(
            -np.sum(probabilities * np.log2(probabilities))
        )

        max_entropy: float = float(np.log2(len(distribution)))

        if max_entropy <= 0.0:
            return 0.0

        return float(entropy / max_entropy)

    # =========================================================
    # Safety Helper
    # =========================================================

    def _safe_positive(self, value: float) -> float:
        return float(value) if value >= 0.0 else 0.0