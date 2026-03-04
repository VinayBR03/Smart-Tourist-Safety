from typing import Dict, Any, Optional
import requests
from requests.exceptions import RequestException, Timeout
import time
import json
import threading
import math

from app.core.config import settings
from app.core.enums import RiskLevel
from app.core.logging_config import get_correlation_id
from app.utils.logger import get_logger


logger = get_logger(__name__)


class InternalMLService:

    MAX_FAILURES = 5
    CIRCUIT_RESET_SECONDS = 60
    MAX_FEATURE_PAYLOAD_BYTES = 100_000
    RETRY_ATTEMPTS = 1

    SUPPORTED_DOMAINS = {"zone", "health", "crowd"}

    def __init__(self) -> None:
        self.enabled = settings.ML_ENGINE_ENABLED
        self.base_url = (settings.ML_ENGINE_URL or "").rstrip("/")
        self.timeout = settings.ML_ENGINE_TIMEOUT_SECONDS
        self.internal_token = settings.INTERNAL_SERVICE_TOKEN

        self._failure_count = 0
        self._circuit_opened_at: Optional[float] = None
        self._lock = threading.Lock()

    # =========================================================
    # Circuit Breaker
    # =========================================================

    def _circuit_open(self) -> bool:
        with self._lock:
            if self._failure_count < self.MAX_FAILURES:
                return False

            if not self._circuit_opened_at:
                return False

            if time.time() - self._circuit_opened_at > self.CIRCUIT_RESET_SECONDS:
                self._failure_count = 0
                self._circuit_opened_at = None
                return False

            return True

    def _record_failure(self) -> None:
        with self._lock:
            self._failure_count += 1
            if self._failure_count >= self.MAX_FAILURES:
                self._circuit_opened_at = time.time()

        logger.error(
            "ML circuit breaker opened",
            extra={"extra_data": {"correlation_id": get_correlation_id()}},
        )

    def _record_success(self) -> None:
        with self._lock:
            self._failure_count = 0
            self._circuit_opened_at = None

    # =========================================================
    # Generic Predict
    # =========================================================

    def _predict(
        self,
        *,
        domain: str,
        features: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:

        if not self.enabled:
            return None

        if domain not in self.SUPPORTED_DOMAINS:
            return None

        if not self.base_url or not self.internal_token:
            return None

        if not isinstance(features, dict):
            return None

        if self._circuit_open():
            return None

        try:
            serialized = json.dumps(features)
        except (TypeError, ValueError):
            return None

        if len(serialized.encode("utf-8")) > self.MAX_FEATURE_PAYLOAD_BYTES:
            return None

        url = f"{self.base_url}/predict"

        headers = {
            "X-Internal-Token": self.internal_token,
            "Content-Type": "application/json",
            "X-Correlation-ID": get_correlation_id(),
        }

        payload = {
            "domain": domain,
            "features": features,
        }

        for attempt in range(self.RETRY_ATTEMPTS + 1):
            try:
                response = requests.post(
                    url,
                    json=payload,
                    headers=headers,
                    timeout=self.timeout,
                )

                response.raise_for_status()
                data = response.json()

                validated = self._validate_engine_response(domain, data)

                self._record_success()
                return validated

            except Timeout:
                logger.warning("ML timeout")

            except RequestException:
                logger.warning("ML request error")

            except Exception:
                logger.exception("Unexpected ML error")

            if attempt >= self.RETRY_ATTEMPTS:
                self._record_failure()
                return None

        return None

    # =========================================================
    # Domain Wrappers
    # =========================================================

    def predict_zone_risk(
        self,
        *,
        features: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:

        result = self._predict(domain="zone", features=features)
        if not result:
            return None

        try:
            risk_enum = RiskLevel(result["risk_level"])
            risk_score = float(result["risk_score"])
        except Exception:
            return None

        if not math.isfinite(risk_score):
            return None

        risk_score = max(0.0, min(1.0, risk_score))

        return {
            "risk_score": risk_score,
            "risk_level": risk_enum.value,
            "model_version": result.get("model_version"),
        }

    def predict_health_risk(
        self,
        *,
        features: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:
        return self._predict(domain="health", features=features)

    def predict_crowd_anomaly(
        self,
        *,
        features: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:
        return self._predict(domain="crowd", features=features)

    # =========================================================
    # Response Validation
    # =========================================================

    def _validate_engine_response(
        self,
        domain: str,
        data: Dict[str, Any],
    ) -> Dict[str, Any]:

        if not isinstance(data, dict):
            raise ValueError("Invalid ML response")

        if data.get("status") != "success":
            raise ValueError("ML engine error")

        prediction = data.get("prediction")
        if not isinstance(prediction, dict):
            raise ValueError("Invalid prediction block")

        if domain == "zone":
            required = {"risk_score", "risk_level"}
            missing = required - prediction.keys()
            if missing:
                raise ValueError("Missing required fields")

        return prediction


internal_ml_service = InternalMLService()