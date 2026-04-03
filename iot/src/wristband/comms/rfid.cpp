#include "rfid.h"

#include <Arduino.h>
#include <SPI.h>
#include <MFRC522.h>

#include "../config_wristband.h"
#include "utils.h"

static MFRC522 mfrc522;

// Minimum gap between two scans of the SAME tag (ms) — prevents repeated events
// when a tag sits on the reader for multiple loop cycles
static constexpr uint32_t RFID_SAME_TAG_COOLDOWN_MS = 3000;
static uint32_t lastScanTime = 0;

// ─────────────────────────────────────────────
// begin()
// ─────────────────────────────────────────────
bool RFIDScanner::begin() {
    mfrc522.PCD_Init(PIN_RFID_SS, PIN_RFID_RST);

    // Self-test: read firmware version register — 0x00 or 0xFF means dead
    byte version = mfrc522.PCD_ReadRegister(MFRC522::VersionReg);
    if (version == 0x00 || version == 0xFF) {
        DEBUG_LOGF("[RFID] Not found — VersionReg=0x%02X\n", version);
        _ready = false;
        return false;
    }

    _ready = true;
    DEBUG_LOGF("[RFID] RC522 ready, firmware 0x%02X\n", version);
    return true;
}

// ─────────────────────────────────────────────
// poll()
// ─────────────────────────────────────────────
RFIDScan RFIDScanner::poll() {
    RFIDScan result;
    result.uid_len = 0;
    result.valid   = false;
    memset(result.uid,     0, sizeof(result.uid));
    memset(result.uid_raw, 0, sizeof(result.uid_raw));

    if (!_ready) return result;

    // No card present in the field — most common case, return fast
    if (!mfrc522.PICC_IsNewCardPresent()) return result;

    // Card present but UID read failed (noise, partial swipe)
    if (!mfrc522.PICC_ReadCardSerial()) return result;

    uint8_t len = mfrc522.uid.size;
    if (len == 0 || len > RFID_MAX_UID_BYTES) {
        mfrc522.PICC_HaltA();
        return result;
    }

    // Cooldown dedup: same UID within RFID_SAME_TAG_COOLDOWN_MS → skip
    uint32_t now = millis();
    if (isSameAsLast(mfrc522.uid.uidByte, len) &&
        (now - lastScanTime) < RFID_SAME_TAG_COOLDOWN_MS) {
        mfrc522.PICC_HaltA();
        return result;
    }

    // Valid new scan — populate result
    storeLast(mfrc522.uid.uidByte, len);
    lastScanTime = now;

    result.uid_len = len;
    memcpy(result.uid_raw, mfrc522.uid.uidByte, len);

    // Build human-readable hex string for debug
    for (uint8_t i = 0; i < len && i < RFID_MAX_UID_BYTES; i++) {
        snprintf(result.uid + (i * 2), 3, "%02X", mfrc522.uid.uidByte[i]);
    }
    result.valid = true;

    mfrc522.PICC_HaltA();         // halt card — prevents repeated reads in same RF field
    mfrc522.PCD_StopCrypto1();    // required for MIFARE cards after authenticated access

    DEBUG_LOGF("[RFID] Tag scanned: %s (%d bytes)\n", result.uid, len);
    return result;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
bool RFIDScanner::isSameAsLast(const uint8_t* uid, uint8_t len) const {
    if (len != _lastUIDLen) return false;
    return memcmp(uid, _lastUID, len) == 0;
}

void RFIDScanner::storeLast(const uint8_t* uid, uint8_t len) {
    _lastUIDLen = len;
    memcpy(_lastUID, uid, len);
}