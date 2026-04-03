#include "../native_stubs.h"
#include "payload_builder_native.h"
#include "packet_types.h"
#include "utils.h"

#include <ArduinoJson.h>
#include <unity.h>
#include <string.h>
#include <stdio.h>

static constexpr uint16_t BUF_LEN = 512;
static char buf[BUF_LEN];

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
static HealthPacket makeHealthPkt(
    float hr, float spo2, float temp,
    bool isAlert, uint8_t alertType)
{
    HealthPacket pkt;
    memset(&pkt, 0, sizeof(pkt));
    pkt.packet_type = PKT_HEALTH_DATA;
    strncpy(pkt.device_id, "WB001", DEVICE_ID_LEN - 1);
    pkt.heart_rate  = encode_heart_rate(hr);
    pkt.spo2        = static_cast<uint8_t>(spo2);
    pkt.body_temp   = encode_body_temp(temp);
    pkt.is_alert    = isAlert ? 1 : 0;
    pkt.alert_type  = alertType;
    pkt.latitude    = encode_gps(25.43580f);
    pkt.longitude   = encode_gps(81.84630f);
    pkt.battery_pct = 80;
    pkt.timestamp   = 0;
    stamp_checksum(pkt);
    return pkt;
}

static NodeHeader makeNodeHeader() {
    NodeHeader hdr;
    memset(&hdr, 0, sizeof(hdr));
    strncpy(hdr.node_id, "N001", NODE_ID_LEN);
    hdr.node_lat = encode_gps(25.43580f);
    hdr.node_lon = encode_gps(81.84630f);
    hdr.rssi     = static_cast<int8_t>(-87);
    return hdr;
}

// ─────────────────────────────────────────────
// ArduinoJson v7 helper macros
// doc["key"].is<JsonVariant>() = key exists (even if null)
// doc["key"].isNull()          = key missing OR value is null
// ─────────────────────────────────────────────
#define ASSERT_KEY_PRESENT(doc, key)  TEST_ASSERT_TRUE_MESSAGE( \
    (doc)[key].template is<JsonVariant>(), "Key missing: " key)
#define ASSERT_KEY_ABSENT(doc, key)   TEST_ASSERT_TRUE_MESSAGE( \
    (doc)[key].isNull(), "Key should be absent: " key)

// ─────────────────────────────────────────────
// buildHealth — normal packet, no alert
// ─────────────────────────────────────────────
void test_health_json_has_required_fields(void) {
    HealthPacket pkt = makeHealthPkt(78.5f, 98.0f, 37.1f, false, ALERT_NONE);
    NodeHeader   hdr = makeNodeHeader();

    bool ok = buildHealth(pkt, hdr, "2025-03-30T10:15:00Z", buf, BUF_LEN);
    TEST_ASSERT_TRUE(ok);

    JsonDocument doc;
    DeserializationError err = deserializeJson(doc, buf);
    TEST_ASSERT_EQUAL_INT(DeserializationError::Ok, err.code());

    ASSERT_KEY_PRESENT(doc, "heart_rate");
    ASSERT_KEY_PRESENT(doc, "spo2");
    ASSERT_KEY_PRESENT(doc, "body_temperature");
    ASSERT_KEY_PRESENT(doc, "is_alert");
    ASSERT_KEY_PRESENT(doc, "alert_type");
    ASSERT_KEY_PRESENT(doc, "latitude");
    ASSERT_KEY_PRESENT(doc, "longitude");
    ASSERT_KEY_PRESENT(doc, "recorded_at");
}

void test_health_json_device_id_absent(void) {
    HealthPacket pkt = makeHealthPkt(78.5f, 98.0f, 37.1f, false, ALERT_NONE);
    NodeHeader   hdr = makeNodeHeader();

    buildHealth(pkt, hdr, nullptr, buf, BUF_LEN);

    JsonDocument doc;
    deserializeJson(doc, buf);
    ASSERT_KEY_ABSENT(doc, "device_id");
}

