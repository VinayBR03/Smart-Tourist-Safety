#include "lte_uplink.h"

#include <Arduino.h>
#include <HardwareSerial.h>

#include "../config_gateway.h"
#include "config.h"
#include "utils.h"

// SIM800L on UART2 (GPIO16=RX, GPIO17=TX as defined in config_gateway.h)
static HardwareSerial lteSerial(2);

// ─────────────────────────────────────────────
// begin()
// ─────────────────────────────────────────────
bool LteUplink::begin() {
    lteSerial.begin(LTE_BAUD, SERIAL_8N1, PIN_LTE_RX, PIN_LTE_TX);
    delay(3000);   // SIM800L needs ~3 s after power-on before accepting commands

    flushSerial();

    if (!sendAT("AT", "OK", LTE_AT_TIMEOUT_MS)) {
        DEBUG_LOG("[LTE] Modem not responding");
        return false;
    }

    sendAT("ATE0", "OK", LTE_AT_TIMEOUT_MS);   // disable echo

    if (!sendAT("AT+CPIN?", "READY", LTE_AT_TIMEOUT_MS)) {
        DEBUG_LOG("[LTE] SIM not ready");
        return false;
    }

    // Wait for GSM network registration (up to 30 s)
    uint32_t start = millis();
    bool registered = false;
    while ((millis() - start) < 30000) {
        lteSerial.println("AT+CREG?");
        String resp = readResponse(2000);
        // +CREG: 0,1 = home, 0,5 = roaming
        if (resp.indexOf(",1") >= 0 || resp.indexOf(",5") >= 0) {
            registered = true;
            break;
        }
        delay(2000);
    }

    if (!registered) {
        DEBUG_LOG("[LTE] Network registration timeout");
        return false;
    }

    _initialised = true;
    DEBUG_LOG("[LTE] Modem registered — opening GPRS bearer");
    return reconnect();
}

// ─────────────────────────────────────────────
// reconnect()
// ─────────────────────────────────────────────
bool LteUplink::reconnect() {
    if (!_initialised) return false;

    sendAT("AT+SAPBR=0,1", "OK", 5000);  // close any stale bearer

    char cmd[80];
    sendAT("AT+SAPBR=3,1,\"Contype\",\"GPRS\"", "OK", LTE_AT_TIMEOUT_MS);
    snprintf(cmd, sizeof(cmd), "AT+SAPBR=3,1,\"APN\",\"%s\"", LTE_APN);
    sendAT(cmd, "OK", LTE_AT_TIMEOUT_MS);

    if (!sendAT("AT+SAPBR=1,1", "OK", LTE_CONNECT_TIMEOUT_MS)) {
        DEBUG_LOG("[LTE] GPRS bearer open failed");
        _connected = false;
        return false;
    }

    _connected = true;
    DEBUG_LOG("[LTE] GPRS connected");
    return true;
}

// ─────────────────────────────────────────────
// isConnected()
// ─────────────────────────────────────────────
bool LteUplink::isConnected() {
    if (!_initialised) return false;
    lteSerial.println("AT+SAPBR=2,1");
    String resp = readResponse(LTE_AT_TIMEOUT_MS);
    _connected = (resp.indexOf("+SAPBR: 1,1") >= 0);
    return _connected;
}

