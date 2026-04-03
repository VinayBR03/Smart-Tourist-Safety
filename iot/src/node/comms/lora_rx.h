#pragma once

#include <stdint.h>
#include <stdbool.h>
#include "packet_types.h"

// Discriminated union holding a parsed inbound packet
enum class RxPacketKind : uint8_t {
    NONE,
    HEALTH,
    SOS,
    RFID,
    UNKNOWN,
};

struct ReceivedPacket {
    RxPacketKind kind    = RxPacketKind::NONE;
    int8_t       rssi    = 0;        // RSSI in dBm at the time of reception
    float        snr     = 0.0f;     // SNR reported by SX1278

    // Only one of these is populated, selected by `kind`
    HealthPacket health;
    SOSPacket    sos;
    RFIDPacket   rfid;
};

class LoRaRx {
public:
    // Initialise SX1278 in continuous receive mode.
    // Node listens on SF10 to match wristband TX.
    bool begin();

    // Non-blocking poll. Returns a packet with kind=NONE if nothing received.
    // Validates checksum before returning — corrupted packets return kind=NONE.
    ReceivedPacket poll();

    bool isReady() const { return _ready; }

private:
    bool _ready = false;

    // Copy raw bytes from LoRa FIFO into the appropriate struct
    bool parseHealth(const uint8_t* buf, int len, ReceivedPacket& out);
    bool parseSOS(const uint8_t* buf, int len, ReceivedPacket& out);
    bool parseRFID(const uint8_t* buf, int len, ReceivedPacket& out);
};