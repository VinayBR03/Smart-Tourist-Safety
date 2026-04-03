#pragma once

#include <stdint.h>
#include <stdbool.h>

struct AirQualityData {
    uint16_t raw_adc;        // averaged raw ADC reading (0–4095 on ESP32)
    bool     is_dangerous;   // true when raw_adc exceeds MQ135_DANGER_THRESHOLD
    bool     warmed_up;      // false until MQ135_WARMUP_MS has elapsed since begin()
    bool     valid;
};

class MQ135Sensor {
public:
    // Configure ADC pin and record boot time for warm-up tracking.
    void begin();

    // Take an averaged ADC reading.
    // Returns valid=false and warmed_up=false during the warm-up period.
    AirQualityData read();

private:
    uint32_t _bootMs   = 0;
    bool     _begunOk  = false;
};