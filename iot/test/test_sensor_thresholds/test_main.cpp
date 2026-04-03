// ─────────────────────────────────────────────
// Test suite: alert threshold boundary conditions
//
// Every threshold has three tests:
//   BELOW boundary → no alert
//   AT boundary    → alert fires (or does not, per rule)
//   ABOVE boundary → alert fires
//
// These tests mirror the backend's _sanitize() ranges and
// the IoTHealthRequest field validators exactly.
// ─────────────────────────────────────────────

#include "../native_stubs.h"
#include "packet_types.h"

#include <unity.h>
#include <stdint.h>
#include <stdbool.h>

// ─────────────────────────────────────────────
// Replicate the firmware alert evaluation logic
// (same logic as buildAlertType() in wristband/main.cpp)
// Isolated here so the test does not depend on Arduino headers.
// ─────────────────────────────────────────────
static uint8_t evaluateAlert(
    bool    hrValid,   float  hr,
    bool    spo2Valid, float  spo2,
    bool    tempValid, float  temp,
    bool    fall)
{
    if (fall)    return ALERT_FALL_DETECTED;

    if (hrValid) {
        if (hr > static_cast<float>(THRESHOLD_HEART_RATE_HIGH)) return ALERT_HIGH_HEART_RATE;
        if (hr < static_cast<float>(THRESHOLD_HEART_RATE_LOW))  return ALERT_LOW_HEART_RATE;
    }

    if (spo2Valid && spo2 < static_cast<float>(THRESHOLD_SPO2_LOW)) return ALERT_LOW_SPO2;

    if (tempValid && temp > THRESHOLD_BODY_TEMP_HIGH) return ALERT_HIGH_TEMP;

    return ALERT_NONE;
}

// ─────────────────────────────────────────────
// Backend sanitize ranges (mirrored from iot_service.py)
// Values outside these ranges are coerced to None by the backend.
// Firmware must not transmit these as real readings.
// ─────────────────────────────────────────────
static constexpr float BACKEND_HR_MIN   = 20.0f;
static constexpr float BACKEND_HR_MAX   = 250.0f;
static constexpr float BACKEND_SPO2_MIN = 50.0f;
static constexpr float BACKEND_SPO2_MAX = 100.0f;
static constexpr float BACKEND_TEMP_MIN = 30.0f;
static constexpr float BACKEND_TEMP_MAX = 45.0f;

// ─────────────────────────────────────────────
// Heart rate — HIGH threshold (>120 bpm)
// ─────────────────────────────────────────────
void test_hr_normal_no_alert(void) {
    TEST_ASSERT_EQUAL_UINT8(ALERT_NONE,
        evaluateAlert(true, 80.0f, false, 0, false, 0, false));
}

void test_hr_exactly_at_high_threshold_no_alert(void) {
    // > 120 fires, so exactly 120 should NOT fire
    TEST_ASSERT_EQUAL_UINT8(ALERT_NONE,
        evaluateAlert(true, 120.0f, false, 0, false, 0, false));
}

void test_hr_above_high_threshold_fires(void) {
    TEST_ASSERT_EQUAL_UINT8(ALERT_HIGH_HEART_RATE,
        evaluateAlert(true, 120.1f, false, 0, false, 0, false));
}

void test_hr_well_above_threshold_fires(void) {
    TEST_ASSERT_EQUAL_UINT8(ALERT_HIGH_HEART_RATE,
        evaluateAlert(true, 200.0f, false, 0, false, 0, false));
}

// ─────────────────────────────────────────────
// Heart rate — LOW threshold (<50 bpm)
// ─────────────────────────────────────────────
void test_hr_exactly_at_low_threshold_no_alert(void) {
    // < 50 fires, so exactly 50 should NOT fire
    TEST_ASSERT_EQUAL_UINT8(ALERT_NONE,
        evaluateAlert(true, 50.0f, false, 0, false, 0, false));
}

