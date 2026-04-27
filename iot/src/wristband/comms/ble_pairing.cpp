#include "ble_pairing.h"

#include <Arduino.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

#include "../config_wristband.h"
#include "utils.h"

// ─────────────────────────────────────────────────────────────────────────────
// UUIDs — must match app/src/constants/config.ts
// ─────────────────────────────────────────────────────────────────────────────
static constexpr char BLE_SERVICE_UUID[]        = "12345678-1234-1234-1234-123456789abc";
static constexpr char BLE_CHAR_DEVICE_ID_UUID[] = "12345678-1234-1234-1234-123456789ab0";
static constexpr char BLE_CHAR_HEALTH_UUID[]    = "12345678-1234-1234-1234-123456789abd";
static constexpr char BLE_CHAR_BATTERY_UUID[]   = "12345678-1234-1234-1234-123456789abe";
static constexpr char BLE_CHAR_SOS_UUID[]       = "12345678-1234-1234-1234-123456789abf";
static constexpr char BLE_CHAR_NET_UUID[]       = "12345678-1234-1234-1234-123456789ac0";

// ─────────────────────────────────────────────────────────────────────────────
// Module-level state
// ─────────────────────────────────────────────────────────────────────────────
static BLEServer*         bleServer      = nullptr;
static BLECharacteristic* charHealth     = nullptr;
static BLECharacteristic* charBattery    = nullptr;
static BLECharacteristic* charSOS        = nullptr;

static volatile bool _connected     = false;
static volatile bool _hasInternet   = false;
static volatile bool _needsReadvert = false;

