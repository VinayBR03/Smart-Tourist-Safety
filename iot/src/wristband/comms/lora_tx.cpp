#include "lora_tx.h"

#include <Arduino.h>
#include <SPI.h>
#include <LoRa.h>

#include "../config_wristband.h"
#include "config.h"
#include "packet_types.h"
#include "utils.h"

// ─────────────────────────────────────────────
// begin()
// ─────────────────────────────────────────────
bool LoRaTx::begin() {
    LoRa.setPins(PIN_LORA_NSS, PIN_LORA_RST, PIN_LORA_DIO0);

    if (!LoRa.begin(LORA_FREQUENCY_HZ)) {
        DEBUG_LOG("[LORA_TX] SX1278 init failed");
        _ready = false;
        return false;
    }

    LoRa.setSpreadingFactor(LORA_SF_RANGE);       // SF10 — max range for wristband
    LoRa.setSignalBandwidth(LORA_BANDWIDTH_HZ);   // 125 kHz
    LoRa.setCodingRate4(LORA_CODING_RATE);        // 4/5
    LoRa.setSyncWord(LORA_SYNC_WORD);             // 0x12 — private network
    LoRa.setTxPower(LORA_TX_POWER_DBM);
    LoRa.enableCrc();                             // hardware CRC on top of our XOR checksum

    _ready = true;
    DEBUG_LOG("[LORA_TX] SX1278 ready (SF10, 433 MHz)");
    return true;
}

// ─────────────────────────────────────────────
// sendHealth()
// ─────────────────────────────────────────────
LoRaTxResult LoRaTx::sendHealth(
    const char* device_id,
    float       heart_rate,
    float       spo2,
    float       body_temp,
    bool        is_alert,
    uint8_t     alert_type,
    float       latitude,
    float       longitude,
    uint8_t     battery_pct,
    uint32_t    timestamp)
{
    if (!_ready) return LoRaTxResult::ERR_NOT_INIT;

    HealthPacket pkt;
    pkt.packet_type = PKT_HEALTH_DATA;
    copy_device_id(pkt.device_id, device_id);
    pkt.heart_rate  = encode_heart_rate(heart_rate);
    pkt.spo2        = static_cast<uint8_t>(spo2);
    pkt.body_temp   = encode_body_temp(body_temp);
    pkt.is_alert    = is_alert ? 1u : 0u;
    pkt.alert_type  = alert_type;
    pkt.latitude    = encode_gps(latitude);
    pkt.longitude   = encode_gps(longitude);
    pkt.battery_pct = battery_pct;
    pkt.timestamp   = timestamp;
    stamp_checksum(pkt);

    DEBUG_LOGF("[LORA_TX] HEALTH hr=%.1f spo2=%.0f temp=%.1f alert=%d type=%d\n",
               heart_rate, spo2, body_temp, is_alert, alert_type);

    return transmitRaw(reinterpret_cast<const uint8_t*>(&pkt), sizeof(pkt));
}

// ─────────────────────────────────────────────
// sendSOS()
// ─────────────────────────────────────────────
LoRaTxResult LoRaTx::sendSOS(
    const char* device_id,
    float       latitude,
    float       longitude,
    uint8_t     battery_pct,
    uint32_t    timestamp)
{
    if (!_ready) return LoRaTxResult::ERR_NOT_INIT;

    SOSPacket pkt;
    pkt.packet_type = PKT_SOS_ALERT;
    copy_device_id(pkt.device_id, device_id);
    pkt.latitude    = encode_gps(latitude);
    pkt.longitude   = encode_gps(longitude);
    pkt.timestamp   = timestamp;
    pkt.battery_pct = battery_pct;
    stamp_checksum(pkt);

    DEBUG_LOG("[LORA_TX] *** SOS TRANSMIT ***");

    return transmitRaw(reinterpret_cast<const uint8_t*>(&pkt), sizeof(pkt));
}

// ─────────────────────────────────────────────
// sendRFID()
// ─────────────────────────────────────────────
LoRaTxResult LoRaTx::sendRFID(
    const char* device_id,
    const char* rfid_uid,
    uint32_t    timestamp)
{
    if (!_ready) return LoRaTxResult::ERR_NOT_INIT;

    RFIDPacket pkt;
    pkt.packet_type = PKT_RFID_CHECKPOINT;
    copy_device_id(pkt.device_id, device_id);
    memset(pkt.rfid_uid, 0, RFID_UID_LEN);
    memcpy(pkt.rfid_uid, rfid_uid, RFID_UID_LEN);
    pkt.timestamp   = timestamp;
    stamp_checksum(pkt);

    DEBUG_LOGF("[LORA_TX] RFID uid=%02X%02X%02X%02X\n",
               (uint8_t)rfid_uid[0], (uint8_t)rfid_uid[1],
               (uint8_t)rfid_uid[2], (uint8_t)rfid_uid[3]);

    return transmitRaw(reinterpret_cast<const uint8_t*>(&pkt), sizeof(pkt));
}

// ─────────────────────────────────────────────
// sleep() / wake()
// ─────────────────────────────────────────────
void LoRaTx::sleep() {
    LoRa.sleep();
    DEBUG_LOG("[LORA_TX] Radio sleeping");
}

void LoRaTx::wake() {
    LoRa.idle();   // transitions SX1278 from sleep → standby, ready for next TX
    DEBUG_LOG("[LORA_TX] Radio awake");
}

// ─────────────────────────────────────────────
// transmitRaw()
// ─────────────────────────────────────────────
LoRaTxResult LoRaTx::transmitRaw(const uint8_t* data, size_t len) {
    if (!LoRa.beginPacket()) {
        DEBUG_LOG("[LORA_TX] beginPacket() busy — radio not ready");
        return LoRaTxResult::ERR_BUSY;
    }

    size_t written = LoRa.write(data, len);
    if (written != len) {
        DEBUG_LOGF("[LORA_TX] Write truncated: wrote %u of %u bytes\n",
                   (unsigned)written, (unsigned)len);
        LoRa.endPacket();
        return LoRaTxResult::ERR_PACKET_BUILD;
    }

    // Blocking TX — endPacket(true) = async, endPacket() = blocking.
    // We use blocking here so we know the air time is complete before sleeping.
    LoRa.endPacket();

    DEBUG_LOGF("[LORA_TX] Transmitted %u bytes OK\n", (unsigned)len);
    return LoRaTxResult::OK;
}