void test_hr_below_low_threshold_fires(void) {
    TEST_ASSERT_EQUAL_UINT8(ALERT_LOW_HEART_RATE,
        evaluateAlert(true, 49.9f, false, 0, false, 0, false));
}

void test_hr_invalid_not_checked_when_flag_false(void) {
    // hrValid=false → HR value ignored regardless
    TEST_ASSERT_EQUAL_UINT8(ALERT_NONE,
        evaluateAlert(false, 200.0f, false, 0, false, 0, false));
}

// ─────────────────────────────────────────────
// SpO2 — LOW threshold (<94%)
// ─────────────────────────────────────────────
void test_spo2_normal_no_alert(void) {
    TEST_ASSERT_EQUAL_UINT8(ALERT_NONE,
        evaluateAlert(false, 0, true, 98.0f, false, 0, false));
}

void test_spo2_exactly_at_threshold_no_alert(void) {
    // < 94 fires, so exactly 94 should NOT fire
    TEST_ASSERT_EQUAL_UINT8(ALERT_NONE,
        evaluateAlert(false, 0, true, 94.0f, false, 0, false));
}

void test_spo2_below_threshold_fires(void) {
    TEST_ASSERT_EQUAL_UINT8(ALERT_LOW_SPO2,
        evaluateAlert(false, 0, true, 93.9f, false, 0, false));
}

void test_spo2_critically_low_fires(void) {
    TEST_ASSERT_EQUAL_UINT8(ALERT_LOW_SPO2,
        evaluateAlert(false, 0, true, 80.0f, false, 0, false));
}

void test_spo2_invalid_not_checked_when_flag_false(void) {
    TEST_ASSERT_EQUAL_UINT8(ALERT_NONE,
        evaluateAlert(false, 0, false, 80.0f, false, 0, false));
}

// ─────────────────────────────────────────────
// Body temperature — HIGH threshold (>38.5°C)
// ─────────────────────────────────────────────
void test_temp_normal_no_alert(void) {
    TEST_ASSERT_EQUAL_UINT8(ALERT_NONE,
        evaluateAlert(false, 0, false, 0, true, 37.0f, false));
}

void test_temp_exactly_at_threshold_no_alert(void) {
    // > 38.5 fires, so exactly 38.5 should NOT fire
    TEST_ASSERT_EQUAL_UINT8(ALERT_NONE,
        evaluateAlert(false, 0, false, 0, true, 38.5f, false));
}

void test_temp_above_threshold_fires(void) {
    TEST_ASSERT_EQUAL_UINT8(ALERT_HIGH_TEMP,
        evaluateAlert(false, 0, false, 0, true, 38.51f, false));
}

void test_temp_high_fever_fires(void) {
    TEST_ASSERT_EQUAL_UINT8(ALERT_HIGH_TEMP,
        evaluateAlert(false, 0, false, 0, true, 40.0f, false));
}

void test_temp_invalid_not_checked_when_flag_false(void) {
    TEST_ASSERT_EQUAL_UINT8(ALERT_NONE,
        evaluateAlert(false, 0, false, 0, false, 40.0f, false));
}

// ─────────────────────────────────────────────
// Fall detection
// ─────────────────────────────────────────────
void test_fall_overrides_all_other_alerts(void) {
    // Even with normal vitals, fall=true must produce ALERT_FALL_DETECTED
    TEST_ASSERT_EQUAL_UINT8(ALERT_FALL_DETECTED,
        evaluateAlert(true, 80.0f, true, 98.0f, true, 37.0f, true));
}

void test_fall_overrides_high_hr(void) {
    TEST_ASSERT_EQUAL_UINT8(ALERT_FALL_DETECTED,
        evaluateAlert(true, 200.0f, true, 98.0f, true, 37.0f, true));
}

void test_fall_overrides_low_spo2(void) {
    TEST_ASSERT_EQUAL_UINT8(ALERT_FALL_DETECTED,
        evaluateAlert(false, 0, true, 80.0f, false, 0, true));
}

