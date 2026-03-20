from typing import Dict, Any
from datetime import datetime, timedelta, timezone

import numpy as np
from numpy.typing import NDArray

from monitoring.drift_monitor import DriftMonitor
from config import RETRAIN_IF_NEW_DATA_PERCENT, DEFAULT_RETRAIN_INTERVAL_HOURS


class RetrainingScheduler:
    """
    Enterprise Retraining Scheduler

    - Monitor drift
    - Monitor data growth
    - Enforce cooldown window
    - Decide retraining eligibility
    - Model-agnostic
    """

    def __init__(self) -> None:
        self._last_retrain_time: Dict[str, datetime] = {}
        self._drift_monitor = DriftMonitor()

    # =========================================================
    # Public API
    # =========================================================

    def should_retrain(
        self,
        *,
        model_name:           str,
        live_batch:           NDArray[np.float64],
        model_metadata:       Dict[str, Any],
        current_dataset_size: int,
    ) -> Dict[str, Any]:

        # datetime.utcnow() is deprecated since Python 3.12 —
        # use timezone-aware datetime.now(timezone.utc) instead.
        now = datetime.now(timezone.utc)

        # 1. Cooldown check
        if not self._cooldown_passed(model_name, now):
            return {
                "retrain": False,
                "reason":  "cooldown_active",
            }

        # 2. Drift check
        drift_result = self._drift_monitor.evaluate(
            live_batch=live_batch,
            model_metadata=model_metadata,
        )

        drift_trigger: bool = bool(drift_result.get("alert", False))

        # 3. Data growth check
        growth_trigger: bool = self._data_growth_trigger(
            current_dataset_size,
            model_metadata,
        )

        # 4. Final decision
        if drift_trigger or growth_trigger:
            self._last_retrain_time[model_name] = now

            return {
                "retrain":        True,
                "drift_trigger":  drift_trigger,
                "growth_trigger": growth_trigger,
                "drift_score":    float(drift_result.get("drift_score", 0.0)),
            }

        return {
            "retrain":     False,
            "reason":      "no_trigger",
            "drift_score": float(drift_result.get("drift_score", 0.0)),
        }

    # =========================================================
    # Cooldown Logic
    # =========================================================

    def _cooldown_passed(
        self,
        model_name: str,
        now:        datetime,
    ) -> bool:

        if model_name not in self._last_retrain_time:
            return True

        last_time       = self._last_retrain_time[model_name]
        cooldown_window = timedelta(hours=DEFAULT_RETRAIN_INTERVAL_HOURS)

        return (now - last_time) >= cooldown_window

    # =========================================================
    # Data Growth Logic
    # =========================================================

    def _data_growth_trigger(
        self,
        current_dataset_size: int,
        metadata:             Dict[str, Any],
    ) -> bool:

        baseline_size_raw = metadata.get("dataset_size")

        if baseline_size_raw is None:
            return False

        try:
            baseline_size: float = float(baseline_size_raw)
        except (TypeError, ValueError):
            return False

        if baseline_size <= 0:
            return False

        growth_ratio: float = (
            float(current_dataset_size) - baseline_size
        ) / baseline_size

        if growth_ratio < 0.0:
            growth_ratio = 0.0

        return growth_ratio >= RETRAIN_IF_NEW_DATA_PERCENT