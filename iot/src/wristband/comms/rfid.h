#pragma once

#include <stdint.h>
#include <stdbool.h>

// Max bytes in an MFRC522 UID — UID_LEN in packet is 8 to cover all card types
static constexpr uint8_t RFID_MAX_UID_BYTES = 7;

struct RFIDScan {
    char    uid[RFID_MAX_UID_BYTES + 1];  // hex-encoded UID, null-terminated string
    uint8_t uid_raw[RFID_MAX_UID_BYTES];  // raw bytes for packet embedding
    uint8_t uid_len;                      // actual byte count (4, 7, or 10)
    bool    valid;
};

class RFIDScanner {
public:
    // Initialise RC522 over SPI. Returns false if not detected.
    bool begin();

    // Non-blocking poll — returns a filled RFIDScan if a card is present,
    // valid=false if no card or same card as last scan (dedup by UID).
    RFIDScan poll();

    bool isReady() const { return _ready; }

private:
    bool    _ready        = false;
    uint8_t _lastUID[RFID_MAX_UID_BYTES] = { 0 };
    uint8_t _lastUIDLen   = 0;

    // Returns true if the current read matches the last deduped UID
    bool isSameAsLast(const uint8_t* uid, uint8_t len) const;
    void storeLast(const uint8_t* uid, uint8_t len);
};