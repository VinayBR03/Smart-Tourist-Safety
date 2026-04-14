#pragma once

#include <stdint.h>
#include <stdbool.h>

// BLE pairing window — wristband advertises for this long after boot.
// After the window closes BLE is shut down and LoRa-only mode begins.
static constexpr uint32_t BLE_PAIRING_WINDOW_MS = 60000;  // 60 seconds

// Starts BLE GATT server and begins advertising.
// Call once from setup() BEFORE initPeripherals() starts the SPI bus,
// because BleManager and SPI don't conflict but early start is cleaner.
void ble_pairing_begin(const char* device_id);

// Must be called every loop() iteration during the pairing window.
// Returns true while still in the pairing window, false when expired.
// When false the caller should stop calling this and proceed to LoRa init.
bool ble_pairing_update();

// Shut BLE down explicitly (called when pairing window expires or
// device is already paired and no BLE connection was made).
void ble_pairing_stop();

// True if a BLE client is currently connected (mobile app paired)
bool ble_pairing_is_connected();