// ─────────────────────────────────────────────
// httpPost()
//
// SIM800L HTTP POST sequence using built-in AT+HTTP* stack.
// ─────────────────────────────────────────────
LteHttpResult LteUplink::httpPost(const char* url, const char* json, const char* apiKey) {
    LteHttpResult result = { -1, false };

    if (!_connected && !reconnect()) return result;

    flushSerial();

    if (!sendAT("AT+HTTPINIT", "OK", LTE_AT_TIMEOUT_MS)) {
        DEBUG_LOG("[LTE] HTTPINIT failed"); return result;
    }

    sendAT("AT+HTTPPARA=\"CID\",1", "OK", LTE_AT_TIMEOUT_MS);

    char urlCmd[256];
    snprintf(urlCmd, sizeof(urlCmd), "AT+HTTPPARA=\"URL\",\"%s\"", url);
    if (!sendAT(urlCmd, "OK", LTE_AT_TIMEOUT_MS)) {
        sendAT("AT+HTTPTERM", "OK", LTE_AT_TIMEOUT_MS);
        return result;
    }

    sendAT("AT+HTTPPARA=\"CONTENT\",\"application/json\"", "OK", LTE_AT_TIMEOUT_MS);

    // Inject X-API-Key via USERDATA header
    char hdrCmd[128];
    snprintf(hdrCmd, sizeof(hdrCmd), "AT+HTTPPARA=\"USERDATA\",\"X-API-Key: %s\"", apiKey);
    sendAT(hdrCmd, "OK", LTE_AT_TIMEOUT_MS);

    size_t jsonLen = strlen(json);
    char   dataCmd[40];
    snprintf(dataCmd, sizeof(dataCmd), "AT+HTTPDATA=%u,10000", (unsigned)jsonLen);

    if (!sendAT(dataCmd, "DOWNLOAD", LTE_AT_TIMEOUT_MS)) {
        sendAT("AT+HTTPTERM", "OK", LTE_AT_TIMEOUT_MS);
        return result;
    }

    lteSerial.print(json);
    delay(500);

    // Trigger POST (action=1) — modem responds with OK then +HTTPACTION asynchronously
    if (!sendAT("AT+HTTPACTION=1", "OK", HTTP_POST_TIMEOUT_MS)) {
        sendAT("AT+HTTPTERM", "OK", LTE_AT_TIMEOUT_MS);
        return result;
    }

    // Read async action result: "+HTTPACTION: 1,<code>,<len>"
    String actionResp = readResponse(HTTP_POST_TIMEOUT_MS);
    sendAT("AT+HTTPTERM", "OK", LTE_AT_TIMEOUT_MS);

    int firstComma = actionResp.indexOf(",");
    if (firstComma >= 0) {
        int secondComma = actionResp.indexOf(",", firstComma + 1);
        if (secondComma > firstComma) {
            String codeStr     = actionResp.substring(firstComma + 1, secondComma);
            result.status_code = codeStr.toInt();
            result.ok          = (result.status_code == HTTP_OK ||
                                  result.status_code == HTTP_ACCEPTED);
        }
    }

    DEBUG_LOGF("[LTE] POST status=%d\n", result.status_code);
    return result;
}

// ─────────────────────────────────────────────
// sendAT()
// ─────────────────────────────────────────────
bool LteUplink::sendAT(const char* cmd, const char* expectedResponse, uint32_t timeoutMs) {
    flushSerial();
    lteSerial.println(cmd);
    String resp = readResponse(timeoutMs);
    bool matched = resp.indexOf(expectedResponse) >= 0;
    DEBUG_LOGF("[LTE] %s → matched=%d\n", cmd, matched);
    return matched;
}

// ─────────────────────────────────────────────
// readResponse()
// ─────────────────────────────────────────────
String LteUplink::readResponse(uint32_t timeoutMs) {
    String   response = "";
    uint32_t start    = millis();

    while ((millis() - start) < timeoutMs) {
        while (lteSerial.available()) {
            response += static_cast<char>(lteSerial.read());
        }
        // Early exit on known terminal strings
        if (response.endsWith("\r\nOK\r\n")      ||
            response.endsWith("\r\nERROR\r\n")   ||
            response.indexOf("+HTTPACTION") >= 0 ||
            response.indexOf("+SAPBR")      >= 0 ||
            response.indexOf("DOWNLOAD")    >= 0) {
            break;
        }
        delay(10);
    }
    return response;
}

// ─────────────────────────────────────────────
// flushSerial()
// ─────────────────────────────────────────────
void LteUplink::flushSerial() {
    while (lteSerial.available()) lteSerial.read();
}