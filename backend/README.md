# 🖥️ Backend — Sentinel Tour

Core REST API for the Sentinel Tour platform. Built with **FastAPI** + **SQLAlchemy** on **TimescaleDB**, with **Celery** for background tasks, **Kafka** for IoT telemetry ingestion, and **Redis** for real-time pub/sub. All major integrations are **feature-flag controlled** — the backend runs with only a database if needed.

---

## 📁 Folder Structure

```bash
backend/
├── app/
│   ├── main.py                         # FastAPI app, lifespan (Kafka consumer + Redis listener)
│   ├── core/
│   │   ├── config.py                   # Pydantic settings — all env vars + feature toggle validation
│   │   ├── celery_app.py               # Celery config, task routing (6 queues), beat schedule
│   │   ├── database.py                 # SQLAlchemy engine, SessionLocal, TimescaleDB setup
│   │   ├── redis.py                    # Redis connection pool
│   │   ├── kafka.py                    # Kafka producer/consumer setup
│   │   ├── websocket_manager.py        # WebSocket connection manager (notifications + live feed)
│   │   ├── security.py                 # Password hashing, JWT creation/verification
│   │   ├── idempotency.py              # Idempotency key deduplication (Redis-backed)
│   │   ├── rate_limiter.py             # Sliding-window rate limiter (Redis-backed)
│   │   ├── middleware.py               # AppMiddleware (request ID, logging, error handling)
│   │   ├── transaction_manager.py      # DB transaction context manager
│   │   ├── s3_client.py                # AWS S3 client (ENABLE_S3 feature flag)
│   │   ├── enums.py                    # Shared enums (roles, statuses, alert types)
│   │   └── exceptions.py              # Custom HTTP exceptions
│   ├── routers/                        # One file per domain
│   │   ├── auth.py                     # /auth — login, register, refresh, logout
│   │   ├── tourist.py                  # /tourist — tourist profile, digital ID
│   │   ├── incident.py                 # /incidents — CRUD, status updates, assignments
│   │   ├── location.py                 # /location — GPS updates, location history
│   │   ├── zone.py                     # /zones — geo-fence CRUD, risk levels
│   │   ├── iot.py                      # /iot — IoT gateway (health + SOS from mobile app)
│   │   ├── device.py                   # /devices — IoT device registration and management
│   │   ├── health.py                   # /health — health telemetry queries
│   │   ├── media.py                    # /media — S3 media upload/download
│   │   ├── notification.py             # /notifications — push notification management
│   │   ├── analytics.py                # /analytics — aggregate stats and charts
│   │   ├── user_admin.py               # /admin/users — user management (ADMIN only)
│   │   ├── websocket.py                # /ws — WebSocket upgrade endpoints
│   │   └── internal.py                 # /internal — service-to-service endpoints
│   ├── models/                         # SQLAlchemy ORM models
│   │   ├── user.py
│   │   ├── incident.py
│   │   ├── incident_assignment.py
│   │   ├── incident_status_history.py
│   │   ├── zone.py
│   │   ├── zone_status.py
│   │   ├── zone_risk_history.py
│   │   ├── iot_device.py
│   │   ├── device_assignment.py
│   │   ├── health_telemetry.py         # TimescaleDB hypertable
│   │   ├── location.py                 # TimescaleDB hypertable
│   │   ├── location_event.py
│   │   ├── media.py
│   │   ├── notification.py
│   │   ├── refresh_token.py
│   │   ├── event_outbox.py             # Transactional outbox pattern
│   │   └── audit_log.py
│   ├── schemas/                        # Pydantic request/response schemas
│   ├── services/                       # Business logic (one service per domain)
│   │   ├── auth_service.py
│   │   ├── tourist_service.py
│   │   ├── incident_service.py
│   │   ├── zone_service.py
│   │   ├── geofence_service.py         # Geo-fence evaluation (calls AI engine)
│   │   ├── risk_engine_service.py      # Zone risk score computation
│   │   ├── health_monitor_service.py   # Health alert evaluation
│   │   ├── crowd_monitor_service.py    # Crowd density monitoring
│   │   ├── iot_service.py              # IoT gateway forwarding
│   │   ├── device_service.py
│   │   ├── location_service.py
│   │   ├── media_service.py            # S3 upload/download
│   │   ├── notification_service.py     # Notification dispatch
│   │   ├── push_service.py             # Firebase FCM push
│   │   ├── email_service.py            # SMTP email
│   │   ├── sms_service.py              # SMS gateway
│   │   ├── blockchain_service.py       # web3.py → all 6 ledger contracts
│   │   ├── analytics_service.py
│   │   ├── audit_service.py
│   │   ├── assignment_service.py
│   │   ├── outbox_service.py           # Transactional outbox publisher
│   │   ├── realtime_service.py         # WebSocket fan-out
│   │   ├── internal_ml_service.py      # HTTP client → AI engine /predict
│   │   ├── dataset_service.py          # Training data export for AI engine
│   │   ├── feature_service.py          # Feature vector assembly
│   │   ├── cleanup_service.py          # Expired account deletion
│   │   ├── role_permission_service.py
│   │   ├── throttle_service.py
│   │   └── user_service.py
│   ├── tasks/                          # Celery async tasks
│   │   ├── account_tasks.py            # queue: maintenance
│   │   ├── device_tasks.py             # queue: device
│   │   ├── notification_tasks.py       # queue: notification
│   │   ├── zone_tasks.py               # queue: risk
│   │   ├── outbox_tasks.py             # queue: outbox
│   │   ├── analytics_tasks.py
│   │   ├── incident_tasks.py
│   │   └── cleanup_tasks.py
│   ├── workers/
│   │   └── kafka_consumer.py           # Async Kafka consumer (IoT telemetry ingestion)
│   ├── realtime/
│   │   └── redis_listener.py           # Async Redis pub/sub → WebSocket fan-out
│   ├── templates/
│   │   ├── email_template.py           # Email renderer
│   │   └── locales/                    # Translated strings: en, hi, kn, ml, ta, te
│   ├── utils/
│   │   ├── helpers.py
│   │   └── logger.py
│   └── secrets/                        # Firebase Admin SDK JSON (gitignored)
├── alembic/                            # Database migrations
│   └── versions/                       # 11 migration files
├── Dockerfile
├── requirements.txt
├── requirements.lock.txt
├── alembic.ini
└── pytest.ini
```

