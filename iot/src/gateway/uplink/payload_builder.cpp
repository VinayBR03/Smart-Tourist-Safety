#include "payload_builder.h"

#include <Arduino.h>
#include <ArduinoJson.h>
#include <time.h>

#include "../config_gateway.h"
#include "config.h"
#include "utils.h"

// ─────────────────────────────────────────────
// isNtpSynced()
// Year 2024 = unix timestamp 1704067200 — any valid NTP time exceeds this.
// ─────────────────────────────────────────────
bool PayloadBuilder::isNtpSynced() {
    return time(nullptr) > 1704067200UL;
}

// ─────────────────────────────────────────────
// currentTimestamp()
// ─────────────────────────────────────────────
bool PayloadBuilder::currentTimestamp(char* buf, uint8_t bufLen) {
    if (!isNtpSynced()) return false;
    time_t    now = time(nullptr);
    struct tm* utc = gmtime(&now);
    strftime(buf, bufLen, "%Y-%m-%dT%H:%M:%SZ", utc);
    return true;
}

// ─────────────────────────────────────────────
// alertTypeToString()
// ─────────────────────────────────────────────
const char* PayloadBuilder::alertTypeToString(uint8_t alertType) {
    switch (alertType) {
        case ALERT_HIGH_HEART_RATE: return ALERT_STR_HIGH_HEART_RATE;
        case ALERT_LOW_HEART_RATE:  return ALERT_STR_LOW_HEART_RATE;
        case ALERT_LOW_SPO2:        return ALERT_STR_LOW_SPO2;
        case ALERT_HIGH_TEMP:       return ALERT_STR_HIGH_TEMP;
        case ALERT_FALL_DETECTED:   return ALERT_STR_FALL_DETECTED;
        case ALERT_SOS:             return ALERT_STR_SOS;
        default:                    return nullptr;
    }
}

// ─────────────────────────────────────────────
// buildHealth()
// ─────────────────────────────────────────────
bool PayloadBuilder::buildHealth(
    const HealthPacket& pkt,
    const NodeHeader&   nodeHdr,
    const char*         recordedAt,
    char*               out,
    uint16_t            outLen)
{
    JsonDocument doc;

    float hr   = decode_heart_rate(pkt.heart_rate);
    float spo2 = static_cast<float>(pkt.spo2);
    float temp = decode_body_temp(pkt.body_temp);

    (hr > 0.0f) ? doc["heart_rate"].set(hr) : doc["heart_rate"].set(nullptr);
    (spo2 > 0.0f) ? doc["spo2"].set(spo2) : doc["spo2"].set(nullptr);
    (temp > 0.0f) ? doc["body_temperature"].set(temp) : doc["body_temperature"].set(nullptr);

    doc["is_alert"]         = (pkt.is_alert != 0);

    const char* alertStr = (pkt.is_alert && pkt.alert_type != ALERT_NONE)
                           ? alertTypeToString(pkt.alert_type)
                           : nullptr;
    if (alertStr) doc["alert_type"] = alertStr;
    else          doc["alert_type"] = nullptr;

    // Location reported as the forwarding node's hardcoded GPS
    doc["latitude"]  = decode_gps(nodeHdr.node_lat);
    doc["longitude"] = decode_gps(nodeHdr.node_lon);

    if (recordedAt) doc["recorded_at"] = recordedAt;

    size_t written = serializeJson(doc, out, outLen);
    return written > 0 && written < outLen;
}

// ─────────────────────────────────────────────
// buildSOSHealth()
// ─────────────────────────────────────────────
bool PayloadBuilder::buildSOSHealth(
    const SOSPacket&  pkt,
    const NodeHeader& nodeHdr,
    const char*       recordedAt,
    char*             out,
    uint16_t          outLen)
{
    JsonDocument doc;

    doc["heart_rate"]       = nullptr;
    doc["spo2"]             = nullptr;
    doc["body_temperature"] = nullptr;
    doc["is_alert"]         = true;
    doc["alert_type"]       = ALERT_STR_SOS;
    doc["latitude"]         = decode_gps(nodeHdr.node_lat);
    doc["longitude"]        = decode_gps(nodeHdr.node_lon);

    if (recordedAt) doc["recorded_at"] = recordedAt;

    size_t written = serializeJson(doc, out, outLen);
    return written > 0 && written < outLen;
}

// ─────────────────────────────────────────────
// buildLocation()
// ─────────────────────────────────────────────
bool PayloadBuilder::buildLocation(
    const char* device_id,
    float       latitude,
    float       longitude,
    float       rssi_val,
    bool        sos_flag,
    const char* recordedAt,
    char*       out,
    uint16_t    outLen)
{
    JsonDocument doc;

    doc["latitude"]  = latitude;
    doc["longitude"] = longitude;
    doc["zone_id"]   = nullptr;
    doc["rssi"]      = rssi_val;
    doc["sos_flag"]  = sos_flag;

    if (recordedAt) doc["recorded_at"] = recordedAt;

    size_t written = serializeJson(doc, out, outLen);
    return written > 0 && written < outLen;
}

// ─────────────────────────────────────────────
// buildRFIDLocation()
// ─────────────────────────────────────────────
bool PayloadBuilder::buildRFIDLocation(
    const RFIDPacket& pkt,
    const NodeHeader& nodeHdr,
    const char*       recordedAt,
    char*             out,
    uint16_t          outLen)
{
    JsonDocument doc;

    doc["device_id"] = pkt.device_id;
    doc["latitude"]  = decode_gps(nodeHdr.node_lat);
    doc["longitude"] = decode_gps(nodeHdr.node_lon);
    doc["zone_id"]   = nullptr;
    doc["rssi"]      = static_cast<float>(nodeHdr.rssi);
    doc["sos_flag"]  = false;

    if (recordedAt) doc["recorded_at"] = recordedAt;

    size_t written = serializeJson(doc, out, outLen);
    return written > 0 && written < outLen;
}

// ─────────────────────────────────────────────
// buildHeartbeat()
// ─────────────────────────────────────────────
bool PayloadBuilder::buildHeartbeat(
    float    battery_percentage,
    float    battery_voltage_mv,
    char*    out,
    uint16_t outLen)
{
    JsonDocument doc;

    doc["battery_percentage"] = battery_percentage;
    doc["battery_voltage"]    = battery_voltage_mv / 1000.0f;  // mV → V
    doc["firmware_version"]   = FIRMWARE_VERSION;

    size_t written = serializeJson(doc, out, outLen);
    return written > 0 && written < outLen;
}