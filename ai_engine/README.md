# 🤖 AI Engine — Sentinel Tour

Internal ML inference service for the Sentinel Tour platform. Exposes a single unified `/predict` endpoint (FastAPI, port `8001`) routing predictions across three domains: **zone risk**, **tourist health**, and **crowd density**. Only the backend API is allowed to call it — all endpoints (except `/health`) require an internal Bearer token.

---

## 📁 Folder Structure

```bash
ai_engine/
├── main.py                     # FastAPI app factory + lifespan (preloads all models at startup)
├── model_registry.py           # Thread-safe ModelRegistry singleton (load/unload/hot-reload)
├── config.py                   # Artifact paths and model config constants
├── api/
│   ├── routes.py               # POST /predict, GET /health, GET /models/status, POST /models/reload
│   └── schemas.py              # PredictionRequest, PredictionSuccessResponse, PredictionErrorResponse
├── core/
│   └── settings.py             # Pydantic settings (SERVICE_VERSION, INTERNAL_TOKEN, artifact paths)
├── inference/
│   ├── engine.py               # AIInferenceEngine — routes domain → predictor, wraps errors
│   ├── zone_predictor.py       # Calls zone model from registry
│   ├── health_predictor.py     # Calls health model from registry
│   └── crowd_predictor.py      # Calls crowd model from registry
├── models/
│   ├── base_model.py           # BaseModel ABC — enforces predict() + metadata interface
│   ├── zone/
│   │   ├── xgboost_model.py    # XGBoost zone risk classifier
│   │   ├── logistic_model.py   # Logistic regression fallback
│   │   └── selector.py         # ZoneModelSelector — picks best model from artifacts dir
│   ├── health/
│   │   ├── lstm_model.py       # LSTM health anomaly detector
│   │   ├── random_forest_model.py  # Random Forest fallback
│   │   └── selector.py
│   └── crowd/
│       ├── isolation_forest_model.py  # Isolation Forest crowd anomaly detector
│       ├── online_model.py            # Online learning model (streaming updates)
│       └── selector.py
├── data/
│   ├── feature_zone.py         # Zone feature extraction and validation
│   ├── feature_health.py       # Health telemetry feature extraction
│   ├── feature_crowd.py        # Crowd density feature extraction
│   └── preprocessing.py        # Shared preprocessing utilities
├── training/
│   ├── zone_trainer.py         # Trains and serialises zone models
│   ├── health_trainer.py       # Trains and serialises health models
│   └── crowd_trainer.py        # Trains and serialises crowd models
├── monitoring/
│   ├── drift_monitor.py        # Compares live feature distribution vs training baseline
│   └── retraining_scheduler.py # Cooldown-gated retraining scheduler
├── tasks/
│   └── ml_retraining_tasks.py  # Celery shared tasks: zone (30min), health (1hr), crowd (20min)
├── artifacts/                  # Persisted model files (mounted as Docker volume)
├── Dockerfile
├── requirements.txt
├── requirements.lock.txt
└── .env.docker
```

---

## ⚙️ Environment Variables (`.env.docker`)

| Variable | Description |
| ---------- | ------------- |
| `SERVICE_VERSION` | Version string returned by `/health` |
| `INTERNAL_TOKEN` | Bearer token required by all non-health endpoints |
| `ARTIFACTS_DIR` | Path to model artifacts directory (default `/app/artifacts`) |
| `ZONE_ARTIFACT` | Subdirectory name for zone model artifacts |
| `HEALTH_ARTIFACT` | Subdirectory name for health model artifacts |
| `CROWD_ARTIFACT` | Subdirectory name for crowd model artifacts |

---

## 🚀 Running

### With Docker Compose (recommended)

```bash
# From repo root
docker compose up ai-engine
```

### Standalone

```bash
cd ai_engine
pip install -r requirements.txt
gunicorn main:app -k uvicorn.workers.UvicornWorker -w 2 -b 0.0.0.0:8001
```

> `main:app` is correct — `main.py` is at the root of `/app` and `PYTHONPATH=/app`.

---

## 🔌 API Endpoints

