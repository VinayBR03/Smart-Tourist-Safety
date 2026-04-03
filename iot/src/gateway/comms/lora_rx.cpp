#include "lora_rx.h"

#include <Arduino.h>
#include <SPI.h>
#include <LoRa.h>

#include "../config_gateway.h"
#include "config.h"
#include "packet_types.h"
#include "utils.h"

// ─────────────────────────────────────────────
// begin()
// ─────────────────────────────────────────────
bool GatewayLoRaRx::begin() {
    LoRa.setPins(PIN_LORA_NSS, PIN_LORA_RST, PIN_LORA_DIO0);

    if (!LoRa.begin(LORA_FREQUENCY_HZ)) {
        DEBUG_LOG("[GW_LORA] SX1278 init failed");
        _ready = false;
        return false;
    }

    LoRa.setSpreadingFactor(LORA_SF_SPEED);      // SF7 — matches node TX hop
    LoRa.setSignalBandwidth(LORA_BANDWIDTH_HZ);  // 125 kHz
    LoRa.setCodingRate4(LORA_CODING_RATE);       // 4/5
    LoRa.setSyncWord(LORA_SYNC_WORD);            // 0x12
    LoRa.enableCrc();
    LoRa.receive();   // continuous receive mode

    _ready = true;
    DEBUG_LOG("[GW_LORA] Listening on SF7, 433 MHz");
    return true;
}

// ─────────────────────────────────────────────
// poll()
// ─────────────────────────────────────────────
GatewayRxPacket GatewayLoRaRx::poll() {
    GatewayRxPacket result;
    result.kind = GatewayRxKind::NONE;

    if (!_ready) return result;

    int packetSize = LoRa.parsePacket();
    if (packetSize == 0) return result;

    uint8_t buf[LORA_MAX_PAYLOAD_BYTES];
    int     len = 0;

    while (LoRa.available() && len < static_cast<int>(LORA_MAX_PAYLOAD_BYTES)) {
        buf[len++] = static_cast<uint8_t>(LoRa.read());
    }

    if (len < 2) {
        DEBUG_LOG("[GW_LORA] Packet too short — dropped");
        return result;
    }

    result.rssi = static_cast<int8_t>(LoRa.packetRssi());
    result.snr  = LoRa.packetSnr();

    DEBUG_LOGF("[GW_LORA] %d bytes  RSSI=%d  SNR=%.1f\n", len, result.rssi, result.snr);

    // Distinguish bare NodeStatusPacket (starts with 0x04) from
    // NodeHeader-prefixed wristband packets (starts with ASCII node_id char, >= 0x41).
    // All valid LoRa packet_type bytes are 0x01–0x06 — NodeHeader.node_id[0] is never that.
    if (buf[0] == PKT_NODE_STATUS) {
        tryParseNodeStatus(buf, len, result);
    } else {
        tryParseNodeHeaderPacket(buf, len, result);
    }

    return result;
}

// ─────────────────────────────────────────────
// tryParseNodeHeaderPacket()
// ─────────────────────────────────────────────
bool GatewayLoRaRx::tryParseNodeHeaderPacket(const uint8_t* buf, int len, GatewayRxPacket& out) {
    if (len < static_cast<int>(sizeof(NodeHeader) + 2)) {
        DEBUG_LOG("[GW_LORA] Too short for NodeHeader + inner packet");
        return false;
    }

    memcpy(&out.nodeHeader, buf, sizeof(NodeHeader));

    const uint8_t* inner    = buf + sizeof(NodeHeader);
    int            innerLen = len - static_cast<int>(sizeof(NodeHeader));
    uint8_t        pktType  = inner[0];

    switch (pktType) {
        case PKT_HEALTH_DATA:
            if (innerLen < static_cast<int>(sizeof(HealthPacket))) {
                DEBUG_LOG("[GW_LORA] HEALTH inner too short"); return false;
            }
            memcpy(&out.health, inner, sizeof(HealthPacket));
            if (!validate_checksum(out.health)) {
                DEBUG_LOG("[GW_LORA] HEALTH checksum FAIL"); return false;
            }
            out.kind = GatewayRxKind::HEALTH;
            DEBUG_LOGF("[GW_LORA] HEALTH from node=%.4s dev=%.12s\n",
                       out.nodeHeader.node_id, out.health.device_id);
            return true;

        case PKT_SOS_ALERT:
            if (innerLen < static_cast<int>(sizeof(SOSPacket))) {
                DEBUG_LOG("[GW_LORA] SOS inner too short"); return false;
            }
            memcpy(&out.sos, inner, sizeof(SOSPacket));
            if (!validate_checksum(out.sos)) {
                DEBUG_LOG("[GW_LORA] SOS checksum FAIL"); return false;
            }
            out.kind = GatewayRxKind::SOS;
            DEBUG_LOGF("[GW_LORA] *** SOS from node=%.4s dev=%.12s ***\n",
                       out.nodeHeader.node_id, out.sos.device_id);
            return true;

        case PKT_RFID_CHECKPOINT:
            if (innerLen < static_cast<int>(sizeof(RFIDPacket))) {
                DEBUG_LOG("[GW_LORA] RFID inner too short"); return false;
            }
            memcpy(&out.rfid, inner, sizeof(RFIDPacket));
            if (!validate_checksum(out.rfid)) {
                DEBUG_LOG("[GW_LORA] RFID checksum FAIL"); return false;
            }
            out.kind = GatewayRxKind::RFID;
            DEBUG_LOGF("[GW_LORA] RFID from node=%.4s dev=%.12s\n",
                       out.nodeHeader.node_id, out.rfid.device_id);
            return true;

        default:
            DEBUG_LOGF("[GW_LORA] Unknown inner type 0x%02X — dropped\n", pktType);
            out.kind = GatewayRxKind::UNKNOWN;
            return false;
    }
}

// ─────────────────────────────────────────────
// tryParseNodeStatus()
// ─────────────────────────────────────────────
bool GatewayLoRaRx::tryParseNodeStatus(const uint8_t* buf, int len, GatewayRxPacket& out) {
    if (len < static_cast<int>(sizeof(NodeStatusPacket))) {
        DEBUG_LOG("[GW_LORA] NodeStatus too short"); return false;
    }
    memcpy(&out.nodeStatus, buf, sizeof(NodeStatusPacket));
    if (!validate_checksum(out.nodeStatus)) {
        DEBUG_LOG("[GW_LORA] NodeStatus checksum FAIL"); return false;
    }
    out.kind = GatewayRxKind::NODE_STATUS;
    DEBUG_LOGF("[GW_LORA] NodeStatus from node=%.4s bat=%d%%\n",
               out.nodeStatus.node_id, out.nodeStatus.battery_pct);
    return true;
}