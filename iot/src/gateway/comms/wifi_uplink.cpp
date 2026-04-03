#include "wifi_uplink.h"

#include <Arduino.h>
#include <WiFi.h>

#include "../config_gateway.h"
#include "utils.h"

// ─────────────────────────────────────────────
// begin()
// ─────────────────────────────────────────────
bool WiFiUplink::begin() {
    WiFi.mode(WIFI_STA);
    WiFi.setAutoReconnect(true);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    DEBUG_LOGF("[WIFI] Connecting to %s\n", WIFI_SSID);

    uint32_t start = millis();
    while (WiFi.status() != WL_CONNECTED &&
           (millis() - start) < WIFI_CONNECT_TIMEOUT_MS) {
        delay(500);
    }

    _initialised   = true;
    _lastAttemptMs = millis();

    if (WiFi.status() == WL_CONNECTED) {
        DEBUG_LOGF("[WIFI] Connected. IP=%s\n", WiFi.localIP().toString().c_str());
        return true;
    }

    DEBUG_LOG("[WIFI] Initial connect failed — will retry");
    return false;
}

// ─────────────────────────────────────────────
// isConnected()
// ─────────────────────────────────────────────
bool WiFiUplink::isConnected() const {
    return WiFi.status() == WL_CONNECTED;
}

// ─────────────────────────────────────────────
// maintainConnection()
// ─────────────────────────────────────────────
bool WiFiUplink::maintainConnection() {
    if (isConnected()) return true;
    if (!_initialised) return false;

    uint32_t now = millis();
    if ((now - _lastAttemptMs) < WIFI_RECONNECT_INTERVAL_MS) return false;

    _lastAttemptMs = now;
    DEBUG_LOG("[WIFI] Reconnecting...");
    WiFi.disconnect();
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    uint32_t start = millis();
    while (WiFi.status() != WL_CONNECTED &&
           (millis() - start) < WIFI_CONNECT_TIMEOUT_MS) {
        delay(200);
    }

    if (WiFi.status() == WL_CONNECTED) {
        DEBUG_LOGF("[WIFI] Reconnected. IP=%s\n", WiFi.localIP().toString().c_str());
        return true;
    }

    DEBUG_LOG("[WIFI] Reconnect failed");
    return false;
}