#pragma once

#include <stdint.h>
#include <stdbool.h>

struct HeartData {
    float   heart_rate;   // bpm — 0.0 if no valid reading
    float   spo2;         // %   — 0.0 if no valid reading
    bool    hr_valid;
    bool    spo2_valid;
};

class MAX30102Sensor {
public:
    // Initialize sensor over I2C. Returns false if not found on bus.
    bool begin();

    // Blocking read (~4 seconds): collects samples, computes HR + SpO2.
    // Designed to be called once per 30-second transmission cycle.
    HeartData read();

    bool isReady() const { return _ready; }

private:
    bool _ready = false;
};