| Method | Endpoint | Auth | Description |
| -------- | ---------- | ------ | ------------- |
| `POST` | `/predict` | Internal token | Unified prediction (zone / health / crowd) |
| `GET` | `/health` | None | Health check — used by Docker HEALTHCHECK |
| `GET` | `/models/status` | Internal token | Loaded model versions and status per domain |
| `POST` | `/models/reload` | Internal token | Hot-reload all models without restart |

### Auth

All non-health endpoints require:

```text
Authorization: Bearer <INTERNAL_TOKEN>
```

CORS is restricted to `http://localhost:8000` and `http://backend:8000` — no other origin can call this service.

---

### `POST /predict`

Unified prediction request for all three domains:

```json
{
  "domain": "zone",
  "features": {
    "incident_count": 3,
    "sos_count": 1,
    "tourist_density": 42
  }
}
```

Success response:

```json
{
  "status": "success",
  "domain": "zone",
  "prediction": {
    "risk_level": "HIGH",
    "risk_score": 0.82
  }
}
```

Error response:

```json
{
  "status": "error",
  "domain": "zone",
  "message": "Missing required feature: incident_count"
}
```

Supported `domain` values: `"zone"` | `"health"` | `"crowd"`

---

## 🧠 Model Architecture

### Domain: `zone`

Predicts zone risk level based on incident history, SOS count, and tourist density.

| Model | Algorithm | When Selected |
| ------- | ----------- | -------------- |
| `XGBoostZoneModel` | XGBoost classifier | Primary (higher metadata score) |
| `LogisticZoneModel` | Logistic Regression | Fallback if XGBoost artifact missing |

### Domain: `health`

Detects health anomalies from wristband telemetry (HR, SpO₂, temperature).

| Model | Algorithm | When Selected |
| ------- | ----------- | -------------- |
| `LSTMHealthModel` | LSTM sequence model | Primary |
| `RandomForestHealthModel` | Random Forest | Fallback |

### Domain: `crowd`

Detects unusual crowd density patterns at tourist zones.

| Model | Algorithm | When Selected |
| ------- | ----------- | -------------- |
| `IsolationForestCrowdModel` | Isolation Forest | Primary |
| `OnlineCrowdModel` | Online learning (streaming) | When real-time adaptation needed |

---

## 🔄 Model Lifecycle

```text
App startup (lifespan)
    → model_registry.load_all()
        → ZoneModelSelector.load_best_model()     → cached in memory
        → HealthModelSelector.load_best_model()   → cached in memory
        → CrowdModelSelector.load_best_model()    → cached in memory

POST /predict
    → AIInferenceEngine.predict(domain, features)
    → routes to ZonePredictor / HealthPredictor / CrowdPredictor
    → predictor calls model_registry.get_<domain>_model()
    → returns prediction dict

POST /models/reload  (hot reload — no restart needed)
    → model_registry.reload_all()  [thread-safe RLock]
    → old models swapped atomically

App shutdown (lifespan)
    → model_registry.unload_all()  (free memory cleanly)
```

ModelRegistry uses `threading.RLock` — safe for Gunicorn multi-worker access.

---

## 📉 Drift Monitoring & Retraining

`DriftMonitor` computes a normalised drift score by comparing live feature distributions against the training baseline stored in model metadata (`baseline_feature_mean`, `baseline_feature_std`). Alert threshold: **0.35**.

Retraining is triggered by Celery Beat scheduled tasks (defined in `tasks/ml_retraining_tasks.py`):

| Task | Schedule | Queue |
| ------ | ---------- | ------- |
| `zone_retraining_task` | Every 30 minutes | `ml` |
| `health_retraining_task` | Every hour | `ml` |
| `crowd_retraining_task` | Every 20 minutes | `ml` |

Retraining is cooldown-gated via `RetrainingScheduler` — prevents back-to-back retraining if drift was transient. After training completes, the new model artifact is saved to `artifacts/` and `POST /models/reload` is called automatically.

> **Note:** `RetrainingScheduler` state is in-memory and per-worker. For true cross-worker cooldown enforcement, store `last_retrain_time` in Redis under `ml:cooldown:{model_name}`.
