#include <unity.h>
#include <string.h>
#include <stdint.h>

// Switch between native mocks and real Arduino headers
#ifdef NATIVE_BUILD
    #include "../native_stubs.h"
#else
    #include <Arduino.h>
    void setUp(void) {}
    void tearDown(void) {}
#endif

#include "packet_types.h"
#include "utils.h"

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

static HealthPacket makeHealthPacket() {
    HealthPacket pkt;
    memset(&pkt, 0, sizeof(pkt));
    pkt.packet_type = PKT_HEALTH_DATA;
    // Using DEVICE_ID_LEN-1 to ensure space for null terminator
    strncpy(pkt.device_id, "WB001", DEVICE_ID_LEN - 1);
    pkt.heart_rate   = encode_heart_rate(78.5f);
    pkt.spo2         = 98;
    pkt.body_temp    = encode_body_temp(37.1f);
    pkt.is_alert     = 0;
    pkt.alert_type   = ALERT_NONE;
    pkt.latitude     = encode_gps(25.43580f);
    pkt.longitude    = encode_gps(81.84630f);
    pkt.battery_pct  = 87;
    pkt.timestamp    = 1743000000UL;
    return pkt;
}

static SOSPacket makeSOSPacket() {
    SOSPacket pkt;
    memset(&pkt, 0, sizeof(pkt));
    pkt.packet_type = PKT_SOS_ALERT;
    strncpy(pkt.device_id, "WB002", DEVICE_ID_LEN - 1);
    pkt.latitude     = encode_gps(25.43580f);
    pkt.longitude    = encode_gps(81.84630f);
    pkt.timestamp    = 1743000000UL;
    pkt.battery_pct  = 45;
    return pkt;
}

static RFIDPacket makeRFIDPacket() {
    RFIDPacket pkt;
    memset(&pkt, 0, sizeof(pkt));
    pkt.packet_type = PKT_RFID_CHECKPOINT;
    strncpy(pkt.device_id, "WB003", DEVICE_ID_LEN - 1);
    memcpy(pkt.rfid_uid, "\xAB\xCD\xEF\x01\x02\x03\x04\x05", RFID_UID_LEN);
    pkt.timestamp    = 1743000001UL;
    return pkt;
}

static NodeStatusPacket makeNodeStatusPacket() {
    NodeStatusPacket pkt;
    memset(&pkt, 0, sizeof(pkt));
    pkt.packet_type = PKT_NODE_STATUS;
    // Warning fix: clear buffer then copy
    memset(pkt.node_id, 0, NODE_ID_LEN);
    strncpy(pkt.node_id, "N001", NODE_ID_LEN - 1);
    pkt.node_lat     = encode_gps(25.43580f);
    pkt.node_lon     = encode_gps(81.84630f);
    pkt.temperature  = 2510; 
    pkt.humidity     = 65;
    pkt.pressure     = 101325;
    pkt.air_quality  = 320;
    pkt.battery_pct  = 72;
    pkt.timestamp    = 1743000002UL;
    return pkt;
}

// ─────────────────────────────────────────────
// Test Cases
// ─────────────────────────────────────────────

void test_health_stamp_validate(void) {
    HealthPacket pkt = makeHealthPacket();
    stamp_checksum(pkt);
    TEST_ASSERT_TRUE(validate_checksum(pkt));
}

void test_sos_stamp_validate(void) {
    SOSPacket pkt = makeSOSPacket();
    stamp_checksum(pkt);
    TEST_ASSERT_TRUE(validate_checksum(pkt));
}

void test_rfid_stamp_validate(void) {
    RFIDPacket pkt = makeRFIDPacket();
    stamp_checksum(pkt);
    TEST_ASSERT_TRUE(validate_checksum(pkt));
}

void test_node_status_stamp_validate(void) {
    NodeStatusPacket pkt = makeNodeStatusPacket();
    stamp_checksum(pkt);
    TEST_ASSERT_TRUE(validate_checksum(pkt));
}

void test_health_single_byte_corruption_detected(void) {
    HealthPacket pkt = makeHealthPacket();
    stamp_checksum(pkt);
    size_t bodyLen = sizeof(HealthPacket) - 1;
    uint8_t* raw = reinterpret_cast<uint8_t*>(&pkt);

    for (size_t i = 0; i < bodyLen; i++) {
        raw[i] ^= 0xFF;
        TEST_ASSERT_FALSE_MESSAGE(validate_checksum(pkt), "Corruption not detected");
        raw[i] ^= 0xFF;
    }
}

void test_sos_single_byte_corruption_detected(void) {
    SOSPacket pkt = makeSOSPacket();
    stamp_checksum(pkt);
    size_t bodyLen = sizeof(SOSPacket) - 1;
    uint8_t* raw = reinterpret_cast<uint8_t*>(&pkt);

    for (size_t i = 0; i < bodyLen; i++) {
        raw[i] ^= 0xFF;
        TEST_ASSERT_FALSE_MESSAGE(validate_checksum(pkt), "Corruption not detected");
        raw[i] ^= 0xFF;
    }
}

void test_all_zero_checksum_is_zero(void) {
    uint8_t buf[16] = { 0 };
    TEST_ASSERT_EQUAL_UINT8(0, compute_checksum(buf, sizeof(buf)));
}

void test_gps_encode_decode_roundtrip(void) {
    float latIn = 25.43580f;
    int32_t encLat = encode_gps(latIn);
    float latOut = decode_gps(encLat);
    TEST_ASSERT_FLOAT_WITHIN(1e-4f, latIn, latOut);
}

void test_health_packet_size(void) {
    TEST_ASSERT_EQUAL_INT(34, (int)sizeof(HealthPacket));
}

// ─────────────────────────────────────────────
// Shared Test Runner
// ─────────────────────────────────────────────

void run_all_tests() {
    RUN_TEST(test_health_stamp_validate);
    RUN_TEST(test_sos_stamp_validate);
    RUN_TEST(test_rfid_stamp_validate);
    RUN_TEST(test_node_status_stamp_validate);
    RUN_TEST(test_health_single_byte_corruption_detected);
    RUN_TEST(test_sos_single_byte_corruption_detected);
    RUN_TEST(test_all_zero_checksum_is_zero);
    RUN_TEST(test_gps_encode_decode_roundtrip);
    RUN_TEST(test_health_packet_size);
}

// ─────────────────────────────────────────────
// Platform Entry Points
// ─────────────────────────────────────────────

#ifdef NATIVE_BUILD
int main(void) {
    UNITY_BEGIN();
    run_all_tests();
    return UNITY_END();
}
#else
void setup() {
    // Wait for hardware serial to initialize
    delay(2000);
    UNITY_BEGIN();
    run_all_tests();
    UNITY_END();
}

void loop() {
    // Empty for tests
}
#endif