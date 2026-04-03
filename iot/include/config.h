#pragma once

#include <stdint.h>

// ─────────────────────────────────────────────
// LoRa Radio — Shared across all three device types
// ─────────────────────────────────────────────

// India ISM band — 433 MHz
static constexpr long LORA_FREQUENCY_HZ         = 433E6;

// Spreading factors
static constexpr uint8_t LORA_SF_RANGE          = 10;   // wristband → node (max range)
static constexpr uint8_t LORA_SF_SPEED          = 7;    // node → gateway (shorter hop)

// RF parameters
static constexpr long    LORA_BANDWIDTH_HZ      = 125000;
static constexpr uint8_t LORA_CODING_RATE       = 5;    // 4/5
static constexpr uint8_t LORA_SYNC_WORD         = 0x12; // private network

// TX power (dBm) — legal limit for 433 MHz in India
static constexpr uint8_t LORA_TX_POWER_DBM      = 14;

// Receive timeout for blocking reads (ms)
static constexpr uint32_t LORA_RX_TIMEOUT_MS    = 200;

// ─────────────────────────────────────────────
// Timing
// ─────────────────────────────────────────────
static constexpr uint32_t HEALTH_TX_INTERVAL_MS         = 30000;   // 30 s normal
static constexpr uint32_t HEALTH_TX_INTERVAL_LOW_BAT_MS = 60000;   // 60 s when battery < 15%
static constexpr uint32_t SOS_RETRANSMIT_INTERVAL_MS    = 10000;   // 10 s after first SOS
static constexpr uint32_t NODE_FORWARD_DEADLINE_MS       = 200;     // node must forward within 200 ms
static constexpr uint32_t GATEWAY_HEARTBEAT_INTERVAL_MS = 60000;   // 60 s
static constexpr uint32_t NODE_ENV_READ_INTERVAL_MS     = 300000;  // 5 min

// ─────────────────────────────────────────────
// Battery thresholds
// ─────────────────────────────────────────────
static constexpr uint8_t  BATTERY_LOW_THRESHOLD_PCT     = 15;

// ─────────────────────────────────────────────
// Packet buffer (gateway duplicate detection)
// ─────────────────────────────────────────────
static constexpr uint8_t  DEDUP_CACHE_SIZE               = 50;   // last N checksums per device
static constexpr uint16_t GATEWAY_QUEUE_MAX_PACKETS      = 200;

// ─────────────────────────────────────────────
// HTTP client
// ─────────────────────────────────────────────
static constexpr uint32_t HTTP_POST_TIMEOUT_MS           = 10000;
static constexpr uint8_t  HTTP_MAX_RETRIES               = 3;
static constexpr uint32_t HTTP_RETRY_BACKOFF_MS          = 5000;

// ─────────────────────────────────────────────
// HTTP response codes
// ─────────────────────────────────────────────
static constexpr int HTTP_ACCEPTED                       = 202;
static constexpr int HTTP_OK                             = 200;

// ─────────────────────────────────────────────
// Firmware version (bump on every release)
// ─────────────────────────────────────────────
static constexpr char FIRMWARE_VERSION[]                 = "1.0.0";