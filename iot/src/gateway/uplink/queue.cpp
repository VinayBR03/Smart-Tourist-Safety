#include "queue.h"

#include <Arduino.h>
#include <SPIFFS.h>

#include "config.h"
#include "../config_gateway.h"
#include "utils.h"

// ─────────────────────────────────────────────
// begin()
// ─────────────────────────────────────────────
bool PacketQueue::begin() {
    if (!SPIFFS.begin(true)) {   // true = format on first mount failure
        DEBUG_LOG("[QUEUE] SPIFFS mount failed");
        _mounted = false;
        return false;
    }
    _mounted = true;

    if (!loadMeta()) {
        _meta = { 0, 0, 0 };
        saveMeta();
        DEBUG_LOG("[QUEUE] Fresh queue initialised");
    } else {
        DEBUG_LOGF("[QUEUE] Loaded: count=%u head=%u tail=%u\n",
                   _meta.count, _meta.head, _meta.tail);
    }
    return true;
}

// ─────────────────────────────────────────────
// push()
// ─────────────────────────────────────────────
bool PacketQueue::push(const char* endpoint, const char* json) {
    if (!_mounted) return false;

    if (!ensureFileExists()) return false;

    QueueRecord rec;
    memset(&rec, 0, sizeof(rec));
    strncpy(rec.endpoint, endpoint, QUEUE_ENDPOINT_LEN - 1);
    strncpy(rec.json,     json,     QUEUE_JSON_LEN - 1);

    uint32_t writeIdx = _meta.tail % GATEWAY_QUEUE_MAX_PACKETS;

    if (!writeRecord(writeIdx, rec)) {
        DEBUG_LOG("[QUEUE] Write record failed");
        return false;
    }

    _meta.tail = (_meta.tail + 1) % GATEWAY_QUEUE_MAX_PACKETS;

    if (_meta.count < GATEWAY_QUEUE_MAX_PACKETS) {
        _meta.count++;
    } else {
        // Full — silently drop oldest by advancing head
        _meta.head = (_meta.head + 1) % GATEWAY_QUEUE_MAX_PACKETS;
        DEBUG_LOG("[QUEUE] Full — oldest packet dropped");
    }

    saveMeta();
    DEBUG_LOGF("[QUEUE] Pushed. count=%u\n", _meta.count);
    return true;
}

// ─────────────────────────────────────────────
// peek()
// ─────────────────────────────────────────────
bool PacketQueue::peek(QueueRecord& out) const {
    if (!_mounted || _meta.count == 0) return false;
    uint32_t readIdx = _meta.head % GATEWAY_QUEUE_MAX_PACKETS;
    return readRecord(readIdx, out);
}

// ─────────────────────────────────────────────
// commit()
// ─────────────────────────────────────────────
void PacketQueue::commit() {
    if (_meta.count == 0) return;
    _meta.head = (_meta.head + 1) % GATEWAY_QUEUE_MAX_PACKETS;
    _meta.count--;
    saveMeta();
    DEBUG_LOGF("[QUEUE] Committed. count=%u\n", _meta.count);
}

// ─────────────────────────────────────────────
// pop()
// ─────────────────────────────────────────────
bool PacketQueue::pop(QueueRecord& out) {
    if (!peek(out)) return false;
    commit();
    return true;
}

// ─────────────────────────────────────────────
// clear()
// ─────────────────────────────────────────────
void PacketQueue::clear() {
    _meta = { 0, 0, 0 };
    saveMeta();
    SPIFFS.remove(QUEUE_FILE_PATH);
    DEBUG_LOG("[QUEUE] Cleared");
}

// ─────────────────────────────────────────────
// loadMeta()
// ─────────────────────────────────────────────
bool PacketQueue::loadMeta() {
    File f = SPIFFS.open(QUEUE_META_PATH, FILE_READ);
    if (!f) return false;

    bool ok = (f.read(reinterpret_cast<uint8_t*>(&_meta), sizeof(QueueMeta))
               == sizeof(QueueMeta));
    f.close();

    if (!ok || _meta.count > GATEWAY_QUEUE_MAX_PACKETS) {
        DEBUG_LOG("[QUEUE] Meta corrupt — reinitialising");
        return false;
    }
    return true;
}

// ─────────────────────────────────────────────
// saveMeta()
// ─────────────────────────────────────────────
bool PacketQueue::saveMeta() {
    File f = SPIFFS.open(QUEUE_META_PATH, FILE_WRITE);
    if (!f) return false;
    f.write(reinterpret_cast<const uint8_t*>(&_meta), sizeof(QueueMeta));
    f.close();
    return true;
}

// ─────────────────────────────────────────────
// ensureFileExists()
// Pre-allocates q.bin with zeros on first use.
// 200 records × 512 bytes = 100 KB — takes ~1-2 s, happens only once.
// ─────────────────────────────────────────────
bool PacketQueue::ensureFileExists() {
    if (SPIFFS.exists(QUEUE_FILE_PATH)) return true;

    DEBUG_LOG("[QUEUE] Pre-allocating queue file...");
    File f = SPIFFS.open(QUEUE_FILE_PATH, FILE_WRITE);
    if (!f) return false;

    uint8_t zeroBuf[QUEUE_RECORD_SIZE] = { 0 };
    for (uint32_t i = 0; i < GATEWAY_QUEUE_MAX_PACKETS; i++) {
        f.write(zeroBuf, QUEUE_RECORD_SIZE);
    }
    f.close();
    DEBUG_LOG("[QUEUE] Pre-allocation done");
    return true;
}

// ─────────────────────────────────────────────
// readRecord()
// ─────────────────────────────────────────────
bool PacketQueue::readRecord(uint32_t index, QueueRecord& out) const {
    File f = SPIFFS.open(QUEUE_FILE_PATH, FILE_READ);
    if (!f) return false;

    bool ok = false;
    if (f.seek(index * QUEUE_RECORD_SIZE)) {
        ok = (f.read(reinterpret_cast<uint8_t*>(&out), QUEUE_RECORD_SIZE)
              == QUEUE_RECORD_SIZE);
    }
    f.close();
    return ok;
}

// ─────────────────────────────────────────────
// writeRecord()
// Opens in "r+" (read-write, no truncate) to overwrite a single slot.
// ─────────────────────────────────────────────
bool PacketQueue::writeRecord(uint32_t index, const QueueRecord& rec) {
    File f = SPIFFS.open(QUEUE_FILE_PATH, "r+");
    if (!f) return false;

    bool ok = false;
    if (f.seek(index * QUEUE_RECORD_SIZE)) {
        ok = (f.write(reinterpret_cast<const uint8_t*>(&rec), QUEUE_RECORD_SIZE)
              == QUEUE_RECORD_SIZE);
    }
    f.close();
    return ok;
}

bool PacketQueue::isEmpty() const {
    return _meta.count == 0;
}

bool PacketQueue::isFull() const {
    return _meta.count >= GATEWAY_QUEUE_MAX_PACKETS;
}

uint32_t PacketQueue::count() const {
    return _meta.count;
}