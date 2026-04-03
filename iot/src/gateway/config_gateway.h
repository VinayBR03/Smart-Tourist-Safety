#pragma once

#include <stdint.h>

// ─────────────────────────────────────────────
// Device identity — CHANGE PER UNIT
// ─────────────────────────────────────────────
static constexpr char GATEWAY_DEVICE_ID[] = "GW001";

// ─────────────────────────────────────────────
// Hardcoded GPS — surveyed at deploy time
// ─────────────────────────────────────────────
static constexpr float GATEWAY_LATITUDE   = 25.43580f;   // CHANGE PER UNIT
static constexpr float GATEWAY_LONGITUDE  = 81.84630f;   // CHANGE PER UNIT

// ─────────────────────────────────────────────
// Backend — CHANGE before deploying
// Store a copy of this file as config_gateway.example.h with dummy values.
// Add config_gateway.h to .gitignore.
// ─────────────────────────────────────────────
static constexpr char BACKEND_BASE_URL[]  = "http://192.168.1.100:8000"; // CHANGE
static constexpr char GATEWAY_API_KEY[]   = "REPLACE_WITH_ACTUAL_KEY";           // CHANGE

static constexpr char ENDPOINT_HEALTH[]    = "/iot/health";
static constexpr char ENDPOINT_LOCATION[]  = "/iot/location";
static constexpr char ENDPOINT_HEARTBEAT[] = "/iot/heartbeat";

// ─────────────────────────────────────────────
// WiFi — CHANGE
// ─────────────────────────────────────────────
static constexpr char     WIFI_SSID[]                   = "REPLACE_SSID";  // CHANGE
static constexpr char     WIFI_PASSWORD[]               = "REPLACE_PASS";  // CHANGE
static constexpr uint32_t WIFI_CONNECT_TIMEOUT_MS       = 15000;
static constexpr uint32_t WIFI_RECONNECT_INTERVAL_MS    = 30000;

// ─────────────────────────────────────────────
// LTE (SIM800L via UART2) — CHANGE APN per carrier
// ─────────────────────────────────────────────
static constexpr char     LTE_APN[]                     = "airtelgprs.com"; // CHANGE
static constexpr uint8_t  PIN_LTE_TX                    = 17;
static constexpr uint8_t  PIN_LTE_RX                    = 16;
static constexpr uint32_t LTE_BAUD                      = 9600;
static constexpr uint32_t LTE_CONNECT_TIMEOUT_MS        = 60000;
static constexpr uint32_t LTE_AT_TIMEOUT_MS             = 5000;

// ─────────────────────────────────────────────
// I2C — BME280, INA219
// ─────────────────────────────────────────────
static constexpr uint8_t PIN_I2C_SDA = 21;
static constexpr uint8_t PIN_I2C_SCL = 22;

// ─────────────────────────────────────────────
// SPI — LoRa SX1278
// ─────────────────────────────────────────────
static constexpr uint8_t PIN_SPI_SCK  = 18;
static constexpr uint8_t PIN_SPI_MISO = 19;
static constexpr uint8_t PIN_SPI_MOSI = 23;

// ─────────────────────────────────────────────
// LoRa SX1278 (RA-02)
// ─────────────────────────────────────────────
static constexpr uint8_t PIN_LORA_NSS  = 5;
static constexpr uint8_t PIN_LORA_RST  = 14;
static constexpr uint8_t PIN_LORA_DIO0 = 2;

// ─────────────────────────────────────────────
// MQ-135
// ─────────────────────────────────────────────
static constexpr uint8_t  PIN_MQ135_AOUT        = 34;
static constexpr uint32_t MQ135_WARMUP_MS        = 30000;
static constexpr uint16_t MQ135_DANGER_THRESHOLD = 600;
static constexpr uint8_t  MQ135_SAMPLES          = 10;

// ─────────────────────────────────────────────
// INA219
// ─────────────────────────────────────────────
static constexpr uint8_t  I2C_ADDR_INA219         = 0x40;
static constexpr float    BATTERY_VOLTAGE_FULL_MV  = 4200.0f;
static constexpr float    BATTERY_VOLTAGE_EMPTY_MV = 3000.0f;

// ─────────────────────────────────────────────
// BME280
// ─────────────────────────────────────────────
static constexpr uint8_t I2C_ADDR_BME280 = 0x76;

// ─────────────────────────────────────────────
// NTP
// ─────────────────────────────────────────────
static constexpr char     NTP_SERVER_1[]        = "pool.ntp.org";
static constexpr char     NTP_SERVER_2[]        = "time.nist.gov";
static constexpr uint32_t NTP_SYNC_TIMEOUT_MS  = 10000;

// ─────────────────────────────────────────────
// Dedup cache
// ─────────────────────────────────────────────
static constexpr uint8_t DEDUP_DEVICE_SLOTS = 20;  // max distinct wristbands tracked

// ─────────────────────────────────────────────
// JSON buffer
// ─────────────────────────────────────────────
static constexpr uint16_t JSON_BUFFER_SIZE = 512;