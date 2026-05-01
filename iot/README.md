# 📡 IoT — Sentinel Tour Wearable Firmware

Firmware for the **Sentinel Tour Smart Safety Band** — an ESP32-based IoT wearable worn by tourists in high-risk and remote zones (caves, forests, border areas). The band continuously transmits GPS location and health signals via **MQTT** and features a hardware **SOS button** for manual emergency activation.

---

## 📁 Folder Structure

```bash
iot/
├── src/
│   ├── main.cpp            # Entry point: setup() and loop()
│   ├── wifi_manager.cpp    # WiFi connection with auto-reconnect
│   ├── mqtt_client.cpp     # MQTT publisher (Eclipse Paho / Arduino MQTT)
│   ├── gps.cpp             # GPS parsing (NEO-6M / NEO-8M via NMEA)
│   ├── health_monitor.cpp  # Heart rate & SpO2 (MAX30102 sensor)
│   ├── sos_button.cpp      # Hardware interrupt-driven SOS trigger
│   └── config.h            # Device config, topic names, server addresses
├── include/
│   └── types.h             # Shared data structures
├── test/
│   └── test_gps_parser.cpp # Unit tests for GPS NMEA parsing
├── platformio.ini          # PlatformIO project configuration
├── CMakeLists.txt          # Alternative CMake build for ESP-IDF
└── README.md
```

---

## 🔧 Hardware

| Component | Module | Purpose |
| ----------- | -------- | --------- |
| Microcontroller | ESP32-WROOM-32 | Main compute + WiFi/BT |
| GPS | u-blox NEO-6M | Location tracking |
| Heart Rate + SpO2 | MAX30102 | Health monitoring |
| SOS Button | Tactile switch + pull-down | Emergency activation |
| Power | LiPo 3.7V 1200mAh | Portable power |
| Charging | TP4056 module | USB charging |

---

## 📶 MQTT Topics Published

| Topic | Payload | Frequency |
| ------- | --------- | ----------- |
| `crowdguard/{device_id}/location` | `{ lat, lng, accuracy, timestamp }` | Every 10 seconds |
| `crowdguard/{device_id}/health` | `{ heart_rate, spo2, timestamp }` | Every 30 seconds |
| `crowdguard/{device_id}/sos` | `{ lat, lng, device_id, timestamp, battery_pct }` | On button press |
| `crowdguard/{device_id}/status` | `{ battery_pct, rssi, uptime_sec }` | Every 60 seconds |

All topics follow the `crowdguard/` prefix consumed by the `mqtt_ingestion` service.

---

## ⚙️ Configuration (`config.h`)

```cpp
#define WIFI_SSID       "YourNetwork"
#define WIFI_PASSWORD   "YourPassword"
#define MQTT_BROKER     "192.168.1.100"   // Mosquitto broker IP
#define MQTT_PORT       1883
#define DEVICE_ID       "BAND-001"        // Unique per device
#define GPS_BAUD        9600
#define PUB_INTERVAL_MS 10000             // Location publish interval
```

---

## 🚀 Building & Flashing

### Using PlatformIO (recommended)

```bash
# Install PlatformIO CLI
pip install platformio

cd iot

# Build firmware
pio run

# Flash to ESP32 (with device connected via USB)
pio run --target upload

# Monitor serial output
pio device monitor --baud 115200
```

### Using Arduino IDE

1. Install ESP32 board support via Board Manager
2. Install libraries: `PubSubClient`, `TinyGPS++`, `MAX3010x`
3. Open `src/main.cpp`, set board to **ESP32 Dev Module**
4. Upload

---

## 🔁 Device Lifecycle

```text
Power ON
   │
   ▼
WiFi Connect (retry with backoff)
   │
   ▼
MQTT Connect → tourist_mosquitto broker
   │
   ├─── Loop: Read GPS → Publish location (10s)
   ├─── Loop: Read health sensor → Publish health (30s)
   ├─── Loop: Publish status (60s)
   └─── Interrupt: SOS button → Publish SOS immediately
```

---

## 🧪 Testing

GPS parser unit tests run on host (no hardware required):

```bash
cd iot
pio test -e native
```

---

## 🔋 Power Consumption

| Mode | Current Draw | Estimated Battery Life |
| ------ | ------------- | ---------------------- |
| Full active (GPS + WiFi + sensors) | ~180 mA | ~6.5 hours |
| Location-only (no health sensors) | ~120 mA | ~10 hours |
| Deep sleep between publishes | ~15 mA avg | ~80 hours |

---

## 🔐 Security Notes

- MQTT connection uses username/password authentication (configured in `config.h`)
- For production, enable TLS on Mosquitto and use `mqtts://` (port 8883)
- Device IDs are registered in the backend before deployment; unregistered devices are rejected
