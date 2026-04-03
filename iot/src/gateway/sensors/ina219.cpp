#include "ina219.h"

#include <Wire.h>
#include <Arduino.h>
#include <Adafruit_INA219.h>

#include "../config_gateway.h"
#include "utils.h"

static Adafruit_INA219 ina219(I2C_ADDR_INA219);

// Sanity-check limits
static constexpr float VOLTAGE_MIN_MV =  0.0f;
static constexpr float VOLTAGE_MAX_MV = 5000.0f;
static constexpr float CURRENT_MIN_MA = -5000.0f;   // negative = charging
static constexpr float CURRENT_MAX_MA =  5000.0f;

// ─────────────────────────────────────────────
// begin()
// ─────────────────────────────────────────────
bool INA219Monitor::begin() {
    if (!ina219.begin(&Wire)) {
        DEBUG_LOG("[INA219] Not found on I2C bus");
        _ready = false;
        return false;
    }

    // Default calibration covers 32V / 2A.
    // For Li-ion node battery (≤4.2V, ≤1A typical) this is more than sufficient.
    _ready = true;
    DEBUG_LOG("[INA219] Init OK");
    return true;
}

// ─────────────────────────────────────────────
// read()
// ─────────────────────────────────────────────
PowerData INA219Monitor::read() {
    PowerData result = { 0.0f, 0.0f, 0.0f, 0, false };

    if (!_ready) return result;

    float voltage_v = ina219.getBusVoltage_V();
    float current_a = ina219.getCurrent_mA();  // library returns mA directly
    float power_mw  = ina219.getPower_mW();

    float voltage_mv = voltage_v * 1000.0f;

    // Reject clearly impossible readings (open circuit or sensor glitch)
    if (voltage_mv < VOLTAGE_MIN_MV || voltage_mv > VOLTAGE_MAX_MV) {
        DEBUG_LOGF("[INA219] Voltage %.0fmV out of range\n", voltage_mv);
        return result;
    }
    if (current_a < CURRENT_MIN_MA || current_a > CURRENT_MAX_MA) {
        DEBUG_LOGF("[INA219] Current %.1fmA out of range\n", current_a);
        return result;
    }

    result.voltage_mv  = voltage_mv;
    result.current_ma  = current_a;
    result.power_mw    = power_mw;
    result.battery_pct = voltageToPercent(voltage_mv);
    result.valid       = true;

    DEBUG_LOGF("[INA219] V=%.0fmV  I=%.1fmA  P=%.1fmW  Pct=%d%%\n",
               voltage_mv, current_a, power_mw, result.battery_pct);

    return result;
}

// ─────────────────────────────────────────────
// voltageToPercent()
// Simple linear map between empty and full voltage
// ─────────────────────────────────────────────
uint8_t INA219Monitor::voltageToPercent(float voltage_mv) const {
    if (voltage_mv >= BATTERY_VOLTAGE_FULL_MV)  return 100;
    if (voltage_mv <= BATTERY_VOLTAGE_EMPTY_MV) return 0;

    float range = BATTERY_VOLTAGE_FULL_MV - BATTERY_VOLTAGE_EMPTY_MV;
    float pct   = (voltage_mv - BATTERY_VOLTAGE_EMPTY_MV) / range * 100.0f;
    return static_cast<uint8_t>(pct);
}