---

## ⚙️ Feature Toggles

The backend is **fully modular** — integrations are enabled via environment variables. The service starts with only `DATABASE_URL` required.

| Toggle | Default | Enables |
| -------- | --------- | --------- |
| `ENABLE_REDIS` | `False` | Redis cache, rate limiter, WebSocket pub/sub, idempotency |
| `ENABLE_KAFKA` | `False` | Kafka consumer for IoT telemetry |
| `ENABLE_CELERY` | `False` | Celery task workers (fallback asyncio loops used when disabled) |
| `ENABLE_S3` | `False` | AWS S3 media upload/download |
| `ENABLE_PUSH` | `False` | Firebase FCM push notifications |
| `ENABLE_SMS` | `False` | SMS gateway alerts |
| `ENABLE_RATE_LIMITER` | `False` | Redis-backed sliding-window rate limiting |
| `ENABLE_WEBSOCKETS` | `True` | WebSocket endpoints |
| `ML_ENGINE_ENABLED` | `False` | Calls AI engine `/predict` for risk scoring |

> When `ENABLE_CELERY=False`, the backend runs cleanup and notification dispatch via asyncio background tasks in the lifespan.

---

## ⚙️ Key Environment Variables

| Variable | Description |
| ---------- | ------------- |
| `DATABASE_URL` | `postgresql+psycopg2://tourist_user:password@postgres:5432/tourist_safety_db` |
| `ENVIRONMENT` | `development` \| `production` \| `testing` |
| `JWT_SECRET_KEY` | Access token signing secret |
| `JWT_REFRESH_SECRET_KEY` | Refresh token signing secret |
| `INTERNAL_SERVICE_TOKEN` | Token for service-to-service calls (`/internal` routes) |
| `REDIS_HOST` | Required when `ENABLE_REDIS=True` |
| `KAFKA_BOOTSTRAP_SERVERS` | Required when `ENABLE_KAFKA=True` |
| `CELERY_BROKER_URL` | Required when `ENABLE_CELERY=True` |
| `ML_ENGINE_URL` | URL of AI engine (default `http://ai-engine:8001`) |
| `ML_ENGINE_TIMEOUT_SECONDS` | Timeout for AI engine calls (default `3`) |
| `AWS_S3_BUCKET` | Required when `ENABLE_S3=True` |
| `FCM_SERVICE_ACCOUNT_JSON` | Path to Firebase Admin SDK JSON, required when `ENABLE_PUSH=True` |

