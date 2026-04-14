#include <Arduino.h>
#include <Wire.h>
#include <SPI.h>
#include <esp_sleep.h>
#include <esp_pm.h>

#include "config_wristband.h"
#include "config.h"
#include "utils.h"
#include "packet_types.h"

#include "sensors/max30102.h"
#include "sensors/gy91.h"
#include "sensors/mlx90614.h"
#include "sensors/fall_detector.h"
#include "comms/lora_tx.h"
#include "comms/rfid.h"
#include "comms/ble_pairing.h"
#include "sos/sos_button.h"
#include "power/battery.h"

// ─────────────────────────────────────────────
// Peripheral instances
// ─────────────────────────────────────────────
static MAX30102Sensor  heartSensor;
static GY91Sensor      imuSensor;
static MLX90614Sensor  tempSensor;
static FallDetector    fallDetector;
static LoRaTx          loraTx;
static RFIDScanner     rfidScanner;
static SOSButton       sosButton;
static BatteryMonitor  battery;

// ─────────────────────────────────────────────
// Loop state
// ─────────────────────────────────────────────
static uint32_t lastHealthTxMs     = 0;
static bool     sosActive          = false;
static uint32_t lastSosTxMs        = 0;
static bool     _pairingWindowOpen = true;  // true during 60 s BLE window

// No GPS on wristband — node overwrites with its own coords at forward time.
static constexpr float    GPS_NO_FIX_LAT  = 0.0f;
static constexpr float    GPS_NO_FIX_LON  = 0.0f;
static constexpr uint32_t TIMESTAMP_UNSET = 0;  // gateway assigns NTP time

// ─────────────────────────────────────────────
// Forward declarations
// ─────────────────────────────────────────────
static void     initLoRaPeripherals();
static void     handleSOSLoop();
static void     handleHealthTx();
static void     handleRFID();
static void     handleFallDetection();
static uint8_t  buildAlertType(const HeartData& hd, const TemperatureData& td, bool fallDetected);
static void     enterLightSleep(uint32_t durationMs);
static uint32_t healthTxInterval();

// ─────────────────────────────────────────────
// setup()
//
// Boot sequence:
//   Phase 1 — I2C sensors + battery + SOS button (immediate, no conflict with BLE)
//   Phase 2 — BLE advertising begins (60 s pairing window)
//   Phase 3 — After window closes: SPI init, LoRa, RFID (deferred to avoid
//              SPI/BLE conflict on ESP32-C3 during early boot)
// ─────────────────────────────────────────────
void setup() {
#ifdef DEBUG_SERIAL
    Serial.begin(115200);
    uint32_t wait = millis();
    while (!Serial && (millis() - wait) < 2000) {}
    Serial.println(F("[WRISTBAND] === Boot ==="));
    Serial.printf("[WRISTBAND] Device ID: %s\n", WRISTBAND_DEVICE_ID);
    Serial.printf("[WRISTBAND] Firmware:  %s\n", FIRMWARE_VERSION);
#endif

    // Reduce CPU clock during init — saves ~30 mA
    setCpuFrequencyMhz(80);

    // ── Phase 1: I2C peripherals (safe to start before BLE)
    Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
    Wire.setClock(400000);   // 400 kHz fast mode

    battery.begin();   // ADC — no bus conflicts
    sosButton.begin(); // GPIO only

    // ── Sensors on I2C — init now so readings are ready once LoRa starts
    if (!heartSensor.begin()) {
        DEBUG_LOG("[INIT] MAX30102 FAILED — health data will be empty");
    }
    if (!imuSensor.begin()) {
        DEBUG_LOG("[INIT] GY-91 FAILED — motion and altitude unavailable");
    }
    if (!tempSensor.begin()) {
        DEBUG_LOG("[INIT] MLX90614 FAILED — body temp unavailable");
    }

    // ── Phase 2: BLE pairing window
    // Mobile app scans → finds "WB001" (or whatever WRISTBAND_DEVICE_ID is)
    // → connects → reads device_id characteristic → calls POST /devices/{id}/pair
    // Window auto-closes after BLE_PAIRING_WINDOW_MS (60 s) if no connection,
    // or stays open while a BLE client is connected.
    ble_pairing_begin(WRISTBAND_DEVICE_ID);

    // SPI (LoRa + RFID) deferred to after pairing window — see loop()
    lastHealthTxMs = millis();

    DEBUG_LOG("[WRISTBAND] Setup complete — BLE pairing window open");
}