void test_health_json_values_correct(void) {
    HealthPacket pkt = makeHealthPkt(78.5f, 98.0f, 37.1f, false, ALERT_NONE);
    NodeHeader   hdr = makeNodeHeader();

    buildHealth(pkt, hdr, "2025-03-30T10:15:00Z", buf, BUF_LEN);

    JsonDocument doc;
    deserializeJson(doc, buf);

    TEST_ASSERT_FLOAT_WITHIN(0.1f,  78.5f, doc["heart_rate"].as<float>());
    TEST_ASSERT_FLOAT_WITHIN(0.1f,  98.0f, doc["spo2"].as<float>());
    TEST_ASSERT_FLOAT_WITHIN(0.01f, 37.1f, doc["body_temperature"].as<float>());
    TEST_ASSERT_FALSE(doc["is_alert"].as<bool>());
    TEST_ASSERT_TRUE(doc["alert_type"].isNull());
}

void test_health_json_location_uses_node_gps(void) {
    HealthPacket pkt = makeHealthPkt(78.5f, 98.0f, 37.1f, false, ALERT_NONE);
    NodeHeader   hdr = makeNodeHeader();

    buildHealth(pkt, hdr, nullptr, buf, BUF_LEN);

    JsonDocument doc;
    deserializeJson(doc, buf);

    TEST_ASSERT_FLOAT_WITHIN(0.0001f, 25.43580f, doc["latitude"].as<float>());
    TEST_ASSERT_FLOAT_WITHIN(0.0001f, 81.84630f, doc["longitude"].as<float>());
}

// ─────────────────────────────────────────────
// buildHealth — alert packets
// ─────────────────────────────────────────────
void test_health_alert_type_high_hr_string(void) {
    HealthPacket pkt = makeHealthPkt(150.0f, 98.0f, 37.0f, true, ALERT_HIGH_HEART_RATE);
    NodeHeader   hdr = makeNodeHeader();
    buildHealth(pkt, hdr, nullptr, buf, BUF_LEN);

    JsonDocument doc; deserializeJson(doc, buf);
    TEST_ASSERT_TRUE(doc["is_alert"].as<bool>());
    TEST_ASSERT_EQUAL_STRING("HIGH_HEART_RATE", doc["alert_type"].as<const char*>());
}

void test_health_alert_type_low_spo2_string(void) {
    HealthPacket pkt = makeHealthPkt(80.0f, 90.0f, 37.0f, true, ALERT_LOW_SPO2);
    NodeHeader   hdr = makeNodeHeader();
    buildHealth(pkt, hdr, nullptr, buf, BUF_LEN);

    JsonDocument doc; deserializeJson(doc, buf);
    TEST_ASSERT_EQUAL_STRING("LOW_SPO2", doc["alert_type"].as<const char*>());
}

void test_health_alert_type_fall_string(void) {
    HealthPacket pkt = makeHealthPkt(80.0f, 98.0f, 37.0f, true, ALERT_FALL_DETECTED);
    NodeHeader   hdr = makeNodeHeader();
    buildHealth(pkt, hdr, nullptr, buf, BUF_LEN);

    JsonDocument doc; deserializeJson(doc, buf);
    TEST_ASSERT_EQUAL_STRING("FALL_DETECTED", doc["alert_type"].as<const char*>());
}

void test_health_alert_type_high_temp_string(void) {
    HealthPacket pkt = makeHealthPkt(80.0f, 98.0f, 39.0f, true, ALERT_HIGH_TEMP);
    NodeHeader   hdr = makeNodeHeader();
    buildHealth(pkt, hdr, nullptr, buf, BUF_LEN);

    JsonDocument doc; deserializeJson(doc, buf);
    TEST_ASSERT_EQUAL_STRING("HIGH_TEMP", doc["alert_type"].as<const char*>());
}

// ─────────────────────────────────────────────
// buildHealth — zero/invalid readings become null
// ─────────────────────────────────────────────
void test_health_zero_hr_becomes_null(void) {
    HealthPacket pkt = makeHealthPkt(0.0f, 98.0f, 37.0f, false, ALERT_NONE);
    NodeHeader   hdr = makeNodeHeader();
    buildHealth(pkt, hdr, nullptr, buf, BUF_LEN);

    JsonDocument doc; deserializeJson(doc, buf);
    TEST_ASSERT_TRUE(doc["heart_rate"].isNull());
}

