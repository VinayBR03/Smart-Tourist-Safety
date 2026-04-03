#pragma once

#include <stdint.h>
#include <stdbool.h>

struct EnvData {
    float    temperature_c;
    float    humidity_pct;
    float    pressure_pa;
    bool     valid;
};

class BME280Sensor {
public:
    // Initialise over I2C. Returns false if sensor not found.
    bool begin();

    // Read temperature, humidity, and pressure.
    EnvData read();

    bool isReady() const { return _ready; }

private:
    bool _ready = false;
};