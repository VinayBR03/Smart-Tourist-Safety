# 🏗️ System Architecture — Sentinel Tour

This document describes the architecture of the Sentinel Tour platform: component responsibilities, data flows, communication protocols, and design decisions.

---

## High-Level Overview

Sentinel Tour is a distributed, event-driven system composed of six application layers:

| Layer | Components |
| ------- | ----------- |
| **Presentation** | TypeScript Web Dashboard, Tourist Mobile App (future) |
| **API** | FastAPI Backend, Celery workers |
| **Intelligence** | Python AI Engine (ML inference service) |
| **Identity** | Blockchain smart contracts (Solidity) |
| **Telemetry** | IoT Firmware (C++/C) → MQTT → Go Ingestion → Kafka |
| **Data** | TimescaleDB, Redis, Kafka |

---

## Component Diagram

```text
┌──────────────────────────────────────────────────────────────────────┐
│  Presentation Layer                                                  │
│  ┌──────────────────────┐    ┌──────────────────────────────────┐   │
│  │   Web Dashboard      │    │   Tourist Mobile App (future)    │   │
│  │  (TypeScript/React)  │    │   (React Native / Flutter)       │   │
│  └──────────┬───────────┘    └──────────────────┬───────────────┘   │
└─────────────┼────────────────────────────────────┼───────────────────┘
              │ HTTPS / WebSocket                  │ HTTPS
              ▼                                    ▼
┌──────────────────────────────────────────────────────────────────────┐
│  API Layer                                                           │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              Backend API (FastAPI, port 8000)                 │   │
│  │   Auth │ Tourists │ SOS │ Incidents │ Geo-fences │ Dashboard  │   │
│  └──────┬────────┬──────────────┬─────────────────┬─────────────┘   │
│         │        │              │                 │                  │
│    ┌────▼──┐  ┌──▼────────┐  ┌─▼──────────┐   ┌─▼──────────────┐   │
│    │ Redis │  │ Celery    │  │ Kafka      │   │ AI Engine      │   │
│    │ Cache │  │ Workers   │  │ Producer   │   │ HTTP Client    │   │
│    └───────┘  └──┬────────┘  └────────────┘   └────────────────┘   │
└───────────────────┼──────────────────────────────────────────────────┘
                    │ async tasks
┌───────────────────┼──────────────────────────────────────────────────┐
│  Intelligence Layer                │                                  │
│                    │          ┌────▼──────────────────────────────┐  │
│                    │          │  AI Engine (Python, port 8001)    │  │
│                    │          │  Geo-fence │ Risk Score │ Anomaly │  │
│                    │          └────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│  Identity Layer                                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Blockchain (Solidity Smart Contracts)                       │   │
│  │  TouristID.sol │ IncidentRegistry.sol │ AccessControl.sol    │   │
│  └──────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│  IoT Telemetry Layer                                                  │
│  ┌──────────────┐      ┌───────────────┐      ┌───────────────────┐  │
│  │ IoT Wearable │─────►│   Mosquitto   │─────►│ MQTT Ingestion   │  │
│  │ (ESP32 C++)  │ MQTT │  MQTT Broker  │ MQTT │   Service (Go)   │  │
│  └──────────────┘      └───────────────┘      └────────┬──────────┘  │
│                                                         │ Kafka       │
│                                                    ┌────▼──────────┐  │
│                                                    │  Kafka Topics │  │
│                                                    │ iot.telemetry │  │
│                                                    └───────────────┘  │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│  Data Layer                                                           │
│  ┌──────────────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │  TimescaleDB     │  │    Redis 7   │  │   Kafka / Zookeeper    │  │
│  │  (PostgreSQL 16) │  │  Cache/Queue │  │   Event Streaming      │  │
│  └──────────────────┘  └──────────────┘  └────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Key Data Flows

### 1. Tourist Registration & Digital ID Issuance

```text
Tourist presents KYC (Aadhaar/Passport) at entry point
    → Backend validates and creates tourist record in TimescaleDB
    → Backend calls blockchain_client.mintID()
    → Smart contract TouristID.sol mints ERC-721 token
    → Token ID returned, QR code generated
    → Firebase push notification sent to tourist with QR
