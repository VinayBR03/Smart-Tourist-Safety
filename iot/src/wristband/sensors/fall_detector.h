#pragma once

#include <stdint.h>
#include <stdbool.h>

// Internal state machine states
enum class FallState : uint8_t {
    IDLE,       // normal — monitoring accel magnitude
    FREE_FALL,  // accel dropped below free-fall threshold
    LOCKOUT     // confirmed fall — cooling down before re-arming
};

class FallDetector {
public:
    FallDetector() = default;

    // Feed a fresh accel magnitude reading (g).
    // Returns true on the exact cycle a fall is newly confirmed — caller
    // should immediately assemble an alert packet and call reset() after reporting.
    bool update(float accel_mag_g);

    // True from the moment a fall is confirmed until reset() is called.
    bool isFallDetected() const { return _fallDetected; }

    // Clear the reported flag (does NOT skip the lockout period).
    void reset();

    FallState currentState() const { return _state; }

private:
    FallState _state          = FallState::IDLE;
    uint32_t  _stateEnteredAt = 0;
    bool      _fallDetected   = false;
};