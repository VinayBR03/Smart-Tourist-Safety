#include "ble_pairing.h"

#include <Arduino.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

#include "../config_wristband.h"
#include "utils.h"

// ─────────────────────────────────────────────
// UUIDs — must match mobile app src/constants/config.ts
// ─────────────────────────────────────────────
static constexpr char BLE_SERVICE_UUID[]          = "12345678-1234-1234-1234-123456789abc";
static constexpr char BLE_CHAR_DEVICE_ID_UUID[]   = "12345678-1234-1234-1234-123456789ab0";
static constexpr char BLE_CHAR_HEALTH_UUID[]      = "12345678-1234-1234-1234-123456789abd";
static constexpr char BLE_CHAR_BATTERY_UUID[]     = "12345678-1234-1234-1234-123456789abe";

static BLEServer*          bleServer       = nullptr;
static BLECharacteristic*  charDeviceId    = nullptr;
static bool                _connected      = false;
static uint32_t            _windowStart    = 0;
static bool                _active         = false;

// ─────────────────────────────────────────────
// Server callback — track connection state
// ─────────────────────────────────────────────
class PairingServerCallbacks : public BLEServerCallbacks {
    void onConnect(BLEServer*)    override { _connected = true;  DEBUG_LOG("[BLE] Client connected"); }
    void onDisconnect(BLEServer* s) override {
        _connected = false;
        DEBUG_LOG("[BLE] Client disconnected");
        s->startAdvertising();  // re-advertise in case another phone tries
    }
};

// ─────────────────────────────────────────────
// begin()
// ─────────────────────────────────────────────
void ble_pairing_begin(const char* device_id) {
    _windowStart = millis();
    _active      = true;

    BLEDevice::init(device_id);   // BLE device name = device_id ("WB001" etc.)

    bleServer = BLEDevice::createServer();
    bleServer->setCallbacks(new PairingServerCallbacks());

    BLEService* service = bleServer->createService(BLE_SERVICE_UUID);

    // ── DeviceID characteristic — READ only
    // Mobile reads this to learn the firmware device_id string
    charDeviceId = service->createCharacteristic(
        BLE_CHAR_DEVICE_ID_UUID,
        BLECharacteristic::PROPERTY_READ
    );
    charDeviceId->setValue(device_id);

    // ── Health characteristic — NOTIFY (placeholder for future live BLE health)
    BLECharacteristic* charHealth = service->createCharacteristic(
        BLE_CHAR_HEALTH_UUID,
        BLECharacteristic::PROPERTY_NOTIFY
    );
    charHealth->addDescriptor(new BLE2902());

    // ── Battery characteristic — NOTIFY
    BLECharacteristic* charBattery = service->createCharacteristic(
        BLE_CHAR_BATTERY_UUID,
        BLECharacteristic::PROPERTY_NOTIFY
    );
    charBattery->addDescriptor(new BLE2902());

    service->start();

    BLEAdvertising* adv = BLEDevice::getAdvertising();
    adv->addServiceUUID(BLE_SERVICE_UUID);
    adv->setScanResponse(true);
    adv->setMinPreferred(0x06);
    BLEDevice::startAdvertising();

    DEBUG_LOGF("[BLE] Advertising as '%s' — pairing window %us\n",
               device_id, BLE_PAIRING_WINDOW_MS / 1000);
}

// ─────────────────────────────────────────────
// update() — call every loop() iteration
// ─────────────────────────────────────────────
bool ble_pairing_update() {
    if (!_active) return false;

    uint32_t elapsed = millis() - _windowStart;
    if (elapsed >= BLE_PAIRING_WINDOW_MS) {
        ble_pairing_stop();
        return false;
    }
    return true;
}

// ─────────────────────────────────────────────
// stop()
// ─────────────────────────────────────────────
void ble_pairing_stop() {
    if (!_active) return;
    BLEDevice::stopAdvertising();
    BLEDevice::deinit(true);
    _active    = false;
    _connected = false;
    DEBUG_LOG("[BLE] Pairing window closed — BLE stopped");
}

bool ble_pairing_is_connected() { return _connected; }