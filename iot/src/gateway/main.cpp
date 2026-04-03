#include <Arduino.h>
#include <Wire.h>
#include <SPI.h>
#include <time.h>

#include "config_gateway.h"
#include "config.h"
#include "utils.h"
#include "packet_types.h"

#include "sensors/bme280.h"
#include "sensors/mq135.h"
#include "sensors/ina219.h"
#include "comms/lora_rx.h"
#include "comms/wifi_uplink.h"
#include "comms/lte_uplink.h"
#include "uplink/payload_builder.h"
#include "uplink/queue.h"
#include "uplink/http_client.h"

// ─────────────────────────────────────────────
// Peripheral instances
// ─────────────────────────────────────────────
static GatewayLoRaRx  loraRx;
static WiFiUplink     wifiUplink;
static LteUplink      lteUplink;
static HttpClient     httpClient;
static PayloadBuilder payloadBuilder;
static PacketQueue    packetQueue;
static BME280Sensor   envSensor;
static MQ135Sensor    airSensor;
static INA219Monitor  powerSensor;

// ─────────────────────────────────────────────
// Dedup cache
// Tracks the last DEDUP_CACHE_SIZE checksums per wristband device.
// ─────────────────────────────────────────────
struct DedupSlot {
    char    device_id[DEVICE_ID_LEN];
    uint8_t checksums[DEDUP_CACHE_SIZE];
    uint8_t writePos;
    bool    occupied;
};
static DedupSlot dedupCache[DEDUP_DEVICE_SLOTS] = {};

// ─────────────────────────────────────────────
// Timing
// ─────────────────────────────────────────────
static uint32_t lastHeartbeatMs  = 0;
static uint32_t lastEnvReadMs    = 0;
static uint32_t lastQueueFlushMs = 0;

// Flush up to this many queued items per cycle to avoid blocking LoRa RX
static constexpr uint8_t  MAX_FLUSH_PER_CYCLE    = 10;
static constexpr uint32_t QUEUE_FLUSH_INTERVAL_MS = 5000;

// ─────────────────────────────────────────────
// Forward declarations
// ─────────────────────────────────────────────
static void initPeripherals();
static void syncNTP();
static void handleIncomingPacket();
static void handleHeartbeat();
static void handleEnvCycle();
static void flushQueue();
static bool postOrQueue(const char* endpoint, const char* json);
static void getCurrentTimestamp(char* buf, uint8_t len);
static void processHealthPacket(const GatewayRxPacket& pkt);
static void processSOSPacket(const GatewayRxPacket& pkt);
static void processRFIDPacket(const GatewayRxPacket& pkt);
static bool isDuplicate(const char* device_id, uint8_t checksum);
static void recordChecksum(const char* device_id, uint8_t checksum);

// ─────────────────────────────────────────────
// setup()
// ─────────────────────────────────────────────
void setup() {
#ifdef DEBUG_SERIAL
    Serial.begin(115200);
    uint32_t wait = millis();
    while (!Serial && (millis() - wait) < 2000) {}
    Serial.println(F("[GATEWAY] === Boot ==="));
    Serial.printf("[GATEWAY] ID=%s  FW=%s\n", GATEWAY_DEVICE_ID, FIRMWARE_VERSION);
    Serial.printf("[GATEWAY] GPS=%.5f,%.5f\n", GATEWAY_LATITUDE, GATEWAY_LONGITUDE);
#endif

    initPeripherals();
    syncNTP();

    lastHeartbeatMs  = millis();
    lastEnvReadMs    = millis();
    lastQueueFlushMs = millis();

    DEBUG_LOG("[GATEWAY] Boot complete");
}

// ─────────────────────────────────────────────
// loop()
//
// Priority:
//   1. WiFi maintenance
//   2. LoRa receive (lowest latency path)
//   3. Queue flush when connectivity available
//   4. Heartbeat every 60 s
//   5. Environmental sensors every 5 min
// ─────────────────────────────────────────────
void loop() {
    wifiUplink.maintainConnection();

    handleIncomingPacket();

    uint32_t now = millis();

    if ((now - lastQueueFlushMs) >= QUEUE_FLUSH_INTERVAL_MS) {
        lastQueueFlushMs = now;
        flushQueue();
    }

    if ((now - lastHeartbeatMs) >= GATEWAY_HEARTBEAT_INTERVAL_MS) {
        lastHeartbeatMs = now;
        handleHeartbeat();
    }

    if ((now - lastEnvReadMs) >= NODE_ENV_READ_INTERVAL_MS) {
        lastEnvReadMs = now;
        handleEnvCycle();
    }

    delay(5);
}

