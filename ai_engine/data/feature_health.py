from typing import Dict
import numpy as np
from numpy.typing import NDArray


class HealthFeatureEngineer:
    """
    Enterprise Health Feature Engineering

    - Normalize physiological signals
    - Clip to safe biological ranges
    - Ensure deterministic ordering
    - Prevent NaN/inf propagation
    """

    FEATURE_ORDER = [
        "heart_rate",
        "spo2",
        "temperature",
        "movement_variance",
        "previous_health_score",   # temporal context for sequence models
    ]

    # Safe physiological ranges
    HR_MIN,   HR_MAX   = 30.0, 220.0
    SPO2_MIN, SPO2_MAX = 50.0, 100.0
    TEMP_MIN, TEMP_MAX = 30.0,  43.0

    # =========================================================
    # Public API (Inference)
    # =========================================================

    def build_features(
        self,
        *,
        heart_rate:            float,
        spo2:                  float,
        temperature:           float,
        movement_variance:     float,
        previous_health_score: float,
    ) -> Dict[str, float]:

        hr        = self._normalize_hr(heart_rate)
        spo2_norm = self._normalize_spo2(spo2)
        temp      = self._normalize_temp(temperature)
        movement  = self._safe_positive(movement_variance)
        prev      = self._clip(previous_health_score, 0.0, 1.0)

        return {
            "heart_rate":            hr,
            "spo2":                  spo2_norm,
            "temperature":           temp,
            "movement_variance":     movement,
            "previous_health_score": prev,
        }

    # =========================================================
    # Batch Build (Training)
    # =========================================================

    def build_from_arrays(
        self,
        heart_rate:            NDArray[np.float64],
        spo2:                  NDArray[np.float64],
        temperature:           NDArray[np.float64],
        movement_variance:     NDArray[np.float64],
        previous_health_score: NDArray[np.float64],
    ) -> NDArray[np.float64]:

        n_samples: int = len(heart_rate)

        if not (
            len(spo2)                  == n_samples
            and len(temperature)       == n_samples
            and len(movement_variance) == n_samples
            and len(previous_health_score) == n_samples
        ):
            raise ValueError("All input arrays must have equal length")

        heart_rate            = np.asarray(heart_rate,            dtype=np.float64)
        spo2                  = np.asarray(spo2,                  dtype=np.float64)
        temperature           = np.asarray(temperature,           dtype=np.float64)
        movement_variance     = np.asarray(movement_variance,     dtype=np.float64)
        previous_health_score = np.asarray(previous_health_score, dtype=np.float64)

        hr        = self._normalize_hr_array(heart_rate)
        spo2_norm = self._normalize_spo2_array(spo2)
        temp      = self._normalize_temp_array(temperature)
        movement  = np.maximum(movement_variance, 0.0)
        prev      = np.clip(previous_health_score, 0.0, 1.0)

        # Remove NaN/Inf safely
        hr        = np.nan_to_num(hr,        nan=0.0, posinf=0.0, neginf=0.0)
        spo2_norm = np.nan_to_num(spo2_norm, nan=0.0, posinf=0.0, neginf=0.0)
        temp      = np.nan_to_num(temp,      nan=0.0, posinf=0.0, neginf=0.0)
        movement  = np.nan_to_num(movement,  nan=0.0, posinf=0.0, neginf=0.0)
        prev      = np.nan_to_num(prev,      nan=0.0, posinf=0.0, neginf=0.0)

        return np.column_stack([
            hr,
            spo2_norm,
            temp,
            movement,
            prev,
        ]).astype(np.float64)

    # =========================================================
    # Normalization Helpers
    # =========================================================

    def _normalize_hr(self, hr: float) -> float:
        hr = self._clip(hr, self.HR_MIN, self.HR_MAX)
        return float((hr - 60.0) / 60.0)

    def _normalize_spo2(self, spo2: float) -> float:
        spo2 = self._clip(spo2, self.SPO2_MIN, self.SPO2_MAX)
        return float((spo2 - 95.0) / 5.0)

    def _normalize_temp(self, temp: float) -> float:
        temp = self._clip(temp, self.TEMP_MIN, self.TEMP_MAX)
        return float((temp - 37.0) / 3.0)

    def _normalize_hr_array(self, hr: NDArray[np.float64]) -> NDArray[np.float64]:
        hr = np.clip(hr, self.HR_MIN, self.HR_MAX)
        return (hr - 60.0) / 60.0

    def _normalize_spo2_array(self, spo2: NDArray[np.float64]) -> NDArray[np.float64]:
        spo2 = np.clip(spo2, self.SPO2_MIN, self.SPO2_MAX)
        return (spo2 - 95.0) / 5.0

    def _normalize_temp_array(self, temp: NDArray[np.float64]) -> NDArray[np.float64]:
        temp = np.clip(temp, self.TEMP_MIN, self.TEMP_MAX)
        return (temp - 37.0) / 3.0

    # =========================================================
    # Safety Helpers
    # =========================================================

    def _clip(self, value: float, min_val: float, max_val: float) -> float:
        return float(max(min_val, min(max_val, value)))

    def _safe_positive(self, value: float) -> float:
        return float(value) if value >= 0.0 else 0.0