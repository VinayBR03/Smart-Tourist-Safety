#include "gy91.h"

#include <Wire.h>
#include <Arduino.h>
#include <MPU6050.h>           // electroniccats/MPU6050 — register-compatible with MPU9250
#include <Adafruit_BMP280.h>

#include "../config_wristband.h"
#include "utils.h"

static MPU6050         mpu;
static Adafruit_BMP280 bmp(&Wire);

// Standard sea-level pressure in hPa — adjust for the deployment region's elevation
static constexpr float SEA_LEVEL_PRESSURE_HPA = 1013.25f;

// BMP280 sanity-check limits
static constexpr float PRESSURE_MIN_PA  = 30000.0f;
static constexpr float PRESSURE_MAX_PA  = 110000.0f;
static constexpr float TEMP_MIN_C       = -40.0f;
static constexpr float TEMP_MAX_C       = 85.0f;

// ─────────────────────────────────────────────
// begin()
// ─────────────────────────────────────────────
bool GY91Sensor::begin() {
    // ── MPU9250 (compatible with MPU6050 library for accel/gyro)
    mpu.initialize();

    if (!mpu.testConnection()) {
        DEBUG_LOG("[GY91] MPU9250 not found on I2C");
        _mpuReady = false;
    } else {
        // ±2g full-scale range → LSB sensitivity = 16384 counts/g
        mpu.setFullScaleAccelRange(MPU6050_ACCEL_FS_2);
        // DLPF at 20 Hz — smooths noise while still capturing fall transients
        mpu.setDLPFMode(MPU6050_DLPF_BW_20);
        _mpuReady = true;
        DEBUG_LOG("[GY91] MPU9250 OK");
    }

    // ── BMP280
    if (!bmp.begin(I2C_ADDR_BMP280)) {
        DEBUG_LOG("[GY91] BMP280 not found on I2C");
        _bmpReady = false;
    } else {
        // Normal mode, ×2 temp oversampling, ×16 pressure oversampling,
        // ×16 IIR filter, 500 ms standby — good balance of accuracy and power
        bmp.setSampling(
            Adafruit_BMP280::MODE_NORMAL,
            Adafruit_BMP280::SAMPLING_X2,
            Adafruit_BMP280::SAMPLING_X16,
            Adafruit_BMP280::FILTER_X16,
            Adafruit_BMP280::STANDBY_MS_500
        );
        _bmpReady = true;
        DEBUG_LOG("[GY91] BMP280 OK");
    }

    return _mpuReady && _bmpReady;
}

// ─────────────────────────────────────────────
// readMotion()
// ─────────────────────────────────────────────
MotionData GY91Sensor::readMotion() {
    MotionData result = { 0.0f, 0.0f, 0.0f, 0.0f, false };

    if (!_mpuReady) {
        return result;
    }

    int16_t rawAx, rawAy, rawAz;
    mpu.getAcceleration(&rawAx, &rawAy, &rawAz);

    result.accel_x   = static_cast<float>(rawAx) / MPU9250_ACCEL_LSB_PER_G;
    result.accel_y   = static_cast<float>(rawAy) / MPU9250_ACCEL_LSB_PER_G;
    result.accel_z   = static_cast<float>(rawAz) / MPU9250_ACCEL_LSB_PER_G;
    result.accel_mag = sqrtf(
        result.accel_x * result.accel_x +
        result.accel_y * result.accel_y +
        result.accel_z * result.accel_z
    );
    result.valid = true;

    return result;
}

// ─────────────────────────────────────────────
// readAltitude()
// ─────────────────────────────────────────────
AltitudeData GY91Sensor::readAltitude() {
    AltitudeData result = { 0.0f, 0.0f, 0.0f, false };

    if (!_bmpReady) {
        return result;
    }

    float temp = bmp.readTemperature();
    float pres = bmp.readPressure();

    if (isnan(temp) || isnan(pres)) {
        DEBUG_LOG("[GY91] BMP280 returned NaN");
        return result;
    }

    if (pres < PRESSURE_MIN_PA || pres > PRESSURE_MAX_PA) {
        DEBUG_LOGF("[GY91] BMP280 pressure %.0fPa out of range\n", pres);
        return result;
    }

    if (temp < TEMP_MIN_C || temp > TEMP_MAX_C) {
        DEBUG_LOGF("[GY91] BMP280 temperature %.1f°C out of range\n", temp);
        return result;
    }

    result.temperature_c = temp;
    result.pressure_pa   = pres;
    result.altitude_m    = bmp.readAltitude(SEA_LEVEL_PRESSURE_HPA);
    result.valid         = true;

    DEBUG_LOGF("[GY91] Temp=%.1f°C  Pres=%.0fPa  Alt=%.1fm\n",
               result.temperature_c, result.pressure_pa, result.altitude_m);

    return result;
}