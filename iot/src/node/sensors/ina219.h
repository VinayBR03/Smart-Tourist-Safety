#pragma once

#include <stdint.h>
#include <stdbool.h>

struct PowerData {
    float    voltage_mv;     // bus voltage in millivolts
    float    current_ma;     // load current in milliamps
    float    power_mw;       // derived power (V × I)
    uint8_t  battery_pct;    // mapped from voltage using linear approximation
    bool     valid;
};

class INA219Monitor {
public:
    // Initialise INA219 over I2C. Returns false if not found.
    bool begin();

    // Read voltage, current, and power. Maps voltage to battery percentage.
    PowerData read();

    bool isReady() const { return _ready; }

private:
    bool    _ready = false;
    uint8_t voltageToPercent(float voltage_mv) const;
};