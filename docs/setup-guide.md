# 🛠️ Setup Guide — Sentinel Tour

This guide walks through setting up Sentinel Tour for local development from scratch.

---

## Prerequisites

| Tool | Version | Install |
| ------ | --------- | --------- |
| Git | Any | [git-scm.com](https://git-scm.com) |
| Docker | 24+ | [docs.docker.com](https://docs.docker.com/get-docker/) |
| Docker Compose | v2.20+ | Bundled with Docker Desktop |
| Python | 3.11+ | Only for running services without Docker |
| Node.js | 18+ | Only for frontend / blockchain dev |
| Go | 1.21+ | Only for MQTT ingestion dev |
| PlatformIO | Latest | Only for IoT firmware dev |

---

## 1. Clone the Repository

```bash
git clone https://github.com/VinayBR03/Smart-Tourist-Safety.git
cd Smart-Tourist-Safety
```

---

## 2. Set Up Environment Variables

Each service requires its own `.env.docker` file. Start by copying the examples:

```bash
cp ai_engine/.env.example   ai_engine/.env.docker
cp backend/.env.example     backend/.env.docker
```

### Backend `.env.docker` (fill these in)

```env
# Database
DATABASE_URL=postgresql+asyncpg://tourist_user:strongpassword@postgres:5432/tourist_safety_db

# Redis
REDIS_URL=redis://redis:6379/0
CELERY_BROKER_URL=redis://redis:6379/0
CELERY_RESULT_BACKEND=redis://redis:6379/1

# Kafka
KAFKA_BROKERS=kafka:29092

# JWT
JWT_SECRET=replace-with-a-long-random-secret
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=60

# Firebase
FIREBASE_CREDENTIALS_PATH=/app/app/secrets/firebase-service-account.json

# AI Engine
AI_ENGINE_URL=http://ai-engine:8001

# Blockchain
BLOCKCHAIN_RPC_URL=http://localhost:8545
BLOCKCHAIN_TOURIST_ID_CONTRACT=0xYourContractAddress
BLOCKCHAIN_INCIDENT_REGISTRY_CONTRACT=0xYourContractAddress
BLOCKCHAIN_PRIVATE_KEY=0xYourPrivateKey
```

### AI Engine `.env.docker` (fill these in)

```env
AI_ENGINE_PORT=8001
REDIS_URL=redis://redis:6379/1
KAFKA_BROKERS=kafka:29092
KAFKA_TOPIC_TELEMETRY=iot.telemetry
MODEL_ARTIFACTS_PATH=/app/artifacts
LOG_LEVEL=INFO
```

---

## 3. Firebase Setup

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Create a project (or use an existing one)
3. Navigate to Project Settings → Service Accounts
4. Click **Generate new private key** — download the JSON file
5. Place it at:

```bash
cp /path/to/downloaded-key.json \
   backend/app/secrets/sentinel-tour-firebase-adminsdk-fbsvc-c87847b6c7.json
```

> This path is gitignored. Never commit the service account JSON.

---

## 4. Mosquitto Credentials

Set up MQTT auth for the broker:

```bash
# Create the passwd file
docker run --rm -it eclipse-mosquitto:2 \
  mosquitto_passwd -c /dev/stdout iot_device_user > mosquitto/passwd

docker run --rm -it eclipse-mosquitto:2 \
  mosquitto_passwd /dev/stdout ingestion_service >> mosquitto/passwd
```

Or manually for local dev, set `allow_anonymous true` in `mosquitto/mosquitto.conf` (not for production).

---

## 5. Start All Services

```bash
docker compose up --build
```

On first run, Docker will pull base images and build all service containers. This takes 3–5 minutes. Subsequent starts are much faster.

Watch the logs:

```bash
docker compose logs -f backend ai-engine
```

---

## 6. Initialize the Database

Run database migrations after the postgres container is healthy:

```bash
docker compose exec backend alembic upgrade head
```

---

## 7. Verify Everything Is Running

```bash
# Backend API
curl http://localhost:8000/health

# AI Engine
curl http://localhost:8001/health

# Web Dashboard
open http://localhost:3000

# Check all containers
docker compose ps
```

Expected output for health checks:

```json
{ "status": "healthy", "database": "connected", "redis": "connected", "kafka": "connected" }
```

---

## 8. Optional: Blockchain Local Node

For development with smart contracts:

```bash
cd blockchain
npm install

# Start local Hardhat node
npx hardhat node

# In another terminal, deploy contracts
npx hardhat run scripts/deploy.js --network localhost
```

Copy the deployed contract addresses into your `backend/.env.docker`.

---

## 9. Optional: IoT Firmware

To simulate an IoT device without physical hardware:

```bash
# Install Mosquitto client tools
brew install mosquitto    # macOS
sudo apt install mosquitto-clients   # Ubuntu

# Simulate a wearable publishing location
mosquitto_pub -h localhost -p 1883 \
  -t "crowdguard/BAND-SIM-01/location" \
  -m '{"lat":27.1751,"lng":78.0421,"accuracy":5,"timestamp":1700000000}'
```

---

## Service URLs Summary

| Service | URL |
| --------- | ----- |
| Backend API | `http://localhost:8000` |
| Swagger UI | `http://localhost:8000/docs` |
| AI Engine | `http://localhost:8001` |
| Web Dashboard | `http://localhost:3000` |
| PostgreSQL | `localhost:5432` |
| Redis | `localhost:6379` |
| Kafka | `localhost:9092` |
| Mosquitto MQTT | `localhost:1883` |

---

## Troubleshooting

### Kafka not starting

Kafka depends on Zookeeper. If Zookeeper health check fails:

```bash
docker compose restart zookeeper
docker compose up kafka
```

### Backend can't connect to database

Run migrations manually after postgres is healthy:

```bash
docker compose exec postgres pg_isready -U tourist_user
docker compose exec backend alembic upgrade head
```

### AI Engine OOM (out of memory)

Increase Docker memory limit in Docker Desktop settings (recommend 6GB+ for full stack).

### MQTT ingestion logs "connection refused"

Mosquitto takes ~5s to start. The ingestion service retries automatically — wait 15 seconds and check logs again:

```bash
docker compose logs mqtt-ingestion
```
