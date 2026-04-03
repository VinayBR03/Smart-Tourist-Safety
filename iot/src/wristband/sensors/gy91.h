#pragma once

#include <stdint.h>
#include <stdbool.h>

// Raw motion data from MPU9250 accelerometer
struct MotionData {
    float accel_x;    // g
    float accel_y;    // g
    float accel_z;    // g
    float accel_mag;  // vector magnitude in g — used by fall detector
    bool  valid;
};

// Environmental data from BMP280
struct AltitudeData {
    float temperature_c;  // ambient temperature (NOT body temp — use MLX for that)
    float pressure_pa;    // pascals
    float altitude_m;     // metres above sea level
    bool  valid;
};

class GY91Sensor {
public:
    // Initialise MPU9250 and BMP280 over the shared I2C bus.
    // Returns true only if BOTH sensors respond correctly.
    bool begin();

    // Read accelerometer — call continuously for fall detection
    MotionData readMotion();

    // Read BMP280 — call every 30 seconds alongside health packet
    AltitudeData readAltitude();

    bool isMPUReady() const { return _mpuReady; }
    bool isBMPReady() const { return _bmpReady; }

private:
    bool _mpuReady = false;
    bool _bmpReady = false;
};