// ─────────────────────────────────────────────
// loop()
//
// Two distinct phases:
//
//   PHASE A — Pairing window (_pairingWindowOpen == true):
//     • BLE advertising active, mobile app can connect and read device_id
//     • SOS button still monitored (safety first)
//     • Fall detection runs (IMU already initialised in setup)
//     • LoRa NOT yet running — SPI not started
//     • Exits when ble_pairing_update() returns false (timeout or explicit stop)
//
//   PHASE B — LoRa operation (_pairingWindowOpen == false):
//     • BLE fully shut down
//     • SPI started, LoRa + RFID running
//     • Normal 30 s health TX cycle with light sleep
// ─────────────────────────────────────────────
void loop() {

    // ══════════════════════════════════════════
    // PHASE A — BLE pairing window
    // ══════════════════════════════════════════
    if (_pairingWindowOpen) {

        // SOS monitoring runs even during pairing — tourist safety first
        sosButton.update();
        if (sosButton.isTriggered() && !sosActive) {
            // SOS pressed during pairing window — arm it.
            // It will fire once LoRa is up (next phase).
            sosActive   = true;
            lastSosTxMs = 0;
            DEBUG_LOG("[MAIN] SOS armed during pairing window — will TX after LoRa init");
        }

        // Fall detection also runs continuously (IMU is up)
        MotionData md = imuSensor.readMotion();
        if (md.valid) {
            fallDetector.update(md.accel_mag);
        }

        // ble_pairing_update() returns false when the window has closed
        bool windowStillOpen = ble_pairing_update();

        if (!windowStillOpen) {
            // ── Transition to LoRa mode
            _pairingWindowOpen = false;

            // Start SPI bus now that BLE is fully deinitialized
            SPI.begin(PIN_SPI_SCK, PIN_SPI_MISO, PIN_SPI_MOSI);

            initLoRaPeripherals();

            // Reset health TX timer so first packet fires after one full interval
            lastHealthTxMs = millis();

            DEBUG_LOG("[MAIN] Pairing window closed — LoRa operational");
        }

        delay(10);   // yield to FreeRTOS BLE tasks during window
        return;
    }

    // ══════════════════════════════════════════
    // PHASE B — Normal LoRa operation
    // ══════════════════════════════════════════

    // ── SOS button: must run every iteration for accurate 50 ms debounce
    sosButton.update();

    if (sosButton.isTriggered() && !sosActive) {
        sosActive   = true;
        lastSosTxMs = 0;
        DEBUG_LOG("[MAIN] SOS armed");
    }

    // ── SOS active: retransmit on interval, suppress normal health cycle
    if (sosActive) {
        handleSOSLoop();
        delay(10);
        return;
    }

    // ── Fall detection (runs every iteration while awake — continuous accel poll)
    handleFallDetection();

    // ── RFID checkpoint scan (non-blocking)
    handleRFID();

    // ── Health TX on 30 s (or 60 s low-battery) interval
    uint32_t now = millis();
    if ((now - lastHealthTxMs) >= healthTxInterval()) {
        lastHealthTxMs = now;
        handleHealthTx();
    }

    // ── Light sleep for remainder of TX interval
    // Capped at 5 s so SOS button and RFID remain responsive.
    uint32_t elapsed  = millis() - lastHealthTxMs;
    uint32_t interval = healthTxInterval();
    if (elapsed < interval) {
        uint32_t sleepMs = interval - elapsed;
        sleepMs = min(sleepMs, 5000UL);
        enterLightSleep(sleepMs);
    }
}

// ─────────────────────────────────────────────
// handleSOSLoop()
//
// Transmits SOS packet immediately on first call (lastSosTxMs == 0),
// then every SOS_RETRANSMIT_INTERVAL_MS (10 s).
// Auto-disarms after SOS_MAX_RETRANSMITS to prevent runaway TX.
// ─────────────────────────────────────────────
static constexpr uint8_t SOS_MAX_RETRANSMITS = 5;
static uint8_t sosRetransmitCount = 0;

static void handleSOSLoop() {
    uint32_t now = millis();

    if (lastSosTxMs == 0 || (now - lastSosTxMs) >= SOS_RETRANSMIT_INTERVAL_MS) {
        BatteryData bat = battery.read();

        loraTx.wake();
        LoRaTxResult res = loraTx.sendSOS(
            WRISTBAND_DEVICE_ID,
            GPS_NO_FIX_LAT,
            GPS_NO_FIX_LON,
            bat.percentage,
            TIMESTAMP_UNSET
        );
        loraTx.sleep();

        lastSosTxMs = now;
        sosRetransmitCount++;

        DEBUG_LOGF("[MAIN] SOS TX #%d result=%d\n", sosRetransmitCount, (int)res);

        if (sosRetransmitCount >= SOS_MAX_RETRANSMITS) {
            sosActive          = false;
            sosRetransmitCount = 0;
            sosButton.acknowledge();
            DEBUG_LOG("[MAIN] SOS retransmit limit reached — disarming");
        }
    }
}

