#pragma once

#include <stdint.h>
#include <stdbool.h>

// sos_button tracks a single tactile button wired active-LOW with internal pull-up.
// It implements a two-stage filter:
//   1. 50 ms debounce  — ignores glitches shorter than SOS_DEBOUNCE_MS
//   2. 1 s hold check  — only fires when the button is held for SOS_HOLD_MS
//      (avoids accidental single-touch triggers in a crowd)
//
// The caller polls isTriggered() every loop iteration.
// Once it returns true it latches until acknowledge() is called.

class SOSButton {
public:
    // Configure pin as input with internal pull-up. Call once in setup().
    void begin();

    // Non-blocking update — must be called every loop iteration (or at least
    // every few milliseconds for reliable debounce).
    void update();

    // Returns true from the moment a valid SOS press is confirmed until
    // acknowledge() is called.
    bool isTriggered() const { return _triggered; }

    // Clear the triggered flag — call after the SOS packet has been sent.
    void acknowledge();

private:
    bool     _triggered        = false;

    // Debounce state
    bool     _lastRawState     = true;   // HIGH (unpressed) is the resting state (active LOW)
    bool     _stableState      = true;
    uint32_t _lastChangeMs     = 0;

    // Hold tracking
    bool     _holdStarted      = false;
    uint32_t _holdStartMs      = 0;
    bool     _holdFired        = false;  // prevents re-firing while button is still held
};