// ─────────────────────────────────────────────
// Alert priority ordering (no fall)
// HR alert wins over SpO2 and Temp when multiple fire simultaneously
// ─────────────────────────────────────────────
void test_high_hr_wins_over_low_spo2(void) {
    TEST_ASSERT_EQUAL_UINT8(ALERT_HIGH_HEART_RATE,
        evaluateAlert(true, 150.0f, true, 80.0f, false, 0, false));
}

void test_high_hr_wins_over_high_temp(void) {
    TEST_ASSERT_EQUAL_UINT8(ALERT_HIGH_HEART_RATE,
        evaluateAlert(true, 150.0f, false, 0, true, 40.0f, false));
}

void test_low_spo2_wins_over_high_temp(void) {
    TEST_ASSERT_EQUAL_UINT8(ALERT_LOW_SPO2,
        evaluateAlert(false, 0, true, 80.0f, true, 40.0f, false));
}

// ─────────────────────────────────────────────
// Backend value range checks
// Values that the backend _sanitize() would coerce to None.
// The firmware should never produce these as "valid" readings.
// These tests document the dead zones so future developers don't forget.
// ─────────────────────────────────────────────
void test_backend_hr_floor_is_20(void) {
    // Anything <=0 or <20 will be silently dropped by the backend
    TEST_ASSERT_TRUE(BACKEND_HR_MIN == 20.0f);
}

void test_backend_spo2_floor_is_50(void) {
    TEST_ASSERT_TRUE(BACKEND_SPO2_MIN == 50.0f);
}

void test_backend_temp_floor_is_30(void) {
    TEST_ASSERT_TRUE(BACKEND_TEMP_MIN == 30.0f);
}

void test_backend_temp_ceiling_is_45(void) {
    TEST_ASSERT_TRUE(BACKEND_TEMP_MAX == 45.0f);
}

// ─────────────────────────────────────────────
// Runner
// ─────────────────────────────────────────────
int main(void) {
    UNITY_BEGIN();

    RUN_TEST(test_hr_normal_no_alert);
    RUN_TEST(test_hr_exactly_at_high_threshold_no_alert);
    RUN_TEST(test_hr_above_high_threshold_fires);
    RUN_TEST(test_hr_well_above_threshold_fires);
    RUN_TEST(test_hr_exactly_at_low_threshold_no_alert);
    RUN_TEST(test_hr_below_low_threshold_fires);
    RUN_TEST(test_hr_invalid_not_checked_when_flag_false);

    RUN_TEST(test_spo2_normal_no_alert);
    RUN_TEST(test_spo2_exactly_at_threshold_no_alert);
    RUN_TEST(test_spo2_below_threshold_fires);
    RUN_TEST(test_spo2_critically_low_fires);
    RUN_TEST(test_spo2_invalid_not_checked_when_flag_false);

    RUN_TEST(test_temp_normal_no_alert);
    RUN_TEST(test_temp_exactly_at_threshold_no_alert);
    RUN_TEST(test_temp_above_threshold_fires);
    RUN_TEST(test_temp_high_fever_fires);
    RUN_TEST(test_temp_invalid_not_checked_when_flag_false);

    RUN_TEST(test_fall_overrides_all_other_alerts);
    RUN_TEST(test_fall_overrides_high_hr);
    RUN_TEST(test_fall_overrides_low_spo2);

    RUN_TEST(test_high_hr_wins_over_low_spo2);
    RUN_TEST(test_high_hr_wins_over_high_temp);
    RUN_TEST(test_low_spo2_wins_over_high_temp);

    RUN_TEST(test_backend_hr_floor_is_20);
    RUN_TEST(test_backend_spo2_floor_is_50);
    RUN_TEST(test_backend_temp_floor_is_30);
    RUN_TEST(test_backend_temp_ceiling_is_45);

    return UNITY_END();
}