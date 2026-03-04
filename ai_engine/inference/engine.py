from typing import Dict, Any, Callable

from inference.zone_predictor import ZonePredictor
from inference.health_predictor import HealthPredictor
from inference.crowd_predictor import CrowdPredictor


class AIInferenceEngine:
    """
    Unified Inference Engine

    Responsibilities:
    - Route prediction requests
    - Standardize output
    - Provide safe execution wrapper
    - Domain abstraction layer
    """

    SUPPORTED_DOMAINS = {"zone", "health", "crowd"}

    def __init__(self) -> None:
        self._zone_predictor = ZonePredictor()
        self._health_predictor = HealthPredictor()
        self._crowd_predictor = CrowdPredictor()

        self._router: Dict[str, Callable[[Dict[str, Any]], Dict[str, Any]]] = {
            "zone": self._zone_predictor.predict,
            "health": self._health_predictor.predict,
            "crowd": self._crowd_predictor.predict,
        }

    # =========================================================
    # Public Entry
    # =========================================================

    def predict(
        self,
        *,
        domain: str,
        features: Dict[str, Any],
    ) -> Dict[str, Any]:

        if domain not in self.SUPPORTED_DOMAINS:
            return self._error_response(domain, "Unsupported domain")

        if not isinstance(features, dict):
            return self._error_response(domain, "Features must be a dictionary")

        predictor = self._router.get(domain)

        if predictor is None:
            return self._error_response(domain, "Domain not configured")

        try:
            result = predictor(features)

        except ValueError as e:
            return self._error_response(domain, str(e))

        except RuntimeError as e:
            return self._error_response(domain, str(e))

        except Exception:
            # Avoid leaking internal details
            return self._error_response(domain, "Internal inference error")

        return {
            "status": "success",
            "domain": domain,
            "prediction": result,
        }

    # =========================================================
    # Health Check
    # =========================================================

    def health_check(self) -> Dict[str, Any]:
        return {
            "status": "ok",
            "supported_domains": list(self.SUPPORTED_DOMAINS),
        }

    # =========================================================
    # Helpers
    # =========================================================

    @staticmethod
    def _error_response(domain: str, message: str) -> Dict[str, Any]:
        return {
            "status": "error",
            "domain": domain,
            "message": message,
        }


# Singleton instance
ai_engine = AIInferenceEngine()