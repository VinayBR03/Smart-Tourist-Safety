# 🛡️ Sentinel Tour — Smart Tourist Safety System

[![Python](https://img.shields.io/badge/Python-48.0%25-3776AB?logo=python&logoColor=white)](https://python.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-40.4%25-3178C6?logo=typescript&logoColor=white)](https://typescriptlang.org)
[![C++](https://img.shields.io/badge/C++-8.5%25-00599C?logo=c%2B%2B&logoColor=white)](https://isocpp.org)
[![C](https://img.shields.io/badge/C-1.2%25-A8B9CC?logo=c&logoColor=white)](https://en.wikipedia.org/wiki/C_\(programming_language\))
[![CSS](https://img.shields.io/badge/CSS-0.7%25-1572B6?logo=css3&logoColor=white)](https://www.w3.org/Style/CSS/)
[![Go](https://img.shields.io/badge/Go-0.4%25-00ADD8?logo=go&logoColor=white)](https://golang.org)
[![Other](https://img.shields.io/badge/Other-0.8%25-lightgrey.svg)](.)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](docker-compose.yml)

---

## 📖 Overview

**Sentinel Tour** is a comprehensive real-time safety monitoring and incident response platform designed to protect tourists across India — especially in remote, high-traffic, and high-risk zones. Built for the Ministry of Tourism and Ministry of Home Affairs (in collaboration with State Police Departments and NIC), the system integrates cutting-edge AI/ML, blockchain identity management, IoT wearable telemetry, and geo-fencing into a unified digital ecosystem.

### The Problem

Traditional policing and manual tracking are insufficient for remote tourist areas. Existing emergency and FIR systems lack integration, multilingual support, and real-time monitoring — leading to dangerously slow incident response times.

### The Solution

Sentinel Tour delivers:

- **Instant SOS emergency dispatch** with GPS location broadcasting
- **Blockchain-based digital tourist ID** issued at entry points (airports, hotels, check-posts)
- **AI-powered geo-fencing alerts** when tourists enter high-risk or restricted zones
- **Real-time admin dashboard** for police and tourism departments
- **IoT wearable telemetry** via MQTT for health and location signals
- **Automated evidence logging** and tamper-proof FIR workflows

---

## 🏗️ Architecture

```text
┌────────────────────────────────────────────────────────────────────┐
│                         Sentinel Tour                              │
├──────────────┬──────────────┬─────────────┬────────────────────────┤
│  Tourist App │ Web Dashboard│  IoT Bands  │   Admin / Police UI    │
│  (Mobile)    │  (TypeScript)│  (C++/C)    │   (TypeScript)         │
└──────┬───────┴──────┬───────┴──────┬──────┴─────────────┬──────────┘
       │         WebSocket           │ MQTT               │
       │         (Redis pub/sub)     │                    │
       │              │         ┌────▼───────┐            │
       │              │         │  Mosquitto │            │
       │              │         │  (MQTT)    │            │
       │              │         └────┬───────┘            │
       │              │         ┌────▼───────┐            │
       │              │         │ MQTT       │            │
       │              │         │ Ingestion  │            │
       │              │         │   (Go)     │            │
       │              │         └────┬───────┘            │
       │         ┌────▼──────────────▼────────────────┐   │
       │         │          Kafka Event Bus           │   │
       │         └──────┬─────────────────────────────┘   │
       │                │  (publish + consume)            │
       │         ┌──────▼─────────────────────────────┐   │
       └────────►│       Backend API (FastAPI)        │◄──┘
                 │   Celery Workers + Celery Beat     │
                 └─────┬──────────┬───────────┬───────┘
                       │          │           │
              ┌────────▼──────┐  ┌▼────────┐ ┌▼───────────────────┐
              │   AI Engine   │  │  Redis  │ │  PostgreSQL 16     │
              │  (Python/ML)  │  │  Cache  │ │  + PostGIS         │
              └───────────────┘  └─────────┘ │  + TimescaleDB     │
                       │                     └────────────────────┘
              ┌────────▼──────────┐
              │   Blockchain      │  ┌──────────────┐
              │  (Digital ID /    │  │   AWS S3     │
              │   Tamper-proof    │  │ (Media/Docs) │
              │   FIR storage)    │  └──────────────┘
              └───────────────────┘
```

---

## 📁 Repository Structure

```bash
Smart-Tourist-Safety/
├── ai_engine/          # Python ML service — geo-fencing, anomaly detection, risk scoring
├── backend/            # FastAPI REST API + Celery task workers
├── blockchain/         # Smart contracts & blockchain-based digital tourist ID
├── devops/             # CI/CD pipelines, Kubernetes manifests, Helm charts
├── docs/               # Architecture, API reference, setup guides
│   ├── architecture.md
│   ├── api-reference.md
│   ├── setup-guide.md
│   ├── deployment.md
│   └── contributing.md
├── frontend/           # TypeScript web dashboard for admins and police
├── iot/                # C++/C firmware for IoT wearable safety bands
├── mosquitto/          # Eclipse Mosquitto MQTT broker configuration
├── mqtt_ingestion/     # Go service — bridges MQTT telemetry into Kafka
├── .gitignore
├── docker-compose.yml  # Full-stack local orchestration
└── README.md
```

---

## 🚀 Quick Start

### Prerequisites

| Tool | Version |
| ------ | --------- |
| Docker | 24+ |
| Docker Compose | v2.20+ |
| Git | Any |

> **Note:** For IoT firmware development, you additionally need Arduino IDE or PlatformIO with ESP32 board support. For blockchain, install Node.js 18+ and Hardhat.

### 1. Clone the Repository

```bash
git clone https://github.com/VinayBR03/Smart-Tourist-Safety.git
cd Smart-Tourist-Safety
```

### 2. Configure Environment Variables

Each service has its own `.env` file. Copy the sample files and fill in your secrets:

```bash
cp ai_engine/.env.example ai_engine/.env.docker
cp backend/.env.example  backend/.env.docker
```

Key variables to set:

| Variable | Description |
| ---------- | ------------- |
| `DATABASE_URL` | TimescaleDB connection string |
| `REDIS_URL` | Redis connection string |
| `KAFKA_BROKERS` | Kafka broker addresses |
| `FIREBASE_SERVICE_ACCOUNT` | Path to Firebase Admin SDK JSON |
| `BLOCKCHAIN_RPC_URL` | Blockchain node RPC endpoint |
| `JWT_SECRET` | Backend JWT signing secret |

### 3. Place Firebase Service Account

```bash
cp /path/to/your-firebase-adminsdk.json \
   backend/app/secrets/sentinel-tour-firebase-adminsdk-fbsvc-c87847b6c7.json
```

### 4. Start All Services

```bash
docker compose up --build
```

Services start in dependency order. Full startup takes ~60 seconds on first run.

### 5. Verify Health

```bash
curl http://localhost:8000/health    # Backend API
curl http://localhost:8001/health    # AI Engine
open http://localhost:80           # Web Dashboard
```

---

## 🧩 Service Overview

| Service | Language | Port | Description |
| --------- | ---------- | ------ | ------------- |
| `backend` | Python (FastAPI) | 8000 | Core REST API, auth, incident management |
| `celery` | Python (Celery) | — | Background task worker (alerts, FIR dispatch) |
| `celery-beat` | Python (Celery) | — | Periodic task scheduler |
| `ai-engine` | Python (ML) | 8001 | Geo-fencing, risk scoring, anomaly detection |
| `mqtt-ingestion` | Go | — | MQTT → Kafka IoT telemetry bridge |
| `web-dashboard` | TypeScript | 80 | Admin and police monitoring dashboard |
| `postgres` | TimescaleDB | 5432 | Primary time-series database |
| `redis` | Redis | 6379 | Cache, session store, Celery broker |
| `mosquitto` | Eclipse MQTT | 1883 | MQTT broker for IoT devices |
| `kafka` | Confluent Kafka | 9092 | Event streaming backbone |
| `zookeeper` | Zookeeper | 2181 | Kafka cluster coordination |

---

## 🔑 Key Features

- **🆔 Blockchain Digital Tourist ID** — Immutable KYC-verified ID issued at entry points; stores trip itinerary and emergency contacts; valid only for the duration of the visit
- **📍 Real-Time Geo-Fencing** — Configurable safe-zone boundaries with instant push alerts when breached
- **🤖 AI Safety Score** — Continuously updated score based on travel patterns, zone sensitivity, and historical incident data
- **🆘 One-Tap SOS** — Emergency alert with live GPS broadcast to nearest police station and emergency contacts
- **📡 IoT Wearable Integration** — Smart bands transmit health signals and location over MQTT; manual SOS button onboard
- **📊 Admin Dashboard** — Live heatmaps, incident timelines, and resource dispatch tools for police and tourism departments
- **🔒 Tamper-Proof FIR** — Blockchain-logged evidence ensures integrity from report to resolution
- **🌐 Multilingual Ready** — Architecture supports 10+ Indian languages and English

---

## 🛠️ Technology Stack

### Backend & AI

- **FastAPI** — High-performance async REST framework
- **Celery + Celery Beat** — Distributed background task processing
- **TimescaleDB (PostgreSQL 16)** — Time-series data for telemetry and incident logs
- **Redis 7** — Caching, pub/sub, Celery broker
- **Apache Kafka** — High-throughput event streaming
- **Firebase Admin SDK** — Push notifications and authentication

### AI / ML

- Python ML stack (scikit-learn, TensorFlow/PyTorch)
- Custom geo-fencing boundary algorithms
- Anomaly detection for crowd density and unusual movement patterns
- Predictive risk scoring models

### Blockchain

- Solidity smart contracts
- Decentralized digital ID management
- Tamper-proof EFIR (Electronic FIR) storage

### IoT

- C++/C firmware for ESP32-based wearable bands
- MQTT protocol over Eclipse Mosquitto broker
- Go MQTT-to-Kafka ingestion microservice

### Frontend

- TypeScript + React web dashboard
- Real-time WebSocket updates
- Nginx serving in Docker

---

## 📚 Documentation

| Document | Description |
| ---------- | ------------- |
| [Architecture](docs/architecture.md) | System design, data flows, and component interactions |
| [API Reference](docs/api-reference.md) | REST API endpoints, request/response schemas |
| [Setup Guide](docs/setup-guide.md) | Detailed local development setup instructions |
| [Deployment](docs/deployment.md) | Docker Compose, Kubernetes, and cloud deployment |
| [Contributing](docs/contributing.md) | Branch strategy, code style, and PR guidelines |

---

## 🤝 Contributing

We welcome contributions! Please read [CONTRIBUTING](docs/contributing.md) before opening a pull request.

```bash
# Create a feature branch
git checkout -b feature/your-feature-name

# Make changes and commit
git commit -m "feat: describe your change"

# Push and open a PR
git push origin feature/your-feature-name
```

---

## 📜 License

This project is licensed under the **MIT License** — see [LICENSE](LICENSE) for details.

---

> *"Sentinel Tour — bridging technology and safety for every traveller."*
