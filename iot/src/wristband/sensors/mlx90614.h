#pragma once

#include <stdint.h>
#include <stdbool.h>

struct TemperatureData {
    float body_temp_c;     // object (body-facing) temperature in °C
    float ambient_temp_c;  // ambient temperature for reference
    bool  valid;
};

class MLX90614Sensor {
public:
    // Initialise sensor over I2C. Returns false if not found.
    bool begin();

    // Read one temperature measurement. Returns valid=false on sensor error
    // or reading outside physiological range.
    TemperatureData read();

    bool isReady() const { return _ready; }

private:
    bool _ready = false;
};