---

## 🚀 Running

### With Docker Compose (recommended)

```bash
docker compose up backend celery celery-beat
```

### Database Migrations

```bash
docker compose exec backend alembic upgrade head

# New migration
alembic revision --autogenerate -m "describe change"
```

### Standalone Dev

```bash
cd backend
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

Swagger UI: `http://localhost:8000/docs`

---

## 🔌 Routers

| Prefix | Router | Auth |
| -------- | -------- | ------ |
| `/auth` | `auth.py` | Public |
| `/tourist` | `tourist.py` | JWT |
| `/incidents` | `incident.py` | JWT |
| `/location` | `location.py` | JWT |
| `/zones` | `zone.py` | JWT |
| `/iot` | `iot.py` | JWT (tourist) |
| `/devices` | `device.py` | JWT |
| `/health` | `health.py` | JWT |
| `/media` | `media.py` | JWT |
| `/notifications` | `notification.py` | JWT |
| `/analytics` | `analytics.py` | JWT (admin/police) |
| `/admin/users` | `user_admin.py` | JWT + ADMIN role |
| `/ws` | `websocket.py` | JWT (via query param) |
| `/internal` | `internal.py` | `INTERNAL_SERVICE_TOKEN` |

---

## ⚡ Celery

### Queues & Task Routing

| Queue | Tasks |
| ------- | ------- |
| `default` | Unrouted tasks |
| `maintenance` | `account_tasks.*` — expired account deletion |
| `device` | `device_tasks.*` — device health checks |
| `notification` | `notification_tasks.*` — push / email / SMS dispatch |
| `risk` | `zone_tasks.*` — zone risk score updates |
| `outbox` | `outbox_tasks.*` — transactional outbox publisher |
| `ml` | `ml_retraining_tasks.zone_retraining_task` |

Start worker with all queues:

```bash
celery -A app.core.celery_app.celery_app worker \
  --queues=default,maintenance,device,notification,risk,outbox,ml \
  --concurrency=4
```

### Beat Schedule

| Task | Schedule |
| ------ | ---------- |
| `delete_expired_accounts_task` | Every hour |
| `zone_retraining_task` | Every 30 minutes |
| `health_retraining_task` | Every hour |
| `crowd_retraining_task` | Every 20 minutes |
| `process_notifications_task` | Every 10 seconds |

---

## 🗄️ Database

**TimescaleDB (PostgreSQL 16)** — time-series hypertables for:

- `health_telemetry` — IoT wristband HR, SpO₂, temperature readings
- `location` — tourist GPS history

**11 Alembic migrations** tracking schema evolution from initial schema through IoT, health telemetry, blockchain tx hash, and language preference additions.

---

## 🌐 WebSocket

Two WebSocket endpoints (managed by `WebSocketManager`):

| Endpoint | Audience | Events |
| ---------- | ---------- | -------- |
| `ws /ws/notifications` | Any authenticated user | Personal push notifications |
| `ws /ws/authority/live` | Police / Admin | Live tourist locations, SOS, zone breaches |

Real-time events flow: `Redis pub/sub → redis_listener.py → WebSocketManager.broadcast()`

---

## ⛓️ Blockchain Integration

Every critical state change is logged to a blockchain ledger contract via `blockchain_service.py` (`web3.py`). Failures are silently swallowed — a `blockchain_error:...` string is stored instead of a tx hash, so backend flow is never blocked.

Contracts called: `IncidentLedger`, `ZoneLedger`, `AuditLedger`, `AssignmentLedger`, `HealthAlertLedger`, `EvidenceLedger`.

---

## 🌐 Multilingual

Email and notification templates support 6 languages via `app/templates/locales/`:
`en` · `hi` · `kn` · `ml` · `ta` · `te`

Language is stored per-user (`preferred_language` column) and resolved at notification dispatch time.

---

## 🧪 Testing

```bash
pytest --cov=app --cov-report=html
```