// ─────────────────────────────────────────────────────────────────────────────
// Server connection callbacks
// ─────────────────────────────────────────────────────────────────────────────
class ServerCallbacks : public BLEServerCallbacks {
    void onConnect(BLEServer*) override {
        _connected   = true;
        _hasInternet = false;   // wait for phone to confirm internet status
        DEBUG_LOG("[BLE] Phone connected");
    }
    void onDisconnect(BLEServer*) override {
        _connected     = false;
        _hasInternet   = false; // no phone → no internet gateway
        _needsReadvert = true;  // re-advertise so next phone can connect
        DEBUG_LOG("[BLE] Phone disconnected — reverting to LoRa mode");
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// NET characteristic write callback
// Phone writes "1" (internet ok) or "0" (no internet) every NET_STATUS_WRITE_INTERVAL
// ─────────────────────────────────────────────────────────────────────────────
class NetCharCallbacks : public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic* c) override {
        std::string val = c->getValue();
        if (!val.empty()) {
            _hasInternet = (val[0] == '1');
            DEBUG_LOGF("[BLE] NET status updated: internet=%s\n",
                       _hasInternet ? "YES (phone gateway active)" : "NO (LoRa fallback)");
        }
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// ble_server_begin()
// ─────────────────────────────────────────────────────────────────────────────
void ble_server_begin(const char* device_id) {
    BLEDevice::init(device_id);   // BLE device name = device_id ("wb001" etc.)

    bleServer = BLEDevice::createServer();
    bleServer->setCallbacks(new ServerCallbacks());

    BLEService* svc = bleServer->createService(BLE_SERVICE_UUID);

    // ── DeviceID — READ
    // Phone reads this after connecting to confirm firmware identity.
    BLECharacteristic* charId = svc->createCharacteristic(
        BLE_CHAR_DEVICE_ID_UUID,
        BLECharacteristic::PROPERTY_READ
    );
    charId->setValue(device_id);

    // ── Health — NOTIFY  (wristband → phone)
    // JSON: {"hr":<f>,"spo2":<f>,"temp":<f>,"bat":<u8>}
    charHealth = svc->createCharacteristic(
        BLE_CHAR_HEALTH_UUID,
        BLECharacteristic::PROPERTY_NOTIFY
    );
    charHealth->addDescriptor(new BLE2902());

    // ── Battery — NOTIFY  (wristband → phone)
    // Raw single byte: battery percentage 0-100
    charBattery = svc->createCharacteristic(
        BLE_CHAR_BATTERY_UUID,
        BLECharacteristic::PROPERTY_NOTIFY
    );
    charBattery->addDescriptor(new BLE2902());

    // ── SOS — NOTIFY  (wristband → phone)
    // JSON: {"sos":true,"bat":<u8>}
    charSOS = svc->createCharacteristic(
        BLE_CHAR_SOS_UUID,
        BLECharacteristic::PROPERTY_NOTIFY
    );
    charSOS->addDescriptor(new BLE2902());

    // ── NET — WRITE  (phone → wristband)
    // "1" = internet ok  →  phone acts as gateway
    // "0" = no internet  →  wristband uses LoRa
    BLECharacteristic* charNet = svc->createCharacteristic(
        BLE_CHAR_NET_UUID,
        BLECharacteristic::PROPERTY_WRITE |
        BLECharacteristic::PROPERTY_WRITE_NR   // no-response write for low-latency
    );
    charNet->setCallbacks(new NetCharCallbacks());

    svc->start();

    // Advertise with service UUID so the phone can filter-scan for us only
    BLEAdvertising* adv = BLEDevice::getAdvertising();
    adv->addServiceUUID(BLE_SERVICE_UUID);
    adv->setScanResponse(true);
    adv->setMinPreferred(0x06);   // iOS connection hint
    adv->setMaxPreferred(0x12);
    BLEDevice::startAdvertising();

    DEBUG_LOGF("[BLE] Always-on server started as '%s'\n", device_id);
    DEBUG_LOG("[BLE] Advertising with service UUID — phone can now connect anytime");
}

// ─────────────────────────────────────────────────────────────────────────────
// ble_server_update()
// Handles deferred re-advertising after disconnect.
// Call every loop() iteration — lightweight, just checks a flag.
// ─────────────────────────────────────────────────────────────────────────────
// Timestamp used to defer re-advertising by 300 ms without blocking
static uint32_t _readvertAt = 0;

void ble_server_update() {
    if (_needsReadvert) {
        _needsReadvert = false;
        _readvertAt    = millis() + 300;   // schedule, don't block with delay()
    }
    if (_readvertAt && millis() >= _readvertAt) {
        _readvertAt = 0;
        BLEDevice::startAdvertising();
        DEBUG_LOG("[BLE] Re-advertising — ready for next phone connection");
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// State accessors
// ─────────────────────────────────────────────────────────────────────────────
bool ble_server_is_connected() { return _connected;   }
bool ble_server_has_internet() { return _hasInternet; }

// ─────────────────────────────────────────────────────────────────────────────
// Notification helpers
// ─────────────────────────────────────────────────────────────────────────────
void ble_server_notify_health(float hr, float spo2, float temp, uint8_t bat) {
    if (!_connected || !charHealth) return;

    char buf[80];
    snprintf(buf, sizeof(buf),
             "{\"hr\":%.1f,\"spo2\":%.1f,\"temp\":%.1f,\"bat\":%u}",
             hr, spo2, temp, static_cast<unsigned>(bat));

    charHealth->setValue(reinterpret_cast<uint8_t*>(buf), strlen(buf));
    charHealth->notify();

    DEBUG_LOGF("[BLE] Health notify → %s\n", buf);
}

void ble_server_notify_sos(uint8_t bat) {
    if (!_connected || !charSOS) return;

    char buf[32];
    snprintf(buf, sizeof(buf),
             "{\"sos\":true,\"bat\":%u}", static_cast<unsigned>(bat));

    charSOS->setValue(reinterpret_cast<uint8_t*>(buf), strlen(buf));
    charSOS->notify();

    DEBUG_LOG("[BLE] *** SOS notified to phone ***");
}

void ble_server_notify_battery(uint8_t percentage) {
    if (!_connected || !charBattery) return;
    uint8_t val[1] = { percentage };
    charBattery->setValue(val, 1);
    charBattery->notify();
}
