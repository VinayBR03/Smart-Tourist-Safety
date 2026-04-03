#include "mq135.h"

#include <Arduino.h>
#include "../config_node.h"
#include "utils.h"

// ─────────────────────────────────────────────
// begin()
// ─────────────────────────────────────────────
void MQ135Sensor::begin() {
    pinMode(PIN_MQ135_AOUT, INPUT);
    analogSetPinAttenuation(PIN_MQ135_AOUT, ADC_11db); // 0–3.9V input range
    _bootMs   = millis();
    _begunOk  = true;
    DEBUG_LOG("[MQ135] ADC ready — warming up");
}

// ─────────────────────────────────────────────
// read()
// ─────────────────────────────────────────────
AirQualityData MQ135Sensor::read() {
    AirQualityData result = { 0, false, false, false };

    if (!_begunOk) return result;

    // Enforce warm-up period — readings during warm-up are unreliable
    bool warmedUp = (millis() - _bootMs) >= MQ135_WARMUP_MS;
    result.warmed_up = warmedUp;

    if (!warmedUp) {
        DEBUG_LOG("[MQ135] Still warming up — skipping read");
        return result;
    }

    // Average multiple samples to reduce noise
    uint32_t sum = 0;
    for (uint8_t i = 0; i < MQ135_SAMPLES; i++) {
        sum += static_cast<uint32_t>(analogRead(PIN_MQ135_AOUT));
        delay(5);
    }
    uint16_t avg = static_cast<uint16_t>(sum / MQ135_SAMPLES);

    result.raw_adc      = avg;
    result.is_dangerous = (avg >= MQ135_DANGER_THRESHOLD);
    result.valid        = true;

    DEBUG_LOGF("[MQ135] ADC=%u  dangerous=%d\n", avg, result.is_dangerous);
    return result;
}