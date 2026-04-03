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
static uint32_t lastHealthTxMs   = 0;
static bool     sosActive        = false;   // true while SOS retransmit loop is running
static uint32_t lastSosTxMs      = 0;

// Placeholder GPS — wristband has no GPS; node assigns coordinates at forward time.
// We still include a lat/lon field in the packet set to a sentinel (0,0) so the
// struct is fully defined. The node overwrites this with its own hardcoded coordinates.
static constexpr float GPS_NO_FIX_LAT = 0.0f;
static constexpr float GPS_NO_FIX_LON = 0.0f;

// Wristband has no RTC — timestamp 0 means "assign at gateway via NTP"
static constexpr uint32_t TIMESTAMP_UNSET = 0;

// ─────────────────────────────────────────────
// Forward declarations
// ─────────────────────────────────────────────
static void     initPeripherals();
static void     handleSOSLoop();
static void     handleHealthTx();
static void     handleRFID();
static void     handleFallDetection();
static uint8_t  buildAlertType(const HeartData& hd, const TemperatureData& td, bool fallDetected);
static void     enterLightSleep(uint32_t durationMs);
static uint32_t healthTxInterval();

// ─────────────────────────────────────────────
// setup()
// ─────────────────────────────────────────────
void setup() {
#ifdef DEBUG_SERIAL
    Serial.begin(115200);
    // Wait up to 2 seconds for USB serial to connect (dev only)
    uint32_t wait = millis();
    while (!Serial && (millis() - wait) < 2000) {}
    Serial.println(F("[WRISTBAND] === Boot ==="));
    Serial.printf("[WRISTBAND] Device ID: %s\n", WRISTBAND_DEVICE_ID);
    Serial.printf("[WRISTBAND] Firmware:  %s\n", FIRMWARE_VERSION);
#endif

    // Reduce CPU clock during init — saves ~30 mA
    setCpuFrequencyMhz(80);

    initPeripherals();

    // Prime the health TX timer so first transmission fires after one full interval
    lastHealthTxMs = millis();

    DEBUG_LOG("[WRISTBAND] Setup complete");
}

// ─────────────────────────────────────────────
// loop()
//
// Priority order:
//   1. SOS button update (must run every iteration for debounce accuracy)
//   2. If SOS active — retransmit on interval until acknowledged
//   3. Fall detection (MPU9250 continuous polling)
//   4. RFID checkpoint scan (non-blocking poll)
//   5. Health TX on 30-second (or 60-second low-battery) interval
//   6. Light sleep for remainder of interval
// ─────────────────────────────────────────────
void loop() {
    sosButton.update();

    // ── SOS has highest priority — immediately arm on trigger
    if (sosButton.isTriggered() && !sosActive) {
        sosActive  = true;
        lastSosTxMs = 0;    // force immediate first transmission
        DEBUG_LOG("[MAIN] SOS armed");
    }

    if (sosActive) {
        handleSOSLoop();
        // SOS loop consumes this iteration — skip normal sensor cycle
        delay(10);
        return;
    }

    // ── Fall detection runs on every iteration (no sleep) when awake
    handleFallDetection();

    // ── RFID non-blocking poll
    handleRFID();

    // ── Health TX on interval
    uint32_t now = millis();
    if ((now - lastHealthTxMs) >= healthTxInterval()) {
        lastHealthTxMs = now;
        handleHealthTx();
    }

    // ── Light sleep for the remainder of the transmission interval.
    // The ESP32-C3 timer wakeup fires after the sleep duration. We use the
    // SOS button GPIO wakeup to also be able to wake from sleep on button press.
    uint32_t elapsed = millis() - lastHealthTxMs;
    uint32_t interval = healthTxInterval();
    if (elapsed < interval) {
        uint32_t sleepMs = interval - elapsed;
        // Cap at 5 seconds so SOS button and RFID remain responsive
        sleepMs = min(sleepMs, 5000UL);
        enterLightSleep(sleepMs);
    }
}

