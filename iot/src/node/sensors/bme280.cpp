#include "bme280.h"

#include <Wire.h>
#include <Arduino.h>
#include <Adafruit_BME280.h>

#include "../config_node.h"
#include "utils.h"

static Adafruit_BME280 bme;

static constexpr float PRESSURE_MIN_PA = 30000.0f;
static constexpr float PRESSURE_MAX_PA = 110000.0f;
static constexpr float HUMIDITY_MIN    = 0.0f;
static constexpr float HUMIDITY_MAX    = 100.0f;
static constexpr float TEMP_MIN_C      = -40.0f;
static constexpr float TEMP_MAX_C      = 85.0f;

// ─────────────────────────────────────────────
// begin()
// ─────────────────────────────────────────────
bool BME280Sensor::begin() {
    if (!bme.begin(I2C_ADDR_BME280, &Wire)) {
        DEBUG_LOG("[BME280] Not found on I2C bus");
        _ready = false;
        return false;
    }

    // Weather-station mode: low power, slow update rate
    bme.setSampling(
        Adafruit_BME280::MODE_FORCED,        // take one sample then sleep
        Adafruit_BME280::SAMPLING_X1,        // temperature
        Adafruit_BME280::SAMPLING_X1,        // pressure
        Adafruit_BME280::SAMPLING_X1,        // humidity
        Adafruit_BME280::FILTER_OFF,
        Adafruit_BME280::STANDBY_MS_1000
    );

    _ready = true;
    DEBUG_LOG("[BME280] Init OK");
    return true;
}

// ─────────────────────────────────────────────
// read()
// ─────────────────────────────────────────────
EnvData BME280Sensor::read() {
    EnvData result = { 0.0f, 0.0f, 0.0f, false };

    if (!_ready) return result;

    // In FORCED mode we must trigger a measurement before reading
    bme.takeForcedMeasurement();

    float temp = bme.readTemperature();
    float hum  = bme.readHumidity();
    float pres = bme.readPressure();

    if (isnan(temp) || isnan(hum) || isnan(pres)) {
        DEBUG_LOG("[BME280] NaN reading");
        return result;
    }

    if (temp < TEMP_MIN_C      || temp > TEMP_MAX_C)      { DEBUG_LOG("[BME280] Temp OOR");     return result; }
    if (hum  < HUMIDITY_MIN    || hum  > HUMIDITY_MAX)    { DEBUG_LOG("[BME280] Humidity OOR"); return result; }
    if (pres < PRESSURE_MIN_PA || pres > PRESSURE_MAX_PA) { DEBUG_LOG("[BME280] Pressure OOR"); return result; }

    result.temperature_c = temp;
    result.humidity_pct  = hum;
    result.pressure_pa   = pres;
    result.valid         = true;

    DEBUG_LOGF("[BME280] T=%.1f°C  H=%.1f%%  P=%.0fPa\n", temp, hum, pres);
    return result;
}