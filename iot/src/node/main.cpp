#include <Arduino.h>
#include <Wire.h>
#include <SPI.h>

#include "config_node.h"
#include "config.h"
#include "utils.h"
#include "packet_types.h"

#include "sensors/bme280.h"
#include "sensors/mq135.h"
#include "sensors/ina219.h"
#include "comms/lora_rx.h"
#include "comms/lora_tx.h"
#include "routing/mesh_router.h"

// ─────────────────────────────────────────────
// Peripheral instances
// ─────────────────────────────────────────────
static BME280Sensor   envSensor;
static MQ135Sensor    airSensor;
static INA219Monitor  powerSensor;
static LoRaRx         loraRx;
static NodeLoRaTx     loraTx;
static MeshRouter     router;

// ─────────────────────────────────────────────
// Timing state
// ─────────────────────────────────────────────
static uint32_t lastEnvReadMs    = 0;
static uint32_t lastStatusTxMs   = 0;

// ─────────────────────────────────────────────
// Forward declarations
// ─────────────────────────────────────────────
static void initPeripherals();
static void handleIncomingPacket();
static void handleEnvCycle();
static void sendNodeStatus();
static void forwardWristbandPacket(const ReceivedPacket& pkt);
static void handleAirQualityAlert(const AirQualityData& air);

// ─────────────────────────────────────────────
// setup()
// ─────────────────────────────────────────────
void setup() {
#ifdef DEBUG_SERIAL
    Serial.begin(115200);
    uint32_t wait = millis();
    while (!Serial && (millis() - wait) < 2000) {}
    Serial.println(F("[NODE] === Boot ==="));
    Serial.printf("[NODE] ID=%s  Zone=%s\n", NODE_DEVICE_ID, NODE_ZONE_ID);
    Serial.printf("[NODE] GPS=%.5f,%.5f\n", NODE_LATITUDE, NODE_LONGITUDE);
    Serial.printf("[NODE] Firmware=%s\n", FIRMWARE_VERSION);
#endif

    initPeripherals();

    // Prime timers so first env read fires after one full interval
    lastEnvReadMs  = millis();
    lastStatusTxMs = millis();

    DEBUG_LOG("[NODE] Setup complete — entering receive loop");
}

// ─────────────────────────────────────────────
// loop()
//
// Priority:
//   1. LoRa receive — lowest latency path, must poll every iteration
//   2. Air quality danger check — forward alert packet immediately if triggered
//   3. Environmental sensor read on 5-minute interval
//   4. Node status TX on same interval as env read
//   5. Proximity table stale eviction — housekeeping
// ─────────────────────────────────────────────
void loop() {
    // ── 1. Non-blocking LoRa receive poll
    handleIncomingPacket();

    // ── 2 & 3. Environmental sensors on interval
    uint32_t now = millis();
    if ((now - lastEnvReadMs) >= NODE_ENV_READ_INTERVAL_MS) {
        lastEnvReadMs = now;
        handleEnvCycle();
    }

    // ── 4. Node status TX on same interval
    if ((now - lastStatusTxMs) >= NODE_ENV_READ_INTERVAL_MS) {
        lastStatusTxMs = now;
        sendNodeStatus();
    }

    // ── 5. Evict stale proximity entries
    router.evictStale();

    // Small yield — prevents WDT reset, gives FreeRTOS background tasks time
    delay(5);
}

// ─────────────────────────────────────────────
// handleIncomingPacket()
//
// Polls LoRaRx non-blocking. On a valid packet:
//   - Records sighting in proximity table
//   - Checks forward deadline (must forward within NODE_FORWARD_DEADLINE_MS)
//   - Builds NodeHeader and forwards upstream
// ─────────────────────────────────────────────
static void handleIncomingPacket() {
    ReceivedPacket pkt = loraRx.poll();
    if (pkt.kind == RxPacketKind::NONE) return;
    if (pkt.kind == RxPacketKind::UNKNOWN) return;

    uint32_t receivedAt = millis();

    // ── Record in proximity table
    const char* senderDeviceId = nullptr;
    switch (pkt.kind) {
        case RxPacketKind::HEALTH: senderDeviceId = pkt.health.device_id; break;
        case RxPacketKind::SOS:    senderDeviceId = pkt.sos.device_id;    break;
        case RxPacketKind::RFID:   senderDeviceId = pkt.rfid.device_id;   break;
        default: break;
    }

    if (senderDeviceId) {
        router.recordSighting(senderDeviceId, pkt.rssi);
    }

    // ── Check if we would exceed max hops before forwarding
    // For now hop count tracking is simplified — the node always forwards
    // unless the packet is clearly a retransmission of an already-forwarded
    // packet (which would have a NodeHeader as its first bytes, not 0x01-0x06).
    // Full multi-hop hop-count tracking is handled by inspecting whether the
    // gateway strips NodeHeaders recursively.
    if (pkt.rssi < MESH_MIN_RSSI_DBM) {
        DEBUG_LOGF("[NODE] Packet RSSI %d below minimum %d — dropped\n",
                   pkt.rssi, MESH_MIN_RSSI_DBM);
        return;
    }

    // ── Forward — must complete within NODE_FORWARD_DEADLINE_MS
    uint32_t deadline = receivedAt + NODE_FORWARD_DEADLINE_MS;
    if (millis() > deadline) {
        DEBUG_LOG("[NODE] Forwarding deadline missed — dropped");
        return;
    }

    forwardWristbandPacket(pkt);
}

