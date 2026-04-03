#pragma once

#include <stdint.h>
#include <stdbool.h>

struct BatteryData {
    float   voltage_mv;   // actual battery voltage in millivolts
    uint8_t percentage;   // 0–100
    bool    is_low;       // true when percentage < BATTERY_LOW_THRESHOLD_PCT
};

class BatteryMonitor {
public:
    // Configure ADC attenuation — call once in setup()
    void begin();

    // Take an averaged ADC reading and map it to voltage + percentage
    BatteryData read();

private:
    // Map a millivolt reading to 0–100 percentage using LiPo discharge curve
    uint8_t voltageToPercent(float voltage_mv) const;
};