#include "sos_button.h"

#include <Arduino.h>
#include "../config_wristband.h"
#include "utils.h"

// ─────────────────────────────────────────────
// begin()
// ─────────────────────────────────────────────
void SOSButton::begin() {
    pinMode(PIN_SOS_BUTTON, INPUT_PULLUP);
    _lastRawState = digitalRead(PIN_SOS_BUTTON);
    _stableState  = _lastRawState;
    DEBUG_LOG("[SOS] Button initialised");
}

// ─────────────────────────────────────────────
// update()
//
// Stage 1 — debounce:
//   Track how long the raw pin has been in a different state than _stableState.
//   Only commit to the new state after SOS_DEBOUNCE_MS of stability.
//
// Stage 2 — hold detection:
//   Once debounced LOW (pressed), start a hold timer.
//   If still LOW after SOS_HOLD_MS, set _triggered.
//   If released before SOS_HOLD_MS elapses, cancel without firing.
// ─────────────────────────────────────────────
void SOSButton::update() {
    uint32_t now      = millis();
    bool     rawState = digitalRead(PIN_SOS_BUTTON);  // LOW = pressed (active LOW)

    // ── Stage 1: debounce
    if (rawState != _lastRawState) {
        _lastChangeMs = now;
        _lastRawState = rawState;
    }

    bool debounced = _stableState;
    if ((now - _lastChangeMs) >= SOS_DEBOUNCE_MS) {
        debounced = rawState;
    }

    bool justPressed  = (debounced == LOW  && _stableState == HIGH);
    bool justReleased = (debounced == HIGH && _stableState == LOW);
    _stableState = debounced;

    // ── Stage 2: hold timer
    if (justPressed) {
        _holdStarted = true;
        _holdStartMs = now;
        _holdFired   = false;
        DEBUG_LOG("[SOS] Button pressed — hold timer started");
    }

    if (justReleased) {
        _holdStarted = false;
        _holdFired   = false;
        DEBUG_LOG("[SOS] Button released before hold — cancelled");
    }

    // Button is being held — check if hold duration reached
    if (_holdStarted && !_holdFired && _stableState == LOW) {
        if ((now - _holdStartMs) >= SOS_HOLD_MS) {
            _triggered = true;
            _holdFired = true;   // latch: won't fire again until next press
            DEBUG_LOG("[SOS] *** SOS TRIGGERED ***");
        }
    }
}

// ─────────────────────────────────────────────
// acknowledge()
// ─────────────────────────────────────────────
void SOSButton::acknowledge() {
    _triggered = false;
    DEBUG_LOG("[SOS] Acknowledged — flag cleared");
}