void test_health_zero_temp_becomes_null(void) {
    HealthPacket pkt = makeHealthPkt(78.0f, 98.0f, 0.0f, false, ALERT_NONE);
    NodeHeader   hdr = makeNodeHeader();
    buildHealth(pkt, hdr, nullptr, buf, BUF_LEN);

    JsonDocument doc; deserializeJson(doc, buf);
    TEST_ASSERT_TRUE(doc["body_temperature"].isNull());
}

void test_health_recorded_at_omitted_when_null(void) {
    HealthPacket pkt = makeHealthPkt(78.5f, 98.0f, 37.1f, false, ALERT_NONE);
    NodeHeader   hdr = makeNodeHeader();
    buildHealth(pkt, hdr, nullptr, buf, BUF_LEN);

    JsonDocument doc; deserializeJson(doc, buf);
    // Key should not be present at all when recordedAt=nullptr
    TEST_ASSERT_FALSE(doc["recorded_at"].template is<JsonVariant>());
}

void test_health_recorded_at_present_when_provided(void) {
    HealthPacket pkt = makeHealthPkt(78.5f, 98.0f, 37.1f, false, ALERT_NONE);
    NodeHeader   hdr = makeNodeHeader();
    buildHealth(pkt, hdr, "2025-03-30T10:15:00Z", buf, BUF_LEN);

    JsonDocument doc; deserializeJson(doc, buf);
    TEST_ASSERT_EQUAL_STRING("2025-03-30T10:15:00Z",
                             doc["recorded_at"].as<const char*>());
}

// ─────────────────────────────────────────────
// buildLocation
// ─────────────────────────────────────────────
void test_location_json_has_required_fields(void) {
    bool ok = buildLocation(
        "WB001", 25.43580f, 81.84630f, -87.0f, false,
        "2025-03-30T10:15:00Z", buf, BUF_LEN);
    TEST_ASSERT_TRUE(ok);

    JsonDocument doc; deserializeJson(doc, buf);

    ASSERT_KEY_PRESENT(doc, "latitude");
    ASSERT_KEY_PRESENT(doc, "longitude");
    ASSERT_KEY_PRESENT(doc, "zone_id");
    ASSERT_KEY_PRESENT(doc, "rssi");
    ASSERT_KEY_PRESENT(doc, "sos_flag");
}

void test_location_device_id_absent(void) {
    buildLocation("WB001", 25.43580f, 81.84630f, -87.0f, false, nullptr, buf, BUF_LEN);
    JsonDocument doc; deserializeJson(doc, buf);
    ASSERT_KEY_ABSENT(doc, "device_id");
}

void test_location_sos_flag_false(void) {
    buildLocation("WB001", 25.43580f, 81.84630f, -87.0f, false, nullptr, buf, BUF_LEN);
    JsonDocument doc; deserializeJson(doc, buf);
    TEST_ASSERT_FALSE(doc["sos_flag"].as<bool>());
}

void test_location_sos_flag_true(void) {
    buildLocation("WB001", 25.43580f, 81.84630f, -87.0f, true, nullptr, buf, BUF_LEN);
    JsonDocument doc; deserializeJson(doc, buf);
    TEST_ASSERT_TRUE(doc["sos_flag"].as<bool>());
}

void test_location_zone_id_is_null(void) {
    buildLocation("WB001", 25.43580f, 81.84630f, -87.0f, false, nullptr, buf, BUF_LEN);
    JsonDocument doc; deserializeJson(doc, buf);
    // zone_id key is present but its value is JSON null
    TEST_ASSERT_TRUE(doc["zone_id"].isNull());
}

void test_location_rssi_value(void) {
    buildLocation("WB001", 25.43580f, 81.84630f, -87.0f, false, nullptr, buf, BUF_LEN);
    JsonDocument doc; deserializeJson(doc, buf);
    TEST_ASSERT_FLOAT_WITHIN(0.1f, -87.0f, doc["rssi"].as<float>());
}

// ─────────────────────────────────────────────
// buildHeartbeat
// ─────────────────────────────────────────────
void test_heartbeat_json_has_required_fields(void) {
    bool ok = buildHeartbeat(87.5f, 3950.0f, buf, BUF_LEN);
    TEST_ASSERT_TRUE(ok);

    JsonDocument doc; deserializeJson(doc, buf);

    ASSERT_KEY_PRESENT(doc, "battery_percentage");
    ASSERT_KEY_PRESENT(doc, "battery_voltage");
    ASSERT_KEY_PRESENT(doc, "firmware_version");
}

