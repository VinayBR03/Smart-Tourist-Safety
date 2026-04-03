#pragma once

#include <stdint.h>
#include <stdbool.h>

// Forward declarations — avoids pulling WiFi.h / HardwareSerial.h into every TU
class WiFiUplink;
class LteUplink;

enum class PostResult : uint8_t {
    OK_ACCEPTED,      // 202
    OK_200,           // 200
    REJECTED,         // 4xx — do NOT retry
    SERVER_ERROR,     // 5xx — retry is appropriate
    NO_CONNECTIVITY,  // neither WiFi nor LTE connected
    TIMEOUT,          // connection or read timeout
};

class HttpClient {
public:
    void begin(WiFiUplink* wifi, LteUplink* lte);

    // Single attempt on whichever uplink is available.
    PostResult post(const char* endpoint, const char* json);

    // Up to HTTP_MAX_RETRIES attempts with HTTP_RETRY_BACKOFF_MS delay between failures.
    // Returns true if any attempt returned 200 or 202.
    bool postWithRetry(const char* endpoint, const char* json);

private:
    WiFiUplink* _wifi = nullptr;
    LteUplink*  _lte  = nullptr;

    PostResult postViaWifi(const char* url, const char* json);
    PostResult postViaLte(const char* url, const char* json);
    void       buildUrl(const char* endpoint, char* urlBuf, uint16_t bufLen) const;
    static PostResult mapStatusCode(int code);
};