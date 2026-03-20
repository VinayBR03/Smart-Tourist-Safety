# ai-engine/config.py

from pathlib import Path
from dataclasses import dataclass


# =========================================================
# Base Paths
# =========================================================

BASE_DIR      = Path(__file__).resolve().parent
ARTIFACTS_DIR = BASE_DIR / "artifacts"


# =========================================================
# Dataset Windows (Rolling Training Window)
# =========================================================

ZONE_TRAINING_WINDOW_DAYS   = 14
HEALTH_TRAINING_WINDOW_DAYS = 30
CROWD_TRAINING_WINDOW_DAYS  = 14


# =========================================================
# Minimum Dataset Requirements
# =========================================================

MIN_ZONE_SAMPLES            = 1000
MIN_ZONE_POSITIVE_SAMPLES   = 50

MIN_HEALTH_SAMPLES          = 2000
MIN_HEALTH_POSITIVE_SAMPLES = 100

MIN_CROWD_SAMPLES           = 1000


# =========================================================
# Model Switching Thresholds
# =========================================================

ZONE_MODEL_SWITCH_THRESHOLD   = 5000
HEALTH_MODEL_SWITCH_THRESHOLD = 10000
CROWD_MODEL_SWITCH_THRESHOLD  = 20000


# =========================================================
# Confidence Thresholds
# =========================================================

ZONE_HIGH_RISK_PROB_THRESHOLD = 0.7
HEALTH_ANOMALY_THRESHOLD      = 0.8
CROWD_ANOMALY_THRESHOLD       = 0.85


# =========================================================
# Retraining Policy
# =========================================================

RETRAIN_IF_NEW_DATA_PERCENT       = 0.2   # 20% new data growth triggers retrain
DEFAULT_RETRAIN_INTERVAL_HOURS    = 24


# =========================================================
# Model Artifact Configuration
#
# Each domain has two model variants (small + large).
# Each variant has its own model file and metadata file.
# Selectors use these filenames directly — no hardcoding
# inside selector classes.
# =========================================================

@dataclass(frozen=True)
class ModelArtifactConfig:
    name:                    str
    small_model_filename:    str
    large_model_filename:    str
    small_metadata_filename: str   # metadata for the small/fast model
    large_metadata_filename: str   # metadata for the large/accurate model


ZONE_ARTIFACT = ModelArtifactConfig(
    name                    = "zone",
    small_model_filename    = "logistic_v1.pkl",
    large_model_filename    = "xgboost_v1.pkl",
    small_metadata_filename = "zone_logistic_meta.json",
    large_metadata_filename = "zone_xgboost_meta.json",
)

HEALTH_ARTIFACT = ModelArtifactConfig(
    name                    = "health",
    small_model_filename    = "rf_v1.pkl",
    large_model_filename    = "lstm_v1.pt",
    small_metadata_filename = "health_rf_meta.json",
    large_metadata_filename = "health_lstm_meta.json",
)

CROWD_ARTIFACT = ModelArtifactConfig(
    name                    = "crowd",
    small_model_filename    = "isolation_v1.pkl",
    large_model_filename    = "online_v1.pkl",
    small_metadata_filename = "crowd_isolation_meta.json",
    large_metadata_filename = "crowd_online_meta.json",
)