#pragma once

#include <stdint.h>
#include <stdbool.h>

// ─────────────────────────────────────────────────────────────────────────────
// Always-on BLE GATT server.
//
// Architecture:
//   • Wristband advertises indefinitely (no pairing window).
//   • Mobile app connects, subscribes to HEALTH / SOS / BATTERY notifications.
//   • Phone writes "1" / "0" to NET characteristic every 10 s:
//       "1" → internet available → phone acts as gateway (uploads via POST)
//       "0" → no internet         → wristband falls back to LoRa TX
//   • On disconnect: wristband automatically re-advertises and reverts to LoRa.
//
// UUIDs — must match app/src/constants/config.ts
//   SERVICE     12345678-1234-1234-1234-123456789abc
//   DEVICE_ID   12345678-1234-1234-1234-123456789ab0  READ
//   HEALTH      12345678-1234-1234-1234-123456789abd  NOTIFY
//   BATTERY     12345678-1234-1234-1234-123456789abe  NOTIFY
//   SOS         12345678-1234-1234-1234-123456789abf  NOTIFY
//   NET         12345678-1234-1234-1234-123456789ac0  WRITE (phone → wristband)
// ─────────────────────────────────────────────────────────────────────────────

// Start the BLE GATT server and begin advertising.
// device_id becomes both the BLE device name and the value of DEVICE_ID char.
// Call once from setup() — LoRa/SPI can be initialised before or after.
void ble_server_begin(const char* device_id);

// Must be called every loop() iteration.
// Handles deferred re-advertising after client disconnect.
void ble_server_update();

// True while a phone is actively connected.
bool ble_server_is_connected();

// True when the connected phone last reported internet availability.
// Resets to false immediately on disconnect.
bool ble_server_has_internet();

// Notify the connected phone with a health JSON frame.
// No-op if not connected.
// JSON: {"hr":<f>,"spo2":<f>,"temp":<f>,"bat":<u8>}
void ble_server_notify_health(float hr, float spo2, float temp, uint8_t bat);

// Notify the connected phone that SOS was triggered.
// No-op if not connected.
// JSON: {"sos":true,"bat":<u8>}
void ble_server_notify_sos(uint8_t bat);

// Notify the connected phone with a raw battery percentage byte.
// No-op if not connected.
void ble_server_notify_battery(uint8_t percentage);

// ─────────────────────────────────────────────────────────────────────────────
// Compatibility aliases — map old call-sites to new names
// ─────────────────────────────────────────────────────────────────────────────
#define ble_begin(id)                    ble_server_begin(id)
#define ble_update()                     ble_server_update()
#define ble_is_connected()               ble_server_is_connected()
#define ble_phone_has_internet()         ble_server_has_internet()
#define ble_notify_health(hr,spo2,temp,bat,...) ble_server_notify_health(hr,spo2,temp,bat)
#define ble_notify_sos(bat)              ble_server_notify_sos(bat)
#define ble_notify_battery(pct)          ble_server_notify_battery(pct)
