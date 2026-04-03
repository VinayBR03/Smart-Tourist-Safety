#include "lora_tx.h"

#include <Arduino.h>
#include <LoRa.h>

#include "../config_node.h"
#include "config.h"
#include "utils.h"

// ─────────────────────────────────────────────
// begin()
// ─────────────────────────────────────────────
bool NodeLoRaTx::begin() {
    // LoRa library is already initialised by LoRaRx::begin().
    // Node TX uses SF7 (faster, shorter hop to gateway).
    LoRa.setSpreadingFactor(LORA_SF_SPEED);   // SF7 — node→gateway hop
    LoRa.setTxPower(LORA_TX_POWER_DBM);

    _ready = true;
    DEBUG_LOG("[NODE_TX] Ready (SF7, 433 MHz)");
    return true;
}

// ─────────────────────────────────────────────
// forwardPacket()
//
// Wire format:
//   [ NodeHeader (17 bytes) ][ original wristband packet bytes ]
//
// The NodeHeader carries node_id, hardcoded GPS, and RSSI so the gateway
// can report the node's location and proximity info when it builds the JSON.
// ─────────────────────────────────────────────
NodeTxResult NodeLoRaTx::forwardPacket(
    const NodeHeader& header,
    const uint8_t*    originalPacket,
    size_t            originalLen)
{
    if (!_ready) return NodeTxResult::ERR_NOT_INIT;

    size_t totalLen = sizeof(NodeHeader) + originalLen;
    if (totalLen > LORA_MAX_PAYLOAD_BYTES) {
        DEBUG_LOGF("[NODE_TX] Payload too large: %u bytes\n", (unsigned)totalLen);
        return NodeTxResult::ERR_WRITE;
    }

    // Build combined buffer on stack — max 55 bytes, safe for stack allocation
    uint8_t buf[LORA_MAX_PAYLOAD_BYTES];
    memcpy(buf,                          &header,        sizeof(NodeHeader));
    memcpy(buf + sizeof(NodeHeader),     originalPacket, originalLen);

    // Switch radio from RX to TX
    LoRa.idle();

    NodeTxResult res = transmitRaw(buf, totalLen);

    // Return to continuous receive mode
    LoRa.setSpreadingFactor(LORA_SF_RANGE);   // back to SF10 for wristband RX
    LoRa.receive();

    return res;
}

// ─────────────────────────────────────────────
// sendNodeStatus()
// ─────────────────────────────────────────────
NodeTxResult NodeLoRaTx::sendNodeStatus(const NodeStatusPacket& pkt) {
    if (!_ready) return NodeTxResult::ERR_NOT_INIT;

    LoRa.idle();
    NodeTxResult res = transmitRaw(
        reinterpret_cast<const uint8_t*>(&pkt),
        sizeof(NodeStatusPacket)
    );
    LoRa.setSpreadingFactor(LORA_SF_RANGE);
    LoRa.receive();
    return res;
}

// ─────────────────────────────────────────────
// transmitRaw()
// ─────────────────────────────────────────────
NodeTxResult NodeLoRaTx::transmitRaw(const uint8_t* data, size_t len) {
    if (!LoRa.beginPacket()) {
        DEBUG_LOG("[NODE_TX] beginPacket() busy");
        return NodeTxResult::ERR_BUSY;
    }

    size_t written = LoRa.write(data, len);
    if (written != len) {
        LoRa.endPacket();
        return NodeTxResult::ERR_WRITE;
    }

    LoRa.endPacket();   // blocking TX

    DEBUG_LOGF("[NODE_TX] Forwarded %u bytes\n", (unsigned)len);
    return NodeTxResult::OK;
}