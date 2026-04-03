#include "max30102.h"

#include <Wire.h>
#include <Arduino.h>
#include <MAX30105.h>       // SparkFun MAX3010x
#include <heartRate.h>      // checkForBeat()
#include <spo2_algorithm.h> // maxim_heart_rate_and_oxygen_saturation()

#include "../config_wristband.h"
#include "config.h"
#include "utils.h"

// Static sensor instance — one per wristband, lives for the device lifetime
static MAX30105 particleSensor;

// SpO2 algorithm requires exactly 100 samples of Red + IR
static uint32_t irBuffer[MAX30102_SPO2_BUFFER_LEN];
static uint32_t redBuffer[MAX30102_SPO2_BUFFER_LEN];

// ─────────────────────────────────────────────
// begin()
// ─────────────────────────────────────────────
bool MAX30102Sensor::begin() {
    if (!particleSensor.begin(Wire, I2C_SPEED_FAST, I2C_ADDR_MAX30102)) {
        DEBUG_LOG("[MAX30102] Not found on I2C bus");
        _ready = false;
        return false;
    }

    // powerLevel=60 (~12mA), sampleAverage=4, ledMode=2 (Red+IR only),
    // sampleRate=3200, pulseWidth=411µs, adcRange=4096
    particleSensor.setup(60, 4, 2, 3200, 411, 4096);
    particleSensor.setPulseAmplitudeRed(0x0A);  // dim Red — sufficient for SpO2
    particleSensor.setPulseAmplitudeGreen(0);   // Green off — not needed

    _ready = true;
    DEBUG_LOG("[MAX30102] Init OK");
    return true;
}

// ─────────────────────────────────────────────
// read()
// ─────────────────────────────────────────────
HeartData MAX30102Sensor::read() {
    HeartData result = { 0.0f, 0.0f, false, false };

    if (!_ready) {
        DEBUG_LOG("[MAX30102] Skipped — sensor not ready");
        return result;
    }

    // ── Phase 1: Fill SpO2 buffers (100 samples @ effective 800 SPS ≈ 125 ms)
    for (int32_t i = 0; i < MAX30102_SPO2_BUFFER_LEN; i++) {
        // Wait until FIFO has at least one sample
        while (!particleSensor.available()) {
            particleSensor.check();
        }
        redBuffer[i] = particleSensor.getFIFORed();
        irBuffer[i]  = particleSensor.getFIFOIR();
        particleSensor.nextSample();
    }

    // ── Phase 2: Run SpO2 algorithm on filled buffers
    int32_t spo2Raw   = 0;
    int8_t  validSpo2 = 0;
    int32_t hrRaw     = 0;
    int8_t  validHr   = 0;

    maxim_heart_rate_and_oxygen_saturation(
        irBuffer, MAX30102_SPO2_BUFFER_LEN,
        redBuffer,
        &spo2Raw, &validSpo2,
        &hrRaw,   &validHr
    );

    // ── Phase 3: Collect beats via IR peak detection for ~4 seconds
    uint8_t  rates[MAX30102_RATE_BUFFER_SIZE] = { 0 };
    uint8_t  rateSpot  = 0;
    long     lastBeat  = 0;
    uint8_t  beatCount = 0;
    uint32_t deadline  = millis() + MAX30102_SAMPLE_WINDOW_MS;

    while (millis() < deadline) {
        while (!particleSensor.available()) {
            particleSensor.check();
        }
        long irValue = static_cast<long>(particleSensor.getFIFOIR());
        particleSensor.nextSample();

        if (checkForBeat(irValue)) {
            long delta = millis() - lastBeat;
            lastBeat   = millis();

            if (delta > 0) {
                float bpm = 60000.0f / static_cast<float>(delta);  // delta in ms
                if (bpm > 20.0f && bpm < 250.0f) {
                    rates[rateSpot % MAX30102_RATE_BUFFER_SIZE] = static_cast<uint8_t>(bpm);
                    rateSpot++;
                    beatCount++;
                }
            }
        }
    }

    // Average beat-detected HR values
    if (beatCount > 0) {
        uint8_t filled = min(beatCount, MAX30102_RATE_BUFFER_SIZE);
        float   sum    = 0.0f;
        for (uint8_t i = 0; i < filled; i++) sum += static_cast<float>(rates[i]);
        float avgHr = sum / static_cast<float>(filled);

        if (avgHr > 20.0f && avgHr < 250.0f) {
            result.heart_rate = avgHr;
            result.hr_valid   = true;
        }
    }

    // Fall back to algorithm HR if beat detection didn't get enough data
    if (!result.hr_valid && validHr && hrRaw > 20 && hrRaw < 250) {
        result.heart_rate = static_cast<float>(hrRaw);
        result.hr_valid   = true;
    }

    // Accept SpO2 from algorithm if within valid physiological range
    if (validSpo2 && spo2Raw >= 50 && spo2Raw <= 100) {
        result.spo2       = static_cast<float>(spo2Raw);
        result.spo2_valid = true;
    }

    DEBUG_LOGF("[MAX30102] HR=%.1fbpm valid=%d  SpO2=%.1f%% valid=%d\n",
               result.heart_rate, result.hr_valid,
               result.spo2,       result.spo2_valid);

    return result;
}