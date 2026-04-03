#pragma once

#include <stdint.h>

// ─────────────────────────────────────────────
// Device identity — change per unit at deploy time
// ─────────────────────────────────────────────
static constexpr char NODE_DEVICE_ID[]  = "N001";       // CHANGE PER UNIT (max 4 chars)
static constexpr char NODE_ZONE_ID[]    = "ZONE_A1";    // CHANGE PER UNIT — matches backend zone

// ─────────────────────────────────────────────
// Hardcoded GPS location — surveyed at deploy time, never changes
// ─────────────────────────────────────────────
static constexpr float NODE_LATITUDE    = 25.43580f;    // CHANGE PER UNIT
static constexpr float NODE_LONGITUDE   = 81.84630f;    // CHANGE PER UNIT

// ─────────────────────────────────────────────
// I2C bus — shared by BME280 and INA219
// ─────────────────────────────────────────────
static constexpr uint8_t PIN_I2C_SDA = 21;
static constexpr uint8_t PIN_I2C_SCL = 22;

// ─────────────────────────────────────────────
// SPI bus — LoRa SX1278
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
// MQ-135 — analog output on ADC pin
// ─────────────────────────────────────────────
static constexpr uint8_t  PIN_MQ135_AOUT        = 34;   // ADC1 — safe without Wi-Fi
static constexpr uint32_t MQ135_WARMUP_MS        = 30000; // 30 s warm-up after power-on
static constexpr uint16_t MQ135_DANGER_THRESHOLD = 600;  // raw ADC — calibrate on site
static constexpr uint8_t  MQ135_SAMPLES          = 10;   // readings to average

// ─────────────────────────────────────────────
// INA219 I2C address (A0=GND, A1=GND → 0x40 default)
// ─────────────────────────────────────────────
static constexpr uint8_t  I2C_ADDR_INA219 = 0x40;
static constexpr float    INA219_SHUNT_OHM = 0.1f;       // 100 mΩ shunt resistor
static constexpr float    BATTERY_VOLTAGE_FULL_MV  = 4200.0f;
static constexpr float    BATTERY_VOLTAGE_EMPTY_MV = 3000.0f;

// ─────────────────────────────────────────────
// BME280 I2C address (SDO=GND → 0x76)
// ─────────────────────────────────────────────
static constexpr uint8_t I2C_ADDR_BME280 = 0x76;

// ─────────────────────────────────────────────
// Routing
// ─────────────────────────────────────────────
// RSSI below this value is considered too weak to use as a next-hop
static constexpr int8_t   MESH_MIN_RSSI_DBM       = -110;
// Max hops a packet can travel before being dropped
static constexpr uint8_t  MESH_MAX_HOP_COUNT       = 5;
// How long to keep a heard device in the proximity table (ms)
static constexpr uint32_t MESH_PROXIMITY_TTL_MS    = 300000; // 5 min
// Max tracked wristband devices in the proximity table
static constexpr uint8_t  PROXIMITY_TABLE_SIZE     = 20;