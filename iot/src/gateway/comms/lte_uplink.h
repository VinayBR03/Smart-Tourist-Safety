#pragma once

#include <stdint.h>
#include <stdbool.h>
#include <Arduino.h>

struct LteHttpResult {
    int  status_code;   // HTTP status code, or -1 on AT/connection failure
    bool ok;            // true if 200 or 202
};

class LteUplink {
public:
    // Initialise UART, verify modem, register on network, open GPRS bearer.
    bool begin();

    // Query bearer status via AT+SAPBR=2,1.
    bool isConnected();

    // Re-establish GPRS session.
    bool reconnect();

    // HTTP POST via SIM800L built-in HTTP stack.
    // url must be the full URL including scheme and port.
    LteHttpResult httpPost(const char* url, const char* json, const char* apiKey);

private:
    bool _initialised = false;
    bool _connected   = false;

    bool   sendAT(const char* cmd, const char* expectedResponse, uint32_t timeoutMs);
    String readResponse(uint32_t timeoutMs);
    void   flushSerial();
};