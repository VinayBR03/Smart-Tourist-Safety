#pragma once
#include <cstdint>

// ─────────────────────────────────────────────
// Device identity — change per unit at flash time
// ─────────────────────────────────────────────
static constexpr char WRISTBAND_DEVICE_ID[] = "wb001";  // CHANGE PER UNIT

// ─────────────────────────────────────────────
// I2C bus — shared by MAX30102, MLX90614, GY-91
// ─────────────────────────────────────────────
static constexpr uint8_t PIN_I2C_SDA = 8;
static constexpr uint8_t PIN_I2C_SCL = 9;

// ─────────────────────────────────────────────
// SPI bus — shared by LoRa SX1278 and RC522 RFID
// ─────────────────────────────────────────────
static constexpr uint8_t PIN_SPI_SCK  = 4;
static constexpr uint8_t PIN_SPI_MISO = 5;
static constexpr uint8_t PIN_SPI_MOSI = 6;

// ─────────────────────────────────────────────
// LoRa SX1278 (RA-02)
// ─────────────────────────────────────────────
static constexpr uint8_t PIN_LORA_NSS  = 7;
static constexpr uint8_t PIN_LORA_RST  = 3;
static constexpr uint8_t PIN_LORA_DIO0 = 2;

// ─────────────────────────────────────────────
// RC522 RFID — shares SPI bus, separate CS + RST
// ─────────────────────────────────────────────
static constexpr uint8_t PIN_RFID_SS  = 10;
static constexpr uint8_t PIN_RFID_RST = 20;

// ─────────────────────────────────────────────
// SOS button — active LOW, internal pull-up enabled
// ─────────────────────────────────────────────
static constexpr uint8_t PIN_SOS_BUTTON = 0;

// ─────────────────────────────────────────────
// Battery ADC — through R1=100k / R2=100k voltage divider
// ─────────────────────────────────────────────
static constexpr uint8_t  PIN_BATTERY_ADC          = 1;
static constexpr uint32_t BATTERY_ADC_SAMPLES       = 16;     // readings to average
static constexpr float    BATTERY_DIVIDER_RATIO     = 2.0f;   // Vbat = Vadc × 2
static constexpr float    BATTERY_VOLTAGE_FULL_MV   = 4200.0f;
static constexpr float    BATTERY_VOLTAGE_EMPTY_MV  = 3000.0f;

// ─────────────────────────────────────────────
// Sensor I2C addresses
// ─────────────────────────────────────────────
static constexpr uint8_t I2C_ADDR_MAX30102 = 0x57;
static constexpr uint8_t I2C_ADDR_MLX90614 = 0x5A;
static constexpr uint8_t I2C_ADDR_MPU9250  = 0x68;
static constexpr uint8_t I2C_ADDR_BMP280   = 0x76;

// ─────────────────────────────────────────────
// MAX30102 sampling
// ─────────────────────────────────────────────
static constexpr uint32_t MAX30102_SAMPLE_WINDOW_MS  = 4000;  // collect beats for 4 s
static constexpr uint8_t  MAX30102_RATE_BUFFER_SIZE  = 4;     // beats to average
static constexpr int32_t  MAX30102_SPO2_BUFFER_LEN   = 100;   // samples for SpO2 algorithm

// ─────────────────────────────────────────────
// MPU9250 accel scale (±2g default range)
// ─────────────────────────────────────────────
static constexpr float MPU9250_ACCEL_LSB_PER_G = 16384.0f;

// ─────────────────────────────────────────────
// Fall detection
// ─────────────────────────────────────────────
static constexpr float    FALL_FREE_FALL_G         = 0.5f;   // accel below this → free fall
static constexpr float    FALL_IMPACT_G            = 2.0f;   // accel above this → impact
static constexpr uint32_t FALL_FREE_FALL_MIN_MS    = 50;     // minimum free-fall duration
static constexpr uint32_t FALL_IMPACT_WINDOW_MS    = 500;    // max time free fall can last before timeout
static constexpr uint32_t FALL_LOCKOUT_MS          = 5000;   // cooldown after confirmed fall

// ─────────────────────────────────────────────
// SOS button
// ─────────────────────────────────────────────
static constexpr uint32_t SOS_DEBOUNCE_MS  = 50;
static constexpr uint32_t SOS_HOLD_MS      = 1000;   // must hold 1 s to avoid accidental press

// ─────────────────────────────────────────────
// MLX90614 sanity-check range
// ─────────────────────────────────────────────
static constexpr float MLX_BODY_TEMP_MIN_C = 20.0f;
static constexpr float MLX_BODY_TEMP_MAX_C = 50.0f;