void test_heartbeat_voltage_converted_to_volts(void) {
    buildHeartbeat(87.5f, 3950.0f, buf, BUF_LEN);
    JsonDocument doc; deserializeJson(doc, buf);
    TEST_ASSERT_FLOAT_WITHIN(0.001f, 3.95f, doc["battery_voltage"].as<float>());
}

void test_heartbeat_battery_percentage_value(void) {
    buildHeartbeat(87.5f, 3950.0f, buf, BUF_LEN);
    JsonDocument doc; deserializeJson(doc, buf);
    TEST_ASSERT_FLOAT_WITHIN(0.1f, 87.5f, doc["battery_percentage"].as<float>());
}

void test_heartbeat_firmware_version_present(void) {
    buildHeartbeat(50.0f, 3700.0f, buf, BUF_LEN);
    JsonDocument doc; deserializeJson(doc, buf);
    const char* fwv = doc["firmware_version"].as<const char*>();
    TEST_ASSERT_NOT_NULL(fwv);
    TEST_ASSERT_GREATER_THAN(0, (int)strlen(fwv));
}

// ─────────────────────────────────────────────
// buildRFIDLocation
// ─────────────────────────────────────────────
void test_rfid_location_device_id_absent(void) {
    RFIDPacket pkt;
    memset(&pkt, 0, sizeof(pkt));
    pkt.packet_type = PKT_RFID_CHECKPOINT;
    strncpy(pkt.device_id, "WB001", DEVICE_ID_LEN - 1);
    memcpy(pkt.rfid_uid, "\xAB\xCD\xEF\x01\x02\x03\x04\x05", RFID_UID_LEN);
    stamp_checksum(pkt);

    NodeHeader hdr = makeNodeHeader();
    buildRFIDLocation(pkt, hdr, nullptr, buf, BUF_LEN);

    JsonDocument doc; deserializeJson(doc, buf);
    ASSERT_KEY_ABSENT(doc, "device_id");
}

void test_rfid_location_sos_flag_false(void) {
    RFIDPacket pkt;
    memset(&pkt, 0, sizeof(pkt));
    pkt.packet_type = PKT_RFID_CHECKPOINT;
    strncpy(pkt.device_id, "WB001", DEVICE_ID_LEN - 1);
    stamp_checksum(pkt);

    NodeHeader hdr = makeNodeHeader();
    buildRFIDLocation(pkt, hdr, nullptr, buf, BUF_LEN);

    JsonDocument doc; deserializeJson(doc, buf);
    TEST_ASSERT_FALSE(doc["sos_flag"].as<bool>());
}

// ─────────────────────────────────────────────
// Runner
// ─────────────────────────────────────────────
int main(void) {
    UNITY_BEGIN();

    RUN_TEST(test_health_json_has_required_fields);
    RUN_TEST(test_health_json_device_id_absent);
    RUN_TEST(test_health_json_values_correct);
    RUN_TEST(test_health_json_location_uses_node_gps);

    RUN_TEST(test_health_alert_type_high_hr_string);
    RUN_TEST(test_health_alert_type_low_spo2_string);
    RUN_TEST(test_health_alert_type_fall_string);
    RUN_TEST(test_health_alert_type_high_temp_string);

    RUN_TEST(test_health_zero_hr_becomes_null);
    RUN_TEST(test_health_zero_temp_becomes_null);
    RUN_TEST(test_health_recorded_at_omitted_when_null);
    RUN_TEST(test_health_recorded_at_present_when_provided);

    RUN_TEST(test_location_json_has_required_fields);
    RUN_TEST(test_location_device_id_absent);
    RUN_TEST(test_location_sos_flag_false);
    RUN_TEST(test_location_sos_flag_true);
    RUN_TEST(test_location_zone_id_is_null);
    RUN_TEST(test_location_rssi_value);

    RUN_TEST(test_heartbeat_json_has_required_fields);
    RUN_TEST(test_heartbeat_voltage_converted_to_volts);
    RUN_TEST(test_heartbeat_battery_percentage_value);
    RUN_TEST(test_heartbeat_firmware_version_present);

    RUN_TEST(test_rfid_location_device_id_absent);
    RUN_TEST(test_rfid_location_sos_flag_false);

    return UNITY_END();
}