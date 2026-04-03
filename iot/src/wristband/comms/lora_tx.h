#pragma once

#include <stdint.h>
#include <stdbool.h>
#include <cstddef>
#include "packet_types.h"

// Result of every transmit attempt
enum class LoRaTxResult : uint8_t {
    OK,               // packet handed off to SX1278 FIFO
    ERR_NOT_INIT,     // begin() was never called or failed
    ERR_BUSY,         // radio still transmitting previous packet
    ERR_PACKET_BUILD, // struct assembly or checksum failure
};

class LoRaTx {
public:
    // Initialise SX1278 with wristband LoRa parameters (SF10, 433 MHz, sync 0x12).
    // Must be called in setup() before any transmit call.
    bool begin();

    // Build and transmit a HealthPacket from pre-filled sensor values.
    LoRaTxResult sendHealth(
        const char*    device_id,
        float          heart_rate,
        float          spo2,
        float          body_temp,
        bool           is_alert,
        uint8_t        alert_type,
        float          latitude,
        float          longitude,
        uint8_t        battery_pct,
        uint32_t       timestamp
    );

    // Build and transmit an SOSPacket immediately.
    LoRaTxResult sendSOS(
        const char* device_id,
        float       latitude,
        float       longitude,
        uint8_t     battery_pct,
        uint32_t    timestamp
    );

    // Build and transmit an RFIDPacket.
    LoRaTxResult sendRFID(
        const char* device_id,
        const char* rfid_uid,     // 8-byte UID buffer
        uint32_t    timestamp
    );

    // Put SX1278 into low-power sleep mode between transmissions.
    void sleep();

    // Wake SX1278 back up before the next transmission cycle.
    void wake();

    bool isReady() const { return _ready; }

private:
    bool _ready = false;

    // Internal: write raw bytes to the SX1278 FIFO and trigger TX.
    LoRaTxResult transmitRaw(const uint8_t* data, size_t len);
};