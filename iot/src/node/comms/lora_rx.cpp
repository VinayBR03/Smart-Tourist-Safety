#include "lora_rx.h"

#include <Arduino.h>
#include <SPI.h>
#include <LoRa.h>

#include "../config_node.h"
#include "config.h"
#include "packet_types.h"
#include "utils.h"

// ─────────────────────────────────────────────
// begin()
// ─────────────────────────────────────────────
bool LoRaRx::begin() {
    LoRa.setPins(PIN_LORA_NSS, PIN_LORA_RST, PIN_LORA_DIO0);

    if (!LoRa.begin(LORA_FREQUENCY_HZ)) {
        DEBUG_LOG("[LORA_RX] SX1278 init failed");
        _ready = false;
        return false;
    }

    // Must match wristband TX parameters exactly
    LoRa.setSpreadingFactor(LORA_SF_RANGE);      // SF10
    LoRa.setSignalBandwidth(LORA_BANDWIDTH_HZ);  // 125 kHz
    LoRa.setCodingRate4(LORA_CODING_RATE);       // 4/5
    LoRa.setSyncWord(LORA_SYNC_WORD);            // 0x12
    LoRa.enableCrc();

    // Continuous receive mode — DIO0 fires on packet ready
    LoRa.receive();

    _ready = true;
    DEBUG_LOG("[LORA_RX] Listening (SF10, 433 MHz)");
    return true;
}

// ─────────────────────────────────────────────
// poll()
// ─────────────────────────────────────────────
ReceivedPacket LoRaRx::poll() {
    ReceivedPacket result;
    result.kind = RxPacketKind::NONE;

    if (!_ready) return result;

    int packetSize = LoRa.parsePacket();
    if (packetSize == 0) return result;

    // Read raw bytes from FIFO — cap at max LoRa payload size
    uint8_t buf[LORA_MAX_PAYLOAD_BYTES];
    int     len = 0;

    while (LoRa.available() && len < static_cast<int>(LORA_MAX_PAYLOAD_BYTES)) {
        buf[len++] = static_cast<uint8_t>(LoRa.read());
    }

    if (len < 2) {
        DEBUG_LOG("[LORA_RX] Packet too short — dropped");
        return result;
    }

    result.rssi = static_cast<int8_t>(LoRa.packetRssi());
    result.snr  = LoRa.packetSnr();

    DEBUG_LOGF("[LORA_RX] Raw packet: %d bytes  RSSI=%d  SNR=%.1f\n",
               len, result.rssi, result.snr);

    // Dispatch on first byte (packet type)
    uint8_t pktType = buf[0];

    switch (pktType) {
        case PKT_HEALTH_DATA:
            if (parseHealth(buf, len, result)) {
                result.kind = RxPacketKind::HEALTH;
            }
            break;

        case PKT_SOS_ALERT:
            if (parseSOS(buf, len, result)) {
                result.kind = RxPacketKind::SOS;
            }
            break;

        case PKT_RFID_CHECKPOINT:
            if (parseRFID(buf, len, result)) {
                result.kind = RxPacketKind::RFID;
            }
            break;

        default:
            DEBUG_LOGF("[LORA_RX] Unknown packet type 0x%02X — dropped\n", pktType);
            result.kind = RxPacketKind::UNKNOWN;
            break;
    }

    return result;
}

// ─────────────────────────────────────────────
// parseHealth()
// ─────────────────────────────────────────────
bool LoRaRx::parseHealth(const uint8_t* buf, int len, ReceivedPacket& out) {
    if (len < static_cast<int>(sizeof(HealthPacket))) {
        DEBUG_LOGF("[LORA_RX] HEALTH: too short (%d < %u)\n", len, sizeof(HealthPacket));
        return false;
    }
    memcpy(&out.health, buf, sizeof(HealthPacket));

    if (!validate_checksum(out.health)) {
        DEBUG_LOG("[LORA_RX] HEALTH: checksum FAIL — dropped");
        return false;
    }

    DEBUG_LOGF("[LORA_RX] HEALTH OK  dev=%s  hr=%d  spo2=%d  alert=%d\n",
               out.health.device_id,
               out.health.heart_rate,
               out.health.spo2,
               out.health.is_alert);
    return true;
}

// ─────────────────────────────────────────────
// parseSOS()
// ─────────────────────────────────────────────
bool LoRaRx::parseSOS(const uint8_t* buf, int len, ReceivedPacket& out) {
    if (len < static_cast<int>(sizeof(SOSPacket))) {
        DEBUG_LOGF("[LORA_RX] SOS: too short (%d < %u)\n", len, sizeof(SOSPacket));
        return false;
    }
    memcpy(&out.sos, buf, sizeof(SOSPacket));

    if (!validate_checksum(out.sos)) {
        DEBUG_LOG("[LORA_RX] SOS: checksum FAIL — dropped");
        return false;
    }

    DEBUG_LOGF("[LORA_RX] *** SOS OK  dev=%s ***\n", out.sos.device_id);
    return true;
}

// ─────────────────────────────────────────────
// parseRFID()
// ─────────────────────────────────────────────
bool LoRaRx::parseRFID(const uint8_t* buf, int len, ReceivedPacket& out) {
    if (len < static_cast<int>(sizeof(RFIDPacket))) {
        DEBUG_LOGF("[LORA_RX] RFID: too short (%d < %u)\n", len, sizeof(RFIDPacket));
        return false;
    }
    memcpy(&out.rfid, buf, sizeof(RFIDPacket));

    if (!validate_checksum(out.rfid)) {
        DEBUG_LOG("[LORA_RX] RFID: checksum FAIL — dropped");
        return false;
    }

    DEBUG_LOGF("[LORA_RX] RFID OK  dev=%s\n", out.rfid.device_id);
    return true;
}