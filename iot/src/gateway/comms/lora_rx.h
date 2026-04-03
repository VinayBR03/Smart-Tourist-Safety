#pragma once

#include <stdint.h>
#include <stdbool.h>
#include "packet_types.h"

enum class GatewayRxKind : uint8_t {
    NONE,
    HEALTH,       // NodeHeader + HealthPacket
    SOS,          // NodeHeader + SOSPacket
    RFID,         // NodeHeader + RFIDPacket
    NODE_STATUS,  // bare NodeStatusPacket — node's own environmental data
    UNKNOWN,
};

struct GatewayRxPacket {
    GatewayRxKind kind = GatewayRxKind::NONE;
    int8_t        rssi = 0;
    float         snr  = 0.0f;

    // Populated for HEALTH / SOS / RFID
    NodeHeader nodeHeader;

    // Only one of these is valid, selected by kind
    HealthPacket health;
    SOSPacket    sos;
    RFIDPacket   rfid;

    // Populated for NODE_STATUS
    NodeStatusPacket nodeStatus;
};

class GatewayLoRaRx {
public:
    // Initialise SX1278 on SF7 — nodes transmit to gateway at SF7.
    bool begin();

    // Non-blocking poll. Validates inner-packet checksum before returning.
    GatewayRxPacket poll();

    bool isReady() const { return _ready; }

private:
    bool _ready = false;

    bool tryParseNodeHeaderPacket(const uint8_t* buf, int len, GatewayRxPacket& out);
    bool tryParseNodeStatus(const uint8_t* buf, int len, GatewayRxPacket& out);
};