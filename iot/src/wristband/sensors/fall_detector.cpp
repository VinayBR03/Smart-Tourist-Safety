#include "fall_detector.h"

#include <Arduino.h>
#include "../config_wristband.h"
#include "utils.h"

// ─────────────────────────────────────────────
// update()
//
// Algorithm:
//   IDLE  →  accel drops below FALL_FREE_FALL_G  →  FREE_FALL
//   FREE_FALL  →  accel rises above FALL_FREE_FALL_G:
//       • elapsed < FALL_FREE_FALL_MIN_MS  → false alarm → IDLE
//       • elapsed >= FALL_FREE_FALL_MIN_MS AND accel >= FALL_IMPACT_G → FALL CONFIRMED → LOCKOUT
//       • elapsed >= FALL_FREE_FALL_MIN_MS AND accel < FALL_IMPACT_G → no impact → IDLE
//   FREE_FALL  →  elapsed >= FALL_IMPACT_WINDOW_MS still in free fall → timeout → IDLE
//   LOCKOUT  →  after FALL_LOCKOUT_MS → IDLE
// ─────────────────────────────────────────────
bool FallDetector::update(float accel_mag_g) {
    uint32_t now = millis();

    switch (_state) {

        case FallState::IDLE:
            if (accel_mag_g < FALL_FREE_FALL_G) {
                _state          = FallState::FREE_FALL;
                _stateEnteredAt = now;
                DEBUG_LOG("[FALL] Free fall phase started");
            }
            break;

        case FallState::FREE_FALL: {
            uint32_t elapsed = now - _stateEnteredAt;

            if (accel_mag_g >= FALL_FREE_FALL_G) {
                // Accel recovered — evaluate whether this qualifies as a fall
                if (elapsed >= FALL_FREE_FALL_MIN_MS && accel_mag_g >= FALL_IMPACT_G) {
                    // Valid free-fall duration followed by strong impact → confirmed fall
                    _fallDetected   = true;
                    _state          = FallState::LOCKOUT;
                    _stateEnteredAt = now;
                    DEBUG_LOG("[FALL] *** FALL CONFIRMED ***");
                    return true;  // caller should send alert immediately
                } else {
                    // Either too brief or no meaningful impact — ignore
                    _state = FallState::IDLE;
                    DEBUG_LOG("[FALL] Free fall cancelled — no valid impact");
                }
            } else if (elapsed > FALL_IMPACT_WINDOW_MS) {
                // Sustained low accel without returning — not a fall (e.g. slow tilt)
                _state = FallState::IDLE;
                DEBUG_LOG("[FALL] Free fall timeout — reset to IDLE");
            }
            break;
        }

        case FallState::LOCKOUT:
            if (now - _stateEnteredAt >= FALL_LOCKOUT_MS) {
                _state = FallState::IDLE;
                DEBUG_LOG("[FALL] Lockout expired — re-armed");
            }
            break;
    }

    return false;
}

// ─────────────────────────────────────────────
// reset()
// Clears the reported flag — does NOT abort an active lockout period.
// Call this after the fall has been transmitted to the node.
// ─────────────────────────────────────────────
void FallDetector::reset() {
    _fallDetected = false;
}