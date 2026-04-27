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
#include "comms/ble_pairing.h"   // always-on BLE server
#include "sos/sos_button.h"
#include "power/battery.h"

// ─────────────────────────────────────────────────────────────────────────────
// Peripheral instances
// ─────────────────────────────────────────────────────────────────────────────
static MAX30102Sensor heartSensor;
static GY91Sensor     imuSensor;
static MLX90614Sensor tempSensor;
static FallDetector   fallDetector;
static LoRaTx         loraTx;
static RFIDScanner    rfidScanner;
static SOSButton      sosButton;
static BatteryMonitor battery;

// ─────────────────────────────────────────────────────────────────────────────
// Loop state
// ─────────────────────────────────────────────────────────────────────────────
static uint32_t lastHealthTxMs       = 0;
static uint32_t lastBatteryNotifyMs  = 0;
static bool     sosActive            = false;
static uint32_t lastSosTxMs          = 0;
static uint8_t  sosRetransmitCount   = 0;

// Wristband has no GPS — node/gateway assigns coordinates and NTP timestamp
static constexpr float    GPS_NO_FIX_LAT  = 0.0f;
static constexpr float    GPS_NO_FIX_LON  = 0.0f;
static constexpr uint32_t TIMESTAMP_UNSET = 0;

static constexpr uint8_t  SOS_MAX_RETRANSMITS    = 5;
static constexpr uint32_t BATTERY_NOTIFY_INTERVAL = 60000UL; // notify battery every 60 s over BLE

// ─────────────────────────────────────────────────────────────────────────────
// Forward declarations
// ─────────────────────────────────────────────────────────────────────────────
static void     handleSOSLoop();
static void     handleHealthCycle();
static void     handleBatteryNotify();
static void     handleRFID();
static void     handleFallDetection();
static uint8_t  buildAlertType(const HeartData& hd, const TemperatureData& td, bool fallDetected);
static void     enterLightSleep(uint32_t durationMs);
static uint32_t healthTxInterval();

// ─────────────────────────────────────────────────────────────────────────────
// setup()
//
// BLE and LoRa both start at boot — no pairing window.
// Architecture:
//   Phone connects → subscribes to HEALTH/SOS/BATTERY notifications
//   Phone writes "1"/"0" to NET char every 10 s
//   "1" → wristband notifies BLE → phone POSTs to backend
//   "0" (or no phone) → wristband TXs via LoRa
// ─────────────────────────────────────────────────────────────────────────────
void setup() {
#ifdef DEBUG_SERIAL
    Serial.begin(115200);
    uint32_t wait = millis();
    while (!Serial && (millis() - wait) < 2000) {}
    Serial.println(F("[WRISTBAND] === Boot ==="));
    Serial.printf("[WRISTBAND] Device ID: %s\n", WRISTBAND_DEVICE_ID);
    Serial.printf("[WRISTBAND] Firmware:  %s\n", FIRMWARE_VERSION);
#endif

    setCpuFrequencyMhz(80);   // ~30 mA saving vs 240 MHz

    // ── I2C bus + sensors
    Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);

    battery.begin();
    sosButton.begin();

    // Initialize MLX90614 FIRST before other libraries mess with the I2C clock
    if (!tempSensor.begin())  DEBUG_LOG("[INIT] MLX90614 FAILED");
    if (!heartSensor.begin()) DEBUG_LOG("[INIT] MAX30102 FAILED");
    if (!imuSensor.begin())   DEBUG_LOG("[INIT] GY-91 FAILED");

    // Force clock to 100kHz AFTER MAX30102/MPU6050 init (which secretly reset it to 400kHz)
    Wire.setClock(100000);

    // ── BLE server — always-on, advertises indefinitely
    // LoRa uses SX1278 at 433/868 MHz; BLE uses 2.4 GHz internal radio.
    // No radio conflict — both can run simultaneously on ESP32.
    ble_server_begin(WRISTBAND_DEVICE_ID);

    // ── SPI bus + LoRa + RFID — start immediately (no deferral needed)
    SPI.begin(PIN_SPI_SCK, PIN_SPI_MISO, PIN_SPI_MOSI);

    if (!loraTx.begin())       DEBUG_LOG("[INIT] LoRa TX FAILED");
    if (!rfidScanner.begin())  DEBUG_LOG("[INIT] RC522 FAILED");

    lastHealthTxMs      = millis();
    lastBatteryNotifyMs = millis();

    DEBUG_LOG("[WRISTBAND] Setup complete — BLE advertising, LoRa ready");
    DEBUG_LOG("[WRISTBAND] Mode: BLE gateway when phone connected+internet, LoRa otherwise");
}

