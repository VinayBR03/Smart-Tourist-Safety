#pragma once

// ─────────────────────────────────────────────
// Native-compilable reimplementation of PayloadBuilder
// Uses ArduinoJson v7 API (nullptr instead of JsonNull()).
// ─────────────────────────────────────────────

#include "../native_stubs.h"
#include "packet_types.h"
#include "utils.h"
#include <ArduinoJson.h>
#include <stdint.h>
#include <string.h>
#include <stdio.h>

static constexpr char FIRMWARE_VERSION_TEST[] = "1.0.0";

static const char* alertTypeToString(uint8_t alertType) {
    switch (alertType) {
        case ALERT_HIGH_HEART_RATE: return "HIGH_HEART_RATE";
        case ALERT_LOW_HEART_RATE:  return "LOW_HEART_RATE";
        case ALERT_LOW_SPO2:        return "LOW_SPO2";
        case ALERT_HIGH_TEMP:       return "HIGH_TEMP";
        case ALERT_FALL_DETECTED:   return "FALL_DETECTED";
        case ALERT_SOS:             return "SOS";
        default:                    return nullptr;
    }
}

static bool buildHealth(
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

    // ArduinoJson v7: assign nullptr to produce a JSON null value
    if (hr   > 0.0f) doc["heart_rate"]       = hr;   else doc["heart_rate"]       = nullptr;
    if (spo2 > 0.0f) doc["spo2"]             = spo2; else doc["spo2"]             = nullptr;
    if (temp > 0.0f) doc["body_temperature"] = temp; else doc["body_temperature"] = nullptr;

    doc["is_alert"] = (pkt.is_alert != 0);

    const char* alertStr = (pkt.is_alert && pkt.alert_type != ALERT_NONE)
                           ? alertTypeToString(pkt.alert_type) : nullptr;
    if (alertStr) doc["alert_type"] = alertStr;
    else          doc["alert_type"] = nullptr;

    doc["latitude"]  = decode_gps(nodeHdr.node_lat);
    doc["longitude"] = decode_gps(nodeHdr.node_lon);

    if (recordedAt) doc["recorded_at"] = recordedAt;

    size_t written = serializeJson(doc, out, outLen);
    return written > 0 && written < outLen;
}

static bool buildLocation(
    const char* /*device_id*/,
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
    doc["zone_id"]   = nullptr;    // always null — backend resolves from GPS
    doc["rssi"]      = rssi_val;
    doc["sos_flag"]  = sos_flag;

    if (recordedAt) doc["recorded_at"] = recordedAt;

    size_t written = serializeJson(doc, out, outLen);
    return written > 0 && written < outLen;
}

static bool buildHeartbeat(
    float    battery_percentage,
    float    battery_voltage_mv,
    char*    out,
    uint16_t outLen)
{
    JsonDocument doc;

    doc["battery_percentage"] = battery_percentage;
    doc["battery_voltage"]    = battery_voltage_mv / 1000.0f;
    doc["firmware_version"]   = FIRMWARE_VERSION_TEST;

    size_t written = serializeJson(doc, out, outLen);
    return written > 0 && written < outLen;
}

static bool buildRFIDLocation(
    const RFIDPacket& /*pkt*/,
    const NodeHeader& nodeHdr,
    const char*       recordedAt,
    char*             out,
    uint16_t          outLen)
{
    JsonDocument doc;

    doc["latitude"]  = decode_gps(nodeHdr.node_lat);
    doc["longitude"] = decode_gps(nodeHdr.node_lon);
    doc["zone_id"]   = nullptr;
    doc["rssi"]      = static_cast<float>(nodeHdr.rssi);
    doc["sos_flag"]  = false;

    if (recordedAt) doc["recorded_at"] = recordedAt;

    size_t written = serializeJson(doc, out, outLen);
    return written > 0 && written < outLen;
}