// ─────────────────────────────────────────────
// handleIncomingPacket()
// ─────────────────────────────────────────────
static void handleIncomingPacket() {
    GatewayRxPacket pkt = loraRx.poll();

    if (pkt.kind == GatewayRxKind::NONE)    return;
    if (pkt.kind == GatewayRxKind::UNKNOWN) return;

    // NodeStatus packets are informational only — no backend endpoint defined
    if (pkt.kind == GatewayRxKind::NODE_STATUS) {
        DEBUG_LOGF("[MAIN] NodeStatus from %.4s bat=%d%%\n",
                   pkt.nodeStatus.node_id, pkt.nodeStatus.battery_pct);
        return;
    }

    // ── Extract sender device_id and raw checksum for dedup
    const char*    senderId  = nullptr;
    const uint8_t* rawBytes  = nullptr;
    size_t         rawLen    = 0;

    switch (pkt.kind) {
        case GatewayRxKind::HEALTH:
            senderId = pkt.health.device_id;
            rawBytes = reinterpret_cast<const uint8_t*>(&pkt.health);
            rawLen   = sizeof(HealthPacket);
            break;
        case GatewayRxKind::SOS:
            senderId = pkt.sos.device_id;
            rawBytes = reinterpret_cast<const uint8_t*>(&pkt.sos);
            rawLen   = sizeof(SOSPacket);
            break;
        case GatewayRxKind::RFID:
            senderId = pkt.rfid.device_id;
            rawBytes = reinterpret_cast<const uint8_t*>(&pkt.rfid);
            rawLen   = sizeof(RFIDPacket);
            break;
        default: return;
    }

    // Checksum covers all bytes except the last (which is the checksum itself)
    uint8_t checksum = compute_checksum(rawBytes, rawLen - 1);

    if (isDuplicate(senderId, checksum)) {
        DEBUG_LOGF("[MAIN] Duplicate from %s — dropped\n", senderId);
        return;
    }
    recordChecksum(senderId, checksum);

    // ── Re-sync NTP opportunistically if we lost it
    if (!PayloadBuilder::isNtpSynced() && wifiUplink.isConnected()) {
        syncNTP();
    }

    switch (pkt.kind) {
        case GatewayRxKind::HEALTH: processHealthPacket(pkt); break;
        case GatewayRxKind::SOS:    processSOSPacket(pkt);    break;
        case GatewayRxKind::RFID:   processRFIDPacket(pkt);   break;
        default: break;
    }
}

// ─────────────────────────────────────────────
// processHealthPacket()
// Sends two POSTs per health packet: /iot/health + /iot/location
// ─────────────────────────────────────────────
static void processHealthPacket(const GatewayRxPacket& pkt) {
    char ts[25];
    getCurrentTimestamp(ts, sizeof(ts));
    const char* tsPtr = (ts[0] != '\0') ? ts : nullptr;

    char json[JSON_BUFFER_SIZE];

    if (payloadBuilder.buildHealth(pkt.health, pkt.nodeHeader, tsPtr, json, sizeof(json))) {
        postOrQueue(ENDPOINT_HEALTH, json);
    }

    if (payloadBuilder.buildLocation(
            pkt.health.device_id,
            decode_gps(pkt.nodeHeader.node_lat),
            decode_gps(pkt.nodeHeader.node_lon),
            static_cast<float>(pkt.nodeHeader.rssi),
            false,
            tsPtr,
            json, sizeof(json))) {
        postOrQueue(ENDPOINT_LOCATION, json);
    }
}