// ─────────────────────────────────────────────
// handleSOSLoop()
//
// While sosActive:
//   - Transmit SOS packet immediately (lastSosTxMs == 0 on first call)
//   - Retransmit every SOS_RETRANSMIT_INTERVAL_MS (10 s)
//   - The button must be pressed again (a separate re-arm cycle) to re-trigger;
//     we auto-clear sosActive after 5 retransmissions to prevent runaway TX.
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
//
// Reads all sensors, evaluates alert thresholds, assembles and transmits
// a HealthPacket. Called once per transmission interval.
// ─────────────────────────────────────────────
static void handleHealthTx() {
    DEBUG_LOG("[MAIN] Health TX cycle start");

    // ── Read sensors
    HeartData        hd  = heartSensor.read();
    TemperatureData  td  = tempSensor.read();
    BatteryData      bat = battery.read();

    // Use 0 for invalid readings — gateway/backend will tolerate one missing field
    float hr   = hd.hr_valid   ? hd.heart_rate    : 0.0f;
    float spo2 = hd.spo2_valid ? hd.spo2          : 0.0f;
    float temp = td.valid      ? td.body_temp_c    : 0.0f;

    // ── Evaluate alert thresholds
    bool    isAlert   = false;
    uint8_t alertType = ALERT_NONE;

    uint8_t computed = buildAlertType(hd, td, fallDetector.isFallDetected());
    if (computed != ALERT_NONE) {
        isAlert   = true;
        alertType = computed;
    }

    // Clear fall flag after it's been folded into this packet
    if (fallDetector.isFallDetected()) {
        fallDetector.reset();
    }

    // ── Transmit
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
//
// Feeds fresh MPU9250 accel magnitude to the detector every loop iteration.
// Falls do NOT interrupt the normal health packet — the flag is folded into
// the next scheduled health packet, EXCEPT when SOS is simultaneously active.
// A fall that co-occurs with SOS is fine — the SOS packet covers the event.
// ─────────────────────────────────────────────
static void handleFallDetection() {
    MotionData md = imuSensor.readMotion();
    if (!md.valid) return;

    bool newFall = fallDetector.update(md.accel_mag);

    if (newFall) {
        DEBUG_LOG("[MAIN] Fall detected — will include in next health packet");
        // If we're close to the next health TX (within 5 s), fire immediately
        uint32_t sinceLastTx = millis() - lastHealthTxMs;
        if (sinceLastTx >= (healthTxInterval() - 5000U)) {
            lastHealthTxMs = 0;   // force immediate TX next iteration
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
// Priority: SOS > Fall > High HR > Low HR > Low SpO2 > High Temp
// Only the highest-priority alert is reported per packet.
// Multiple simultaneous conditions are logged but only the top one is sent.
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
// Configures GPIO wakeup on SOS button (active LOW) alongside timer wakeup
// so an SOS press during sleep immediately wakes the CPU.
// RFID and LoRa are interrupt-free on the wristband — we accept up to 5 s
// of sleep latency for those events.
// ─────────────────────────────────────────────
static void enterLightSleep(uint32_t durationMs) {
    if (durationMs < 100) return;  // not worth the wakeup overhead

    // GPIO wakeup: wake if SOS button goes LOW
    gpio_wakeup_enable(static_cast<gpio_num_t>(PIN_SOS_BUTTON), GPIO_INTR_LOW_LEVEL);
    esp_sleep_enable_gpio_wakeup();

    // Timer wakeup
    esp_sleep_enable_timer_wakeup(static_cast<uint64_t>(durationMs) * 1000ULL); // µs

    DEBUG_LOGF("[MAIN] Light sleep %ums\n", durationMs);
    esp_light_sleep_start();
    // Execution resumes here after wakeup
}

// ─────────────────────────────────────────────
// healthTxInterval()
// Returns the appropriate TX interval based on current battery level
// ─────────────────────────────────────────────
static uint32_t healthTxInterval() {
    BatteryData bat = battery.read();
    return bat.is_low ? HEALTH_TX_INTERVAL_LOW_BAT_MS : HEALTH_TX_INTERVAL_MS;
}

// ─────────────────────────────────────────────
// initPeripherals()
// ─────────────────────────────────────────────
static void initPeripherals() {
    // ── I2C — shared bus for all sensors
    Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
    Wire.setClock(400000);   // 400 kHz fast mode

    // ── SPI — shared bus for LoRa + RFID (different CS pins)
    SPI.begin(PIN_SPI_SCK, PIN_SPI_MISO, PIN_SPI_MOSI);

    // ── Battery monitor — first, so we know initial battery state
    battery.begin();

    // ── Sensors
    if (!heartSensor.begin()) {
        DEBUG_LOG("[INIT] MAX30102 FAILED — health data will be empty");
    }
    if (!imuSensor.begin()) {
        DEBUG_LOG("[INIT] GY-91 FAILED — motion and altitude unavailable");
    }
    if (!tempSensor.begin()) {
        DEBUG_LOG("[INIT] MLX90614 FAILED — body temp unavailable");
    }

    // ── LoRa TX — critical: log error but continue (wristband still useful with degraded comms)
    if (!loraTx.begin()) {
        DEBUG_LOG("[INIT] LoRa TX FAILED — no transmissions possible");
    }

    // ── RFID
    if (!rfidScanner.begin()) {
        DEBUG_LOG("[INIT] RC522 FAILED — checkpoint scanning disabled");
    }

    // ── SOS button — no failure mode; it's just a GPIO input
    sosButton.begin();

    DEBUG_LOG("[INIT] Peripheral init complete");
}