// ─────────────────────────────────────────────────────────────────────────────
// loop()
//
// Single unified loop — no two-phase pairing window.
//
// Routing logic:
//   ┌──────────────────────────────────────────────────────┐
//   │  BLE connected AND phone has internet?               │
//   │     YES → notify health/SOS via BLE (phone uploads) │
//   │     NO  → transmit via LoRa                          │
//   │                                                      │
//   │  SOS: ALWAYS also send via LoRa regardless of BLE   │
//   │  (emergency redundancy — belt + suspenders)          │
//   └──────────────────────────────────────────────────────┘
// ─────────────────────────────────────────────────────────────────────────────
void loop() {
    // ── BLE housekeeping (re-advertising after disconnect, etc.)
    ble_server_update();

    // ── SOS button — runs every iteration for accurate debounce
    sosButton.update();
    if (sosButton.isTriggered() && !sosActive) {
        sosActive          = true;
        lastSosTxMs        = 0;
        sosRetransmitCount = 0;
        DEBUG_LOG("[MAIN] SOS armed");
    }

    // ── SOS active: retransmit on interval (suppresses normal health cycle)
    if (sosActive) {
        handleSOSLoop();
        delay(10);
        return;
    }

    // ── Fall detection (continuous — IMU polled every loop)
    handleFallDetection();

    // ── RFID checkpoint scan (non-blocking)
    handleRFID();

    // ── Health TX on interval
    uint32_t now = millis();
    if ((now - lastHealthTxMs) >= healthTxInterval()) {
        lastHealthTxMs = now;
        handleHealthCycle();
    }

    // ── Periodic battery notification over BLE (60 s)
    if ((millis() - lastBatteryNotifyMs) >= BATTERY_NOTIFY_INTERVAL) {
        lastBatteryNotifyMs = millis();
        handleBatteryNotify();
    }

    // ── Yield for remainder of TX interval
    // NO light sleep at all on ESP32-C3 with BLE:
    //   • When connected: light sleep gates the BLE radio → app loses notifications
    //   • When advertising: sleep blocks advertising packets → phone scanner misses
    //     the device entirely (intermittent discovery, bug #1)
    // Pure delay() in 50 ms slices keeps the radio live and SOS button responsive.
    uint32_t elapsed  = millis() - lastHealthTxMs;
    uint32_t interval = healthTxInterval();
    if (elapsed < interval) {
        uint32_t deadline = millis() + (interval - elapsed);
        while (millis() < deadline) {
            ble_server_update();
            sosButton.update();
            if (sosButton.isTriggered() && !sosActive) {
                sosActive = true; lastSosTxMs = 0; sosRetransmitCount = 0;
            }
            delay(50);
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// handleHealthCycle()
//
// Gateway selection:
//   BLE connected AND phone has internet → BLE notify → phone POSTs to backend
//   Otherwise                            → LoRa TX → gateway node → backend
// ─────────────────────────────────────────────────────────────────────────────
static void handleHealthCycle() {
    HeartData       hd  = heartSensor.read();
    TemperatureData td  = tempSensor.read();
    BatteryData     bat = battery.read();

    float hr   = hd.hr_valid   ? hd.heart_rate  : 0.0f;
    float spo2 = hd.spo2_valid ? hd.spo2        : 0.0f;
    float temp = td.valid      ? td.body_temp_c  : 0.0f;

    bool    isAlert   = false;
    uint8_t alertType = ALERT_NONE;
    uint8_t computed  = buildAlertType(hd, td, fallDetector.isFallDetected());
    if (computed != ALERT_NONE) { isAlert = true; alertType = computed; }

    if (fallDetector.isFallDetected()) fallDetector.reset();

    bool bleConnected = ble_server_is_connected();
    bool phoneOnline  = ble_server_has_internet();

    if (bleConnected) {
        // ── BLE path: always notify phone when connected.
        // Do NOT gate on ble_server_has_internet() — that flag starts false on
        // every new connection and only becomes true after the phone writes the
        // NET characteristic (up to 10 s after connect). Gating caused ALL health
        // data to silently route via LoRa instead of BLE for the first cycle (bug #3).
        // The phone itself decides whether to upload immediately or queue offline.
        ble_server_notify_health(hr, spo2, temp, bat.percentage);

        DEBUG_LOGF("[MAIN] Health → BLE  bat=%d%%  alert=%d  phoneOnline=%d\n",
                   bat.percentage, isAlert, (int)phoneOnline);

        // No internet on phone OR urgent alert → also TX via LoRa as parallel backup
        if (!phoneOnline || isAlert) {
            loraTx.wake();
            loraTx.sendHealth(
                WRISTBAND_DEVICE_ID,
                hr, spo2, temp,
                isAlert, alertType,
                GPS_NO_FIX_LAT, GPS_NO_FIX_LON,
                bat.percentage,
                TIMESTAMP_UNSET
            );
            loraTx.sleep();
            DEBUG_LOG("[MAIN] Health also → LoRa (no internet / alert backup)");
        }
    } else {
        // ── LoRa-only path: no phone connected
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

        DEBUG_LOGF("[MAIN] Health → LoRa  result=%d  bat=%d%%  alert=%d\n",
                   (int)res, bat.percentage, isAlert);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// handleSOSLoop()
//
// SOS routing:
//   Always TX via LoRa (emergency — reliability over everything).
//   Also notify via BLE if phone is connected (faster backend reach).
// ─────────────────────────────────────────────────────────────────────────────
static void handleSOSLoop() {
    uint32_t now = millis();
    if (lastSosTxMs != 0 && (now - lastSosTxMs) < SOS_RETRANSMIT_INTERVAL_MS) return;

    BatteryData bat = battery.read();

    // BLE notify (fast path — phone uploads immediately if internet available)
    if (ble_server_is_connected()) {
        ble_server_notify_sos(bat.percentage);
    }

    // LoRa TX — always, regardless of BLE (redundant emergency path)
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

    DEBUG_LOGF("[MAIN] SOS TX #%d  lora_result=%d  ble=%s\n",
               sosRetransmitCount, (int)res,
               ble_server_is_connected() ? "notified" : "not connected");

    if (sosRetransmitCount >= SOS_MAX_RETRANSMITS) {
        sosActive          = false;
        sosRetransmitCount = 0;
        sosButton.acknowledge();
        DEBUG_LOG("[MAIN] SOS retransmit limit reached — disarming");
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// handleBatteryNotify()
// ─────────────────────────────────────────────────────────────────────────────
static void handleBatteryNotify() {
    if (!ble_server_is_connected()) return;
    BatteryData bat = battery.read();
    ble_server_notify_battery(bat.percentage);
}

// ─────────────────────────────────────────────────────────────────────────────
// handleFallDetection()
// ─────────────────────────────────────────────────────────────────────────────
static void handleFallDetection() {
    MotionData md = imuSensor.readMotion();
    if (!md.valid) return;

    bool newFall = fallDetector.update(md.accel_mag);
    if (newFall) {
        DEBUG_LOG("[MAIN] Fall detected — will include in next health packet");
        // Force immediate TX if within 5 s of the next scheduled one
        if ((millis() - lastHealthTxMs) >= (healthTxInterval() - 5000U)) {
            lastHealthTxMs = 0;
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// handleRFID()
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// buildAlertType()
// Priority: Fall > High HR > Low HR > Low SpO2 > High Temp
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// enterLightSleep()
// GPIO wakeup on SOS button (active LOW) + timer wakeup.
// BLE stack runs on its own FreeRTOS task — light sleep keeps BLE alive
// as long as BLE modem sleep is not forced (default on ESP32 is fine).
// ─────────────────────────────────────────────────────────────────────────────
static void enterLightSleep(uint32_t durationMs) {
    if (durationMs < 100) return;

    gpio_wakeup_enable(static_cast<gpio_num_t>(PIN_SOS_BUTTON), GPIO_INTR_LOW_LEVEL);
    esp_sleep_enable_gpio_wakeup();
    esp_sleep_enable_timer_wakeup(static_cast<uint64_t>(durationMs) * 1000ULL);

    DEBUG_LOGF("[MAIN] Light sleep %ums\n", durationMs);
    esp_light_sleep_start();
    // Execution resumes here after wakeup (BLE connection maintained)
}

// ─────────────────────────────────────────────────────────────────────────────
// healthTxInterval()
// ─────────────────────────────────────────────────────────────────────────────
static uint32_t healthTxInterval() {
    BatteryData bat = battery.read();
    return bat.is_low ? HEALTH_TX_INTERVAL_LOW_BAT_MS : HEALTH_TX_INTERVAL_MS;
}