// ─────────────────────────────────────────────
// processSOSPacket()
// Sends /iot/health (alert=SOS) + /iot/location (sos_flag=true)
// The location POST with sos_flag=true automatically creates an incident.
// ─────────────────────────────────────────────
static void processSOSPacket(const GatewayRxPacket& pkt) {
    char ts[25];
    getCurrentTimestamp(ts, sizeof(ts));
    const char* tsPtr = (ts[0] != '\0') ? ts : nullptr;

    char json[JSON_BUFFER_SIZE];

    if (payloadBuilder.buildLocation(
            pkt.sos.device_id,
            decode_gps(pkt.nodeHeader.node_lat),
            decode_gps(pkt.nodeHeader.node_lon),
            static_cast<float>(pkt.nodeHeader.rssi),
            true,   // sos_flag — triggers backend incident creation
            tsPtr,
            json, sizeof(json))) {
        postOrQueue(ENDPOINT_LOCATION, json);
    }
}

// ─────────────────────────────────────────────
// processRFIDPacket()
// RFID checkpoint scan → /iot/location using node's GPS as position
// ─────────────────────────────────────────────
static void processRFIDPacket(const GatewayRxPacket& pkt) {
    char ts[25];
    getCurrentTimestamp(ts, sizeof(ts));
    const char* tsPtr = (ts[0] != '\0') ? ts : nullptr;

    char json[JSON_BUFFER_SIZE];

    if (payloadBuilder.buildRFIDLocation(pkt.rfid, pkt.nodeHeader, tsPtr, json, sizeof(json))) {
        postOrQueue(ENDPOINT_LOCATION, json);
    }
}

// ─────────────────────────────────────────────
// handleHeartbeat()
// ─────────────────────────────────────────────
static void handleHeartbeat() {
    PowerData pwr = powerSensor.read();

    char json[JSON_BUFFER_SIZE];
    if (!payloadBuilder.buildHeartbeat(
            pwr.valid ? static_cast<float>(pwr.battery_pct) : 0.0f,
            pwr.valid ? pwr.voltage_mv : 0.0f,
            json, sizeof(json))) {
        return;
    }

    bool ok = httpClient.postWithRetry(ENDPOINT_HEARTBEAT, json);
    DEBUG_LOGF("[MAIN] Heartbeat %s\n", ok ? "OK" : "FAILED");
}

// ─────────────────────────────────────────────
// handleEnvCycle()
// ─────────────────────────────────────────────
static void handleEnvCycle() {
    EnvData        env = envSensor.read();
    AirQualityData air = airSensor.read();

    DEBUG_LOGF("[MAIN] Env T=%.1f°C H=%.1f%% P=%.0fPa AQ=%u\n",
               env.temperature_c, env.humidity_pct,
               env.pressure_pa,   air.raw_adc);

    if (air.valid && air.is_dangerous) {
        DEBUG_LOG("[MAIN] *** GATEWAY AIR QUALITY ALERT ***");
    }
}

// ─────────────────────────────────────────────
// flushQueue()
// Drains the SPIFFS queue using peek+commit so failed POSTs
// leave the item intact for the next flush cycle.
// ─────────────────────────────────────────────
static void flushQueue() {
    if (packetQueue.isEmpty()) return;
    if (!wifiUplink.isConnected() && !lteUplink.isConnected()) return;

    DEBUG_LOGF("[QUEUE] Flushing. Queued=%u\n", packetQueue.count());

    uint8_t flushed = 0;
    while (!packetQueue.isEmpty() && flushed < MAX_FLUSH_PER_CYCLE) {
        QueueRecord rec;
        if (!packetQueue.peek(rec)) break;

        bool ok = httpClient.postWithRetry(rec.endpoint, rec.json);
        if (ok) {
            packetQueue.commit();
            flushed++;
        } else {
            DEBUG_LOG("[QUEUE] Flush stalled — retrying next cycle");
            break;
        }
    }

    if (flushed > 0) {
        DEBUG_LOGF("[QUEUE] Flushed %u. Remaining=%u\n",
                   flushed, packetQueue.count());
    }
}

// ─────────────────────────────────────────────
// postOrQueue()
// Try immediate POST; on failure or no connectivity, push to SPIFFS queue.
// ─────────────────────────────────────────────
static bool postOrQueue(const char* endpoint, const char* json) {
    bool online = wifiUplink.isConnected() || lteUplink.isConnected();

    if (online && httpClient.postWithRetry(endpoint, json)) return true;

    bool queued = packetQueue.push(endpoint, json);
    DEBUG_LOGF("[MAIN] %s → queued. Queue=%u\n", endpoint, packetQueue.count());
    return queued;
}

