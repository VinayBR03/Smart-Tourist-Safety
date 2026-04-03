#pragma once

#include <stdint.h>
#include <stdbool.h>
#include <cstddef>
#include "packet_types.h"

enum class NodeTxResult : uint8_t {
    OK,
    ERR_NOT_INIT,
    ERR_BUSY,
    ERR_WRITE,
};

class NodeLoRaTx {
public:
    // SX1278 is shared with LoRaRx — begin() must be called AFTER LoRaRx::begin().
    // This class only switches the radio from RX to TX mode and back.
    // No separate SX1278 init here — just sets TX power.
    bool begin();

    // Forward a wristband packet upstream by prepending a NodeHeader and
    // retransmitting the raw original packet bytes.
    NodeTxResult forwardPacket(
        const NodeHeader& header,
        const uint8_t*    originalPacket,
        size_t            originalLen
    );

    // Transmit a node's own NodeStatusPacket upstream.
    NodeTxResult sendNodeStatus(const NodeStatusPacket& pkt);

    bool isReady() const { return _ready; }

private:
    bool _ready = false;

    NodeTxResult transmitRaw(const uint8_t* data, size_t len);
};