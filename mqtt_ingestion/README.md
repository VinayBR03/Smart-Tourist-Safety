# 🔀 MQTT Ingestion — Sentinel Tour

A lightweight **Go** microservice that bridges IoT telemetry from the **Eclipse Mosquitto MQTT broker** into **Apache Kafka**, making real-time device data available to the backend, AI engine, and analytics pipeline.

---

## 📁 Folder Structure

```bash
mqtt_ingestion/
├── main.go             # Entry point — wire up MQTT subscriber + Kafka producer
├── config/
│   └── config.go       # Environment variable loader (envconfig)
├── mqtt/
│   └── subscriber.go   # MQTT client, topic subscription, message handler
├── kafka/
│   └── producer.go     # Kafka producer with retry logic
├── models/
│   └── telemetry.go    # Telemetry message structs + JSON marshalling
├── go.mod
├── go.sum
├── Dockerfile
├── .env.example
└── README.md
```

---

## ⚙️ Environment Variables

| Variable | Description | Default |
| ---------- | ------------- | --------- |
| `MQTT_BROKER` | MQTT broker address | `tcp://mosquitto:1883` |
| `MQTT_TOPIC_PREFIX` | Topic wildcard to subscribe | `crowdguard` |
| `MQTT_USERNAME` | MQTT auth username | `ingestion_service` |
| `MQTT_PASSWORD` | MQTT auth password | — |
| `MQTT_CLIENT_ID` | MQTT client identifier | `sentinel-ingestion-01` |
| `KAFKA_BROKERS` | Kafka broker list (comma-separated) | `kafka:29092` |
| `KAFKA_TOPIC` | Kafka topic to publish to | `iot.telemetry` |
| `LOG_LEVEL` | `debug`, `info`, `warn`, `error` | `info` |

---

## 🚀 Running

### With Docker Compose (recommended)

```bash
# From repo root
docker compose up mqtt-ingestion
```

### Standalone

```bash
cd mqtt_ingestion

# Set environment variables
export MQTT_BROKER=tcp://localhost:1883
export KAFKA_BROKERS=localhost:9092
export KAFKA_TOPIC=iot.telemetry
export MQTT_USERNAME=ingestion_service
export MQTT_PASSWORD=yourpassword

go run main.go
```

### Build Binary

```bash
go build -o sentinel-ingestion ./...
./sentinel-ingestion
```

---

## 🔄 Data Flow

```text
IoT Wearable Band
      │  MQTT publish
      ▼
Eclipse Mosquitto (port 1883)
  topic: crowdguard/{device_id}/{type}
      │  Subscribe crowdguard/#
      ▼
MQTT Ingestion Service (Go)
  - Parse JSON payload
  - Enrich with metadata (device_id, message_type, ingested_at)
      │  Produce to Kafka
      ▼
Kafka Topic: iot.telemetry
      │
      ├──► Backend (Celery consumer) → TimescaleDB
      ├──► AI Engine (Kafka consumer) → Geo-fencing & risk scoring
      └──► Analytics (future) → data warehouse
```

---

## 📦 Kafka Message Schema

Each message published to `iot.telemetry` follows this schema:

```json
{
  "device_id": "BAND-001",
  "message_type": "location",
  "payload": {
    "lat": 27.1751,
    "lng": 78.0421,
    "accuracy": 5.2,
    "timestamp": 1700000000
  },
  "ingested_at": "2025-11-15T10:30:00Z",
  "topic": "crowdguard/BAND-001/location"
}
```

`message_type` values: `location`, `health`, `sos`, `status`

---

## 🔁 Reliability

- **MQTT**: QoS 1 (at-least-once delivery); duplicate filtering handled downstream
- **Kafka**: Producer uses `acks=all` for durability; retries on transient failures
- **Reconnect**: Both MQTT client and Kafka producer implement exponential backoff reconnection

---

## 🧪 Testing

```bash
cd mqtt_ingestion
go test ./... -v -cover
```

---

## 🔗 Dependencies

- [`eclipse/paho.mqtt.golang`](https://github.com/eclipse/paho.mqtt.golang) — MQTT client
- [`IBM/sarama`](https://github.com/IBM/sarama) — Kafka client
- [`kelseyhightower/envconfig`](https://github.com/kelseyhightower/envconfig) — Environment variable loading
- [`rs/zerolog`](https://github.com/rs/zerolog) — Structured JSON logging