// ─────────────────────────────────────────────
// getCurrentTimestamp()
// Returns empty string when NTP not synced — caller passes nullptr to build* functions.
// ─────────────────────────────────────────────
static void getCurrentTimestamp(char* buf, uint8_t len) {
    buf[0] = '\0';
    PayloadBuilder::currentTimestamp(buf, len);
}

// ─────────────────────────────────────────────
// Dedup helpers
// ─────────────────────────────────────────────
static bool isDuplicate(const char* device_id, uint8_t checksum) {
    for (uint8_t i = 0; i < DEDUP_DEVICE_SLOTS; i++) {
        if (!dedupCache[i].occupied) continue;
        if (strncmp(dedupCache[i].device_id, device_id, DEVICE_ID_LEN) != 0) continue;

        for (uint8_t j = 0; j < DEDUP_CACHE_SIZE; j++) {
            if (dedupCache[i].checksums[j] == checksum) return true;
        }
        return false;
    }
    return false;
}

static void recordChecksum(const char* device_id, uint8_t checksum) {
    int slot = -1;

    for (uint8_t i = 0; i < DEDUP_DEVICE_SLOTS; i++) {
        if (dedupCache[i].occupied &&
            strncmp(dedupCache[i].device_id, device_id, DEVICE_ID_LEN) == 0) {
            slot = i; break;
        }
    }

    if (slot < 0) {
        for (uint8_t i = 0; i < DEDUP_DEVICE_SLOTS; i++) {
            if (!dedupCache[i].occupied) { slot = i; break; }
        }
    }

    if (slot < 0) {
        // All slots occupied — evict slot 0 (oldest by position)
        slot = 0;
        memset(&dedupCache[0], 0, sizeof(DedupSlot));
        DEBUG_LOG("[DEDUP] Cache full — slot 0 evicted");
    }

    DedupSlot& s = dedupCache[slot];
    if (!s.occupied) {
        copy_device_id(s.device_id, device_id);
        s.occupied = true;
        s.writePos = 0;
    }

    s.checksums[s.writePos % DEDUP_CACHE_SIZE] = checksum;
    s.writePos++;
}

// ─────────────────────────────────────────────
// syncNTP()
// Uses ESP32 Arduino built-in configTime() — no extra library needed.
// Remove `arduino-libraries/NTPClient` from platformio.ini gateway lib_deps.
// ─────────────────────────────────────────────
static void syncNTP() {
    if (!wifiUplink.isConnected()) {
        DEBUG_LOG("[NTP] No WiFi — deferring sync");
        return;
    }

    DEBUG_LOG("[NTP] Syncing...");
    configTime(0, 0, NTP_SERVER_1, NTP_SERVER_2);

    uint32_t start = millis();
    while (!PayloadBuilder::isNtpSynced() &&
           (millis() - start) < NTP_SYNC_TIMEOUT_MS) {
        delay(200);
    }

    if (PayloadBuilder::isNtpSynced()) {
        char ts[25];
        PayloadBuilder::currentTimestamp(ts, sizeof(ts));
        DEBUG_LOGF("[NTP] Synced: %s\n", ts);
    } else {
        DEBUG_LOG("[NTP] Timeout — proceeding without clock");
    }
}

// ─────────────────────────────────────────────
// initPeripherals()
// ─────────────────────────────────────────────
static void initPeripherals() {
    Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
    Wire.setClock(400000);
    SPI.begin(PIN_SPI_SCK, PIN_SPI_MISO, PIN_SPI_MOSI);

    if (!loraRx.begin())      DEBUG_LOG("[INIT] LoRa RX FAILED");
    if (!envSensor.begin())   DEBUG_LOG("[INIT] BME280 FAILED");
    if (!powerSensor.begin()) DEBUG_LOG("[INIT] INA219 FAILED");
    airSensor.begin();

    if (!packetQueue.begin()) DEBUG_LOG("[INIT] SPIFFS queue FAILED");

    wifiUplink.begin();    // blocking up to WIFI_CONNECT_TIMEOUT_MS
    lteUplink.begin();     // LTE fallback — boots in parallel

    httpClient.begin(&wifiUplink, &lteUplink);
}