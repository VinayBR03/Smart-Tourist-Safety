#include "mlx90614.h"

#include <Wire.h>
#include <Arduino.h>
#include <Adafruit_MLX90614.h>

#include "../config_wristband.h"
#include "utils.h"

static Adafruit_MLX90614 mlx;

// ─────────────────────────────────────────────
// begin()
// ─────────────────────────────────────────────
bool MLX90614Sensor::begin() {
    // Adafruit MLX90614 begin() uses default I2C address 0x5A internally
    if (!mlx.begin()) {
        DEBUG_LOG("[MLX90614] Not found on I2C bus");
        _ready = false;
        return false;
    }
    _ready = true;
    DEBUG_LOG("[MLX90614] Init OK");
    return true;
}

// ─────────────────────────────────────────────
// read()
// ─────────────────────────────────────────────
TemperatureData MLX90614Sensor::read() {
    TemperatureData result = { 0.0f, 0.0f, false };

    if (!_ready) {
        return result;
    }

    float objTemp = mlx.readObjectTempC();
    float ambTemp = mlx.readAmbientTempC();

    if (isnan(objTemp) || isnan(ambTemp)) {
        DEBUG_LOG("[MLX90614] NaN reading — I2C error");
        return result;
    }

    // Reject readings outside the physiological window defined in config
    if (objTemp < MLX_BODY_TEMP_MIN_C || objTemp > MLX_BODY_TEMP_MAX_C) {
        DEBUG_LOGF("[MLX90614] Object temp %.1f°C outside valid range\n", objTemp);
        return result;
    }

    result.body_temp_c    = objTemp;
    result.ambient_temp_c = ambTemp;
    result.valid          = true;

    DEBUG_LOGF("[MLX90614] Body=%.1f°C  Ambient=%.1f°C\n", objTemp, ambTemp);
    return result;
}