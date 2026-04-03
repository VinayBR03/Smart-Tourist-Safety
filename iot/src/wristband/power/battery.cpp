#include "battery.h"

#include <Arduino.h>
#include "../config_wristband.h"
#include "config.h"
#include "utils.h"

// ─────────────────────────────────────────────
// LiPo discharge curve — piecewise linear approximation
// Maps battery voltage (mV) to percentage.
// Better than a single linear function across the full range.
//
// Based on typical 3.7V LiPo characteristic:
//   4200 mV → 100%
//   3900 mV →  75%
//   3700 mV →  50%
//   3500 mV →  25%
//   3300 mV →  10%
//   3000 mV →   0%
// ─────────────────────────────────────────────
struct VoltagePoint {
    float voltage_mv;
    uint8_t percent;
};

static constexpr VoltagePoint DISCHARGE_CURVE[] = {
    { 4200.0f, 100 },
    { 3900.0f,  75 },
    { 3700.0f,  50 },
    { 3500.0f,  25 },
    { 3300.0f,  10 },
    { 3000.0f,   0 },
};
static constexpr uint8_t CURVE_POINTS =
    sizeof(DISCHARGE_CURVE) / sizeof(DISCHARGE_CURVE[0]);

// ─────────────────────────────────────────────
// begin()
// ─────────────────────────────────────────────
void BatteryMonitor::begin() {
    // 11 dB attenuation: measures up to ~2.6V at ADC input.
    // With BATTERY_DIVIDER_RATIO=2.0 this covers up to 5.2V battery → sufficient for 4.2V LiPo.
    analogSetPinAttenuation(PIN_BATTERY_ADC, ADC_11db);
    pinMode(PIN_BATTERY_ADC, INPUT);
    DEBUG_LOG("[BAT] ADC initialised");
}

// ─────────────────────────────────────────────
// read()
// ─────────────────────────────────────────────
BatteryData BatteryMonitor::read() {
    // Average multiple readings to suppress ADC noise
    uint32_t sum = 0;
    for (uint32_t i = 0; i < BATTERY_ADC_SAMPLES; i++) {
        sum += analogReadMilliVolts(PIN_BATTERY_ADC);
        delay(2);  // brief gap between reads reduces coupling noise
    }
    float adcMv     = static_cast<float>(sum) / static_cast<float>(BATTERY_ADC_SAMPLES);
    float batteryMv = adcMv * BATTERY_DIVIDER_RATIO;

    BatteryData result;
    result.voltage_mv = batteryMv;
    result.percentage = voltageToPercent(batteryMv);
    result.is_low     = (result.percentage < BATTERY_LOW_THRESHOLD_PCT);

    DEBUG_LOGF("[BAT] ADC=%.0fmV  Vbat=%.0fmV  Pct=%d%%  Low=%d\n",
               adcMv, batteryMv, result.percentage, result.is_low);

    return result;
}

// ─────────────────────────────────────────────
// voltageToPercent()
// Piecewise linear interpolation between curve points
// ─────────────────────────────────────────────
uint8_t BatteryMonitor::voltageToPercent(float voltage_mv) const {
    // Clamp to extremes
    if (voltage_mv >= DISCHARGE_CURVE[0].voltage_mv)             return 100;
    if (voltage_mv <= DISCHARGE_CURVE[CURVE_POINTS - 1].voltage_mv) return 0;

    // Find the two adjacent curve points that bracket this voltage
    for (uint8_t i = 0; i < CURVE_POINTS - 1; i++) {
        const VoltagePoint& upper = DISCHARGE_CURVE[i];
        const VoltagePoint& lower = DISCHARGE_CURVE[i + 1];

        if (voltage_mv >= lower.voltage_mv && voltage_mv <= upper.voltage_mv) {
            // Linear interpolation between lower and upper
            float ratio = (voltage_mv - lower.voltage_mv)
                        / (upper.voltage_mv - lower.voltage_mv);
            float pct   = static_cast<float>(lower.percent)
                        + ratio * static_cast<float>(upper.percent - lower.percent);
            return static_cast<uint8_t>(pct);
        }
    }

    return 0;  // unreachable, satisfies compiler
}