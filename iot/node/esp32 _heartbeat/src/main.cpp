#include <WiFi.h>
#include <HTTPClient.h>

const char* ssid = "SSID1-2.4G";
const char* password = "8618407793";

const char* serverUrl = "http://192.168.1.8:8000/iot/heartbeat?local_kw=test";
const char* apiKey = "esp32-secret-key-456";

unsigned long lastHeartbeat = 0;
const unsigned long heartbeatInterval = 10000;

void setup() {
    Serial.begin(115200);

    WiFi.begin(ssid, password);
    Serial.print("Connecting to WiFi");

    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }

    Serial.println("\nConnected!");
    Serial.println(WiFi.localIP());
}

void sendHeartbeat() {
    if (WiFi.status() == WL_CONNECTED) {
        HTTPClient http;

        http.begin(serverUrl);
        http.addHeader("Content-Type", "application/json");
        http.addHeader("x-api-key", apiKey);

        String payload = "{";
        payload += "\"device_id\":\"esp32_gate_02\",";
        payload += "\"status\":\"active\"";
        payload += "}";

        int httpResponseCode = http.POST(payload);

        Serial.print("Response Code: ");
        Serial.println(httpResponseCode);

        if (httpResponseCode > 0) {
            String response = http.getString();
            Serial.println(response);
        }

        http.end();
    }
}

void loop() {
    if (millis() - lastHeartbeat > heartbeatInterval) {
        lastHeartbeat = millis();
        sendHeartbeat();
    }
}