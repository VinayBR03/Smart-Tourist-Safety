#include "http_client.h"

#include <Arduino.h>
#include <HTTPClient.h>   // ESP32 Arduino built-in

#include "../comms/wifi_uplink.h"
#include "../comms/lte_uplink.h"
#include "../config_gateway.h"
#include "config.h"
#include "utils.h"

// ─────────────────────────────────────────────
// begin()
// ─────────────────────────────────────────────
void HttpClient::begin(WiFiUplink* wifi, LteUplink* lte) {
    _wifi = wifi;
    _lte  = lte;
}

// ─────────────────────────────────────────────
// post()
// ─────────────────────────────────────────────
PostResult HttpClient::post(const char* endpoint, const char* json) {
    char url[256];
    buildUrl(endpoint, url, sizeof(url));

    if (_wifi && _wifi->isConnected()) return postViaWifi(url, json);
    if (_lte  && _lte->isConnected())  return postViaLte(url, json);

    DEBUG_LOG("[HTTP] No connectivity");
    return PostResult::NO_CONNECTIVITY;
}

// ─────────────────────────────────────────────
// postWithRetry()
// ─────────────────────────────────────────────
bool HttpClient::postWithRetry(const char* endpoint, const char* json) {
    for (uint8_t attempt = 1; attempt <= HTTP_MAX_RETRIES; attempt++) {
        PostResult res = post(endpoint, json);

        DEBUG_LOGF("[HTTP] Attempt %d/%d result=%d\n",
                   attempt, HTTP_MAX_RETRIES, (int)res);

        if (res == PostResult::OK_ACCEPTED || res == PostResult::OK_200) return true;

        // 4xx — backend rejected the payload; retrying won't help
        if (res == PostResult::REJECTED) {
            DEBUG_LOG("[HTTP] 4xx rejected — aborting retries");
            return false;
        }

        if (attempt < HTTP_MAX_RETRIES) {
            delay(HTTP_RETRY_BACKOFF_MS);
            if (_wifi) _wifi->maintainConnection();
            if (_lte && !_lte->isConnected()) _lte->reconnect();
        }
    }

    DEBUG_LOG("[HTTP] All retries exhausted");
    return false;
}

// ─────────────────────────────────────────────
// postViaWifi()
// ─────────────────────────────────────────────
PostResult HttpClient::postViaWifi(const char* url, const char* json) {
    // Use :: prefix to avoid shadowing our own HttpClient class name
    ::HTTPClient http;

    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-API-Key",    GATEWAY_API_KEY);
    http.setTimeout(HTTP_POST_TIMEOUT_MS);

    int code = http.POST(const_cast<char*>(json));
    http.end();

    if (code <= 0) {
        DEBUG_LOGF("[HTTP/WiFi] Error: %s\n",
                   ::HTTPClient::errorToString(code).c_str());
        return PostResult::TIMEOUT;
    }

    DEBUG_LOGF("[HTTP/WiFi] Status=%d\n", code);
    return mapStatusCode(code);
}

// ─────────────────────────────────────────────
// postViaLte()
// ─────────────────────────────────────────────
PostResult HttpClient::postViaLte(const char* url, const char* json) {
    if (!_lte) return PostResult::NO_CONNECTIVITY;
    LteHttpResult res = _lte->httpPost(url, json, GATEWAY_API_KEY);
    if (res.status_code < 0) return PostResult::TIMEOUT;
    return mapStatusCode(res.status_code);
}

// ─────────────────────────────────────────────
// buildUrl()
// ─────────────────────────────────────────────
void HttpClient::buildUrl(const char* endpoint, char* urlBuf, uint16_t bufLen) const {
    snprintf(urlBuf, bufLen, "%s%s", BACKEND_BASE_URL, endpoint);
}

// ─────────────────────────────────────────────
// mapStatusCode()
// ─────────────────────────────────────────────
PostResult HttpClient::mapStatusCode(int code) {
    if (code == HTTP_ACCEPTED)       return PostResult::OK_ACCEPTED;
    if (code == HTTP_OK)             return PostResult::OK_200;
    if (code >= 400 && code < 500)   return PostResult::REJECTED;
    if (code >= 500)                 return PostResult::SERVER_ERROR;
    return PostResult::TIMEOUT;
}