// ─────────────────────────────────────────────
// forwardWristbandPacket()
// ─────────────────────────────────────────────
static void forwardWristbandPacket(const ReceivedPacket& pkt) {
    NodeHeader hdr = router.buildHeader(pkt.rssi);

    const uint8_t* rawBytes = nullptr;
    size_t         rawLen   = 0;

    switch (pkt.kind) {
        case RxPacketKind::HEALTH:
            rawBytes = reinterpret_cast<const uint8_t*>(&pkt.health);
            rawLen   = sizeof(HealthPacket);
            break;
        case RxPacketKind::SOS:
            rawBytes = reinterpret_cast<const uint8_t*>(&pkt.sos);
            rawLen   = sizeof(SOSPacket);
            break;
        case RxPacketKind::RFID:
            rawBytes = reinterpret_cast<const uint8_t*>(&pkt.rfid);
            rawLen   = sizeof(RFIDPacket);
            break;
        default:
            return;
    }

    NodeTxResult fwdResult = loraTx.forwardPacket(hdr, rawBytes, rawLen);
    DEBUG_LOGF("[NODE] Forward result=%d  tracked=%d\n",
               (int)fwdResult, router.trackedCount());
}

// ─────────────────────────────────────────────
// handleEnvCycle()
//
// Reads BME280 + MQ-135. If air quality is dangerous, immediately forwards
// an alert by embedding the danger flag in the node status packet.
// ─────────────────────────────────────────────
static void handleEnvCycle() {
    AirQualityData air = airSensor.read();
    handleAirQualityAlert(air);

    // BME280 data is folded into the status packet in sendNodeStatus()
    // which is called from the same interval in loop() — no need to cache here.
}

// ─────────────────────────────────────────────
// handleAirQualityAlert()
//
// If MQ-135 crosses the danger threshold, trigger an immediate status TX
// rather than waiting for the next 5-minute interval.
// ─────────────────────────────────────────────
static void handleAirQualityAlert(const AirQualityData& air) {
    if (!air.valid || !air.is_dangerous) return;

    DEBUG_LOGF("[NODE] *** AIR QUALITY ALERT: ADC=%u ***\n", air.raw_adc);

    // Force immediate node status TX — gateway sees the elevated air_quality value
    // and the backend can raise an environmental incident.
    sendNodeStatus();

    // Reset the regular status TX timer to avoid double-sending within the same interval
    lastStatusTxMs = millis();
}

// ─────────────────────────────────────────────
// sendNodeStatus()
// ─────────────────────────────────────────────
static void sendNodeStatus() {
    EnvData    env  = envSensor.read();
    AirQualityData air  = airSensor.read();
    PowerData  pwr  = powerSensor.read();

    NodeStatusPacket pkt;
    pkt.packet_type  = PKT_NODE_STATUS;
    copy_device_id(pkt.node_id, NODE_DEVICE_ID);
    pkt.node_lat     = encode_gps(NODE_LATITUDE);
    pkt.node_lon     = encode_gps(NODE_LONGITUDE);

    pkt.temperature  = env.valid ? static_cast<int16_t>(env.temperature_c * 100.0f) : 0;
    pkt.humidity     = env.valid ? static_cast<uint8_t>(env.humidity_pct)            : 0;
    pkt.pressure     = env.valid ? static_cast<int32_t>(env.pressure_pa)             : 0;
    pkt.air_quality  = air.valid ? air.raw_adc                                       : 0;
    pkt.battery_pct  = pwr.valid ? pwr.battery_pct                                   : 0;
    pkt.timestamp    = 0;   // gateway assigns NTP timestamp

    stamp_checksum(pkt);

    NodeTxResult statusResult = loraTx.sendNodeStatus(pkt);
    DEBUG_LOGF("[NODE] Status TX result=%d  bat=%d%%  airADC=%u\n",
               (int)statusResult, pkt.battery_pct, pkt.air_quality);
}

// ─────────────────────────────────────────────
// initPeripherals()
// ─────────────────────────────────────────────
static void initPeripherals() {
    Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
    Wire.setClock(400000);

    SPI.begin(PIN_SPI_SCK, PIN_SPI_MISO, PIN_SPI_MOSI);

    if (!envSensor.begin())   DEBUG_LOG("[INIT] BME280 FAILED");
    if (!powerSensor.begin()) DEBUG_LOG("[INIT] INA219 FAILED");

    airSensor.begin();   // MQ135 has no fail state — ADC always works

    // LoRa RX must initialise first (sets up SX1278) — TX reuses the same instance
    if (!loraRx.begin())  DEBUG_LOG("[INIT] LoRa RX FAILED");
    if (!loraTx.begin())  DEBUG_LOG("[INIT] LoRa TX FAILED");

    DEBUG_LOG("[INIT] Node peripherals ready");
}