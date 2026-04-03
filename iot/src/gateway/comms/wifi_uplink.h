#pragma once

#include <stdint.h>
#include <stdbool.h>

class WiFiUplink {
public:
    // Connect to AP defined in config_gateway.h. Blocking up to WIFI_CONNECT_TIMEOUT_MS.
    bool begin();

    bool isConnected() const;

    // Call from main loop — attempts reconnect if disconnected and interval has elapsed.
    bool maintainConnection();

private:
    uint32_t _lastAttemptMs = 0;
    bool     _initialised   = false;
};