```

### 2. SOS Emergency Dispatch

```text
Tourist presses SOS (app or IoT band button)
    → Backend POST /api/v1/sos/trigger receives request
    → Celery task alert_dispatch.py fires immediately:
        ├─ Firebase FCM push to nearest police station
        ├─ SMS gateway alert to emergency contacts
        ├─ WebSocket broadcast to admin dashboard
        └─ Incident logged in TimescaleDB
    → AI Engine auto-assigns incident severity
    → Blockchain logs incident hash via IncidentRegistry.sol
```

### 3. IoT Telemetry Flow

```text
IoT Band publishes crowdguard/{id}/location every 10s
    → Eclipse Mosquitto receives on port 1883
    → Go MQTT Ingestion service subscribes crowdguard/#
    → Enriches payload with metadata
    → Produces to Kafka topic iot.telemetry
    → Celery consumer writes to TimescaleDB (time-series)
    → AI Engine Kafka consumer evaluates geo-fence proximity
    → If breach → AI Engine returns DISPATCH_ALERT
    → Backend sends geo-fence breach alert
```

### 4. Geo-Fence Breach Detection

```text
AI Engine consumes iot.telemetry from Kafka
    → For each location update:
        → Shapely containment check against all active zones
        → If inside restricted zone:
            → Compute alert_level (LOW/MEDIUM/HIGH)
            → POST /api/v1/geofences/breach to backend
    → Backend Celery task fans out notifications
```

---

## Database Schema (Key Tables)

```sql
-- Tourists
tourists (id, tourist_id_hash, name, nationality, trip_start, trip_end,
          blockchain_token_id, safety_score, created_at)

-- Incidents (TimescaleDB hypertable)
incidents (id, tourist_id, incident_type, lat, lng, status,
           blockchain_tx_hash, created_at, resolved_at)

-- Geo-fences
geofences (id, name, polygon_geojson, alert_level, is_active, created_by)

-- IoT Telemetry (TimescaleDB hypertable — partitioned by time)
telemetry (device_id, message_type, lat, lng, heart_rate, spo2,
           battery_pct, recorded_at)

-- Alerts
alerts (id, tourist_id, alert_type, severity, acknowledged, created_at)
```

---

## Design Decisions

### Why TimescaleDB?

IoT telemetry and incident data are inherently time-series. TimescaleDB extends PostgreSQL with automatic time-partitioning (hypertables), making range queries over large telemetry datasets orders of magnitude faster than vanilla PostgreSQL.

### Why Kafka?

The IoT ingestion layer generates thousands of MQTT messages per minute at scale. Kafka provides durable, replay-able event streaming, decoupling the IoT ingest rate from processing throughput and enabling multiple downstream consumers (backend, AI engine, future analytics).

### Why Celery?

Emergency alert dispatch must be non-blocking from the HTTP request lifecycle. Celery workers handle fan-out tasks asynchronously, ensuring the SOS API responds in milliseconds while notifications are dispatched in the background.

### Why Blockchain for Tourist ID?

Tourist IDs must be tamper-proof and verifiable by any authority without a central point of failure. An on-chain ERC-721 token provides trustless, auditable identity that any police officer can verify by scanning a QR code — even offline via cached contract state.

### Why Go for MQTT Ingestion?

The ingestion service is a hot path handling continuous high-frequency MQTT messages. Go's goroutine concurrency model and low memory footprint make it ideal for this I/O-bound bridge service compared to Python.

---

## Security Architecture

- All inter-service communication inside the Docker network is unencrypted (trusted network)
- External HTTPS is terminated at the Nginx ingress with TLS certificates
- IoT → Mosquitto uses MQTT username/password auth; TLS recommended for production
- JWT tokens (HS256) secure all backend API endpoints
- Blockchain private keys are injected via environment variables and never logged
- Firebase service account JSON is mounted as a read-only Docker volume secret