// ─────────────────────────────────────────────
// handleHealthTx()
// ─────────────────────────────────────────────
static void handleHealthTx() {
    DEBUG_LOG("[MAIN] Health TX cycle start");

    HeartData       hd  = heartSensor.read();
    TemperatureData td  = tempSensor.read();
    BatteryData     bat = battery.read();

    // 0.0 signals "no reading" — gateway null-guards before JSON serialization
    float hr   = hd.hr_valid   ? hd.heart_rate  : 0.0f;
    float spo2 = hd.spo2_valid ? hd.spo2        : 0.0f;
    float temp = td.valid      ? td.body_temp_c  : 0.0f;

    bool    isAlert   = false;
    uint8_t alertType = ALERT_NONE;

    uint8_t computed = buildAlertType(hd, td, fallDetector.isFallDetected());
    if (computed != ALERT_NONE) {
        isAlert   = true;
        alertType = computed;
    }

    // Clear fall flag after folding into this packet
    if (fallDetector.isFallDetected()) {
        fallDetector.reset();
    }

    loraTx.wake();
    LoRaTxResult res = loraTx.sendHealth(
        WRISTBAND_DEVICE_ID,
        hr, spo2, temp,
        isAlert, alertType,
        GPS_NO_FIX_LAT, GPS_NO_FIX_LON,
        bat.percentage,
        TIMESTAMP_UNSET
    );
    loraTx.sleep();

    DEBUG_LOGF("[MAIN] Health TX result=%d  bat=%d%%  alert=%d\n",
               (int)res, bat.percentage, isAlert);
}

// ─────────────────────────────────────────────
// handleFallDetection()
// ─────────────────────────────────────────────
static void handleFallDetection() {
    MotionData md = imuSensor.readMotion();
    if (!md.valid) return;

    bool newFall = fallDetector.update(md.accel_mag);

    if (newFall) {
        DEBUG_LOG("[MAIN] Fall detected — will include in next health packet");
        // Force immediate TX if within 5 s of the next scheduled one
        uint32_t sinceLastTx = millis() - lastHealthTxMs;
        if (sinceLastTx >= (healthTxInterval() - 5000U)) {
            lastHealthTxMs = 0;
        }
    }
}

// ─────────────────────────────────────────────
// handleRFID()
// ─────────────────────────────────────────────
static void handleRFID() {
    RFIDScan scan = rfidScanner.poll();
    if (!scan.valid) return;

    loraTx.wake();
    LoRaTxResult res = loraTx.sendRFID(
        WRISTBAND_DEVICE_ID,
        scan.uid,
        TIMESTAMP_UNSET
    );
    loraTx.sleep();

    DEBUG_LOGF("[MAIN] RFID TX uid=%s result=%d\n", scan.uid, (int)res);
}

// ─────────────────────────────────────────────
// buildAlertType()
//
// Priority: Fall > High HR > Low HR > Low SpO2 > High Temp
// ─────────────────────────────────────────────
static uint8_t buildAlertType(const HeartData& hd, const TemperatureData& td, bool fallDetected) {
    if (fallDetected) return ALERT_FALL_DETECTED;

    if (hd.hr_valid) {
        float bpm = hd.heart_rate;
        if (bpm > static_cast<float>(THRESHOLD_HEART_RATE_HIGH)) return ALERT_HIGH_HEART_RATE;
        if (bpm < static_cast<float>(THRESHOLD_HEART_RATE_LOW))  return ALERT_LOW_HEART_RATE;
    }

    if (hd.spo2_valid && hd.spo2 < static_cast<float>(THRESHOLD_SPO2_LOW)) {
        return ALERT_LOW_SPO2;
    }

    if (td.valid && td.body_temp_c > THRESHOLD_BODY_TEMP_HIGH) {
        return ALERT_HIGH_TEMP;
    }

    return ALERT_NONE;
}

// ─────────────────────────────────────────────
// enterLightSleep()
//
// GPIO wakeup on SOS button (active LOW) + timer wakeup.
// ─────────────────────────────────────────────
static void enterLightSleep(uint32_t durationMs) {
    if (durationMs < 100) return;

    gpio_wakeup_enable(static_cast<gpio_num_t>(PIN_SOS_BUTTON), GPIO_INTR_LOW_LEVEL);
    esp_sleep_enable_gpio_wakeup();
    esp_sleep_enable_timer_wakeup(static_cast<uint64_t>(durationMs) * 1000ULL);

    DEBUG_LOGF("[MAIN] Light sleep %ums\n", durationMs);
    esp_light_sleep_start();
    // Execution resumes here after wakeup
}

// ─────────────────────────────────────────────
// healthTxInterval()
// ─────────────────────────────────────────────
static uint32_t healthTxInterval() {
    BatteryData bat = battery.read();
    return bat.is_low ? HEALTH_TX_INTERVAL_LOW_BAT_MS : HEALTH_TX_INTERVAL_MS;
}

// ─────────────────────────────────────────────
// initLoRaPeripherals()
//
// Called AFTER BLE pairing window closes and SPI.begin() has been called.
// Only inits SPI-dependent peripherals (LoRa, RFID).
// I2C sensors and battery are already up from setup().
// ─────────────────────────────────────────────
static void initLoRaPeripherals() {
    if (!loraTx.begin()) {
        DEBUG_LOG("[INIT] LoRa TX FAILED — no transmissions possible");
    }

    if (!rfidScanner.begin()) {
        DEBUG_LOG("[INIT] RC522 FAILED — checkpoint scanning disabled");
    }

    DEBUG_LOG("[INIT] LoRa peripherals ready");
}