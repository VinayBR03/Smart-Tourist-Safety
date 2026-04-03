#pragma once

#include <stdint.h>

// ─────────────────────────────────────────────
// Packet type identifiers — first byte of every LoRa packet
// ─────────────────────────────────────────────
static constexpr uint8_t PKT_HEALTH_DATA        = 0x01;
static constexpr uint8_t PKT_LOCATION_DATA      = 0x02;
static constexpr uint8_t PKT_SOS_ALERT          = 0x03;
static constexpr uint8_t PKT_NODE_STATUS        = 0x04;
static constexpr uint8_t PKT_GATEWAY_HEARTBEAT  = 0x05;
static constexpr uint8_t PKT_RFID_CHECKPOINT    = 0x06;

// ─────────────────────────────────────────────
// Alert type enum — carried in HealthPacket.alert_type
// ─────────────────────────────────────────────
static constexpr uint8_t ALERT_NONE             = 0;
static constexpr uint8_t ALERT_HIGH_HEART_RATE  = 1;
static constexpr uint8_t ALERT_LOW_HEART_RATE   = 2;
static constexpr uint8_t ALERT_LOW_SPO2         = 3;
static constexpr uint8_t ALERT_HIGH_TEMP        = 4;
static constexpr uint8_t ALERT_FALL_DETECTED    = 5;
static constexpr uint8_t ALERT_SOS              = 6;

// Alert type strings — used by gateway when building JSON for backend
static constexpr char ALERT_STR_HIGH_HEART_RATE[]  = "HIGH_HEART_RATE";
static constexpr char ALERT_STR_LOW_HEART_RATE[]   = "LOW_HEART_RATE";
static constexpr char ALERT_STR_LOW_SPO2[]         = "LOW_SPO2";
static constexpr char ALERT_STR_HIGH_TEMP[]        = "HIGH_TEMP";
static constexpr char ALERT_STR_FALL_DETECTED[]    = "FALL_DETECTED";
static constexpr char ALERT_STR_SOS[]              = "SOS";

// ─────────────────────────────────────────────
// Alert thresholds — firmware enforces these before setting is_alert
// ─────────────────────────────────────────────
static constexpr int16_t THRESHOLD_HEART_RATE_HIGH  = 120;  // bpm
static constexpr int16_t THRESHOLD_HEART_RATE_LOW   = 50;   // bpm
static constexpr uint8_t THRESHOLD_SPO2_LOW         = 94;   // %
static constexpr float   THRESHOLD_BODY_TEMP_HIGH   = 38.5f; // °C

// ─────────────────────────────────────────────
// Fixed field sizes
// ─────────────────────────────────────────────
static constexpr uint8_t DEVICE_ID_LEN  = 12;
static constexpr uint8_t NODE_ID_LEN    = 4;
static constexpr uint8_t RFID_UID_LEN   = 8;

// ─────────────────────────────────────────────
// Encoding scale factors
// ─────────────────────────────────────────────
static constexpr int16_t HEART_RATE_SCALE   = 10;    // stored as bpm × 10
static constexpr int16_t BODY_TEMP_SCALE    = 100;   // stored as °C × 100
static constexpr int32_t GPS_SCALE          = 10000000; // stored as degrees × 1e7

// ─────────────────────────────────────────────
// Packet structs — must be packed (no padding bytes)
// ─────────────────────────────────────────────
#pragma pack(push, 1)

// Wristband → Node  (~38 bytes)
struct HealthPacket {
    uint8_t  packet_type;               // PKT_HEALTH_DATA (0x01)
    char     device_id[DEVICE_ID_LEN];  // wristband device ID, null-terminated
    int16_t  heart_rate;                // bpm × 10
    uint8_t  spo2;                      // 0–100 %
    int16_t  body_temp;                 // °C × 100
    uint8_t  is_alert;                  // 0 or 1
    uint8_t  alert_type;                // ALERT_* constant
    int32_t  latitude;                  // degrees × 1e7
    int32_t  longitude;                 // degrees × 1e7
    uint8_t  battery_pct;               // 0–100
    uint32_t timestamp;                 // unix epoch seconds (UTC)
    uint8_t  checksum;                  // XOR of all preceding bytes
};

// Wristband → Node  (~25 bytes)
struct SOSPacket {
    uint8_t  packet_type;               // PKT_SOS_ALERT (0x03)
    char     device_id[DEVICE_ID_LEN];
    int32_t  latitude;
    int32_t  longitude;
    uint32_t timestamp;
    uint8_t  battery_pct;
    uint8_t  checksum;
};

// Wristband → Node  (RFID checkpoint)
struct RFIDPacket {
    uint8_t  packet_type;               // PKT_RFID_CHECKPOINT (0x06)
    char     device_id[DEVICE_ID_LEN];
    char     rfid_uid[RFID_UID_LEN];    // scanned tag UID bytes
    uint32_t timestamp;
    uint8_t  checksum;
};

// Node status packet (sent periodically by node itself)
struct NodeStatusPacket {
    uint8_t  packet_type;               // PKT_NODE_STATUS (0x04)
    char     node_id[NODE_ID_LEN];
    int32_t  node_lat;                  // hardcoded × 1e7
    int32_t  node_lon;
    int16_t  temperature;               // BME280 °C × 100
    uint8_t  humidity;                  // BME280 0–100 %
    int32_t  pressure;                  // BME280 Pa
    uint16_t air_quality;               // MQ-135 raw ADC
    uint8_t  battery_pct;               // INA219 derived
    uint32_t timestamp;
    uint8_t  checksum;
};

// Node header prepended to every forwarded wristband packet
struct NodeHeader {
    char    node_id[NODE_ID_LEN];       // e.g. "N001"
    int32_t node_lat;                   // hardcoded node latitude × 1e7
    int32_t node_lon;                   // hardcoded node longitude × 1e7
    int8_t  rssi;                       // RSSI of received wristband packet (dBm)
};

#pragma pack(pop)

// ─────────────────────────────────────────────
// Max LoRa payload = 255 bytes
// Largest packet = NodeHeader + HealthPacket = 17 + 38 = 55 bytes — well within limit
// ─────────────────────────────────────────────
static constexpr uint8_t LORA_MAX_PAYLOAD_BYTES = 255;