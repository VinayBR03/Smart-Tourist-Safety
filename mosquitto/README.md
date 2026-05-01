# 🦟 Mosquitto — MQTT Broker Configuration

This folder contains the configuration for **Eclipse Mosquitto 2**, the MQTT broker that receives real-time telemetry from IoT safety bands and relays messages to the `mqtt_ingestion` service.

---

## 📁 Folder Structure

```bash
mosquitto/
├── mosquitto.conf      # Main Mosquitto broker configuration
├── passwd              # Hashed MQTT credentials file (gitignored)
├── acl                 # Access Control List (topic-level permissions)
└── README.md
```

---

## ⚙️ Configuration (`mosquitto.conf`)

```conf
# ── Listener ──────────────────────────────────────────
listener 1883
protocol mqtt

# ── Auth ──────────────────────────────────────────────
allow_anonymous false
password_file /mosquitto/config/passwd
acl_file /mosquitto/config/acl

# ── Persistence ───────────────────────────────────────
persistence true
persistence_location /mosquitto/data/

# ── Logging ───────────────────────────────────────────
log_type all
log_dest stdout
```

---

## 🐳 Docker Integration

The broker runs as a service in `docker-compose.yml`:

```yaml
mosquitto:
  image: eclipse-mosquitto:2
  container_name: tourist_mosquitto
  ports:
    - "1883:1883"
  volumes:
    - ./mosquitto/mosquitto.conf:/mosquitto/config/mosquitto.conf
    - mosquitto_data:/mosquitto/data
```

Port `1883` is exposed to allow IoT devices on the local network to connect. In production, this should be restricted to the internal Docker network and exposed only via a secured tunnel or VPN.

---

## 🔐 Setting Up MQTT Credentials

The `passwd` file stores hashed credentials. To add a user:

```bash
# Run inside the Mosquitto container
docker exec -it tourist_mosquitto mosquitto_passwd -c /mosquitto/config/passwd iot_device_user
# Enter password when prompted

# Add additional users (without -c to avoid overwriting)
docker exec -it tourist_mosquitto mosquitto_passwd /mosquitto/config/passwd ingestion_service
```

Commit only the `passwd` file — never commit plain-text passwords.

---

## 🗝️ Access Control List (`acl`)

```text
# IoT devices: can only publish to their own topic subtree
user iot_device_user
topic write crowdguard/#

# MQTT ingestion service: read-only on all crowdguard topics
user ingestion_service
topic read crowdguard/#

# Admin: full access
user admin
topic #
```

---

## 📡 Topic Namespace

All IoT telemetry uses the `crowdguard/` prefix:

```bash
crowdguard/
├── {device_id}/location     # GPS coordinates
├── {device_id}/health       # Heart rate, SpO2
├── {device_id}/sos          # Emergency trigger
└── {device_id}/status       # Battery, RSSI, uptime
```

---

## 🔒 Production: Enable TLS (Recommended)

For production deployments, enable TLS on port `8883`:

```conf
listener 8883
protocol mqtt
cafile   /mosquitto/config/ca.crt
certfile /mosquitto/config/server.crt
keyfile  /mosquitto/config/server.key
tls_version tlsv1.3
```

Generate certificates with `openssl` or use Let's Encrypt. Update IoT firmware to connect on port `8883` with `mqtts://`.

---

## 🧪 Testing the Broker

```bash
# Subscribe (in one terminal)
mosquitto_sub -h localhost -p 1883 -u ingestion_service -P <password> -t "crowdguard/#" -v

# Publish test message (in another terminal)
mosquitto_pub -h localhost -p 1883 -u iot_device_user -P <password> \
  -t "crowdguard/BAND-001/location" \
  -m '{"lat":27.1751,"lng":78.0421,"timestamp":1700000000}'
```
