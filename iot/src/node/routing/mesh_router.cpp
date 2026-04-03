#include "mesh_router.h"

#include <Arduino.h>
#include <string.h>

#include "../config_node.h"
#include "utils.h"

// ─────────────────────────────────────────────
// recordSighting()
// ─────────────────────────────────────────────
void MeshRouter::recordSighting(const char* device_id, int8_t rssi) {
    int idx = findEntry(device_id);

    if (idx >= 0) {
        // Update existing entry
        _table[idx].rssi          = rssi;
        _table[idx].last_heard_ms = millis();
        DEBUG_LOGF("[ROUTER] Updated %s RSSI=%d\n", device_id, rssi);
    } else {
        // Insert into a free slot, or evict oldest if full
        int slot = findEmptySlot();
        if (slot < 0) {
            slot = findOldestEntry();
            DEBUG_LOGF("[ROUTER] Table full — evicting oldest for %s\n", device_id);
        }
        if (slot >= 0) {
            copy_device_id(_table[slot].device_id, device_id);
            _table[slot].rssi          = rssi;
            _table[slot].last_heard_ms = millis();
            _table[slot].occupied      = true;
            DEBUG_LOGF("[ROUTER] New sighting %s RSSI=%d slot=%d\n", device_id, rssi, slot);
        }
    }
}

// ─────────────────────────────────────────────
// buildHeader()
// ─────────────────────────────────────────────
NodeHeader MeshRouter::buildHeader(int8_t rssi) const {
    NodeHeader hdr;
    memset(&hdr, 0, sizeof(hdr));
    copy_device_id(hdr.node_id, NODE_DEVICE_ID);
    hdr.node_lat = encode_gps(NODE_LATITUDE);
    hdr.node_lon = encode_gps(NODE_LONGITUDE);
    hdr.rssi     = rssi;
    return hdr;
}

// ─────────────────────────────────────────────
// evictStale()
// ─────────────────────────────────────────────
void MeshRouter::evictStale() {
    uint32_t now = millis();
    for (uint8_t i = 0; i < PROXIMITY_TABLE_SIZE; i++) {
        if (_table[i].occupied) {
            if ((now - _table[i].last_heard_ms) > MESH_PROXIMITY_TTL_MS) {
                DEBUG_LOGF("[ROUTER] Evicting stale entry %s\n", _table[i].device_id);
                _table[i].occupied = false;
                memset(_table[i].device_id, 0, DEVICE_ID_LEN);
            }
        }
    }
}

// ─────────────────────────────────────────────
// trackedCount()
// ─────────────────────────────────────────────
uint8_t MeshRouter::trackedCount() const {
    uint8_t count = 0;
    for (uint8_t i = 0; i < PROXIMITY_TABLE_SIZE; i++) {
        if (_table[i].occupied) count++;
    }
    return count;
}

// ─────────────────────────────────────────────
// wouldExceedMaxHops()
// ─────────────────────────────────────────────
bool MeshRouter::wouldExceedMaxHops(uint8_t currentHopCount) const {
    return (currentHopCount + 1) > MESH_MAX_HOP_COUNT;
}

// ─────────────────────────────────────────────
// Private helpers
// ─────────────────────────────────────────────
int MeshRouter::findEntry(const char* device_id) const {
    for (uint8_t i = 0; i < PROXIMITY_TABLE_SIZE; i++) {
        if (_table[i].occupied &&
            strncmp(_table[i].device_id, device_id, DEVICE_ID_LEN) == 0) {
            return i;
        }
    }
    return -1;
}

int MeshRouter::findEmptySlot() const {
    for (uint8_t i = 0; i < PROXIMITY_TABLE_SIZE; i++) {
        if (!_table[i].occupied) return i;
    }
    return -1;
}

int MeshRouter::findOldestEntry() const {
    int      oldest    = -1;
    uint32_t oldestMs  = UINT32_MAX;
    for (uint8_t i = 0; i < PROXIMITY_TABLE_SIZE; i++) {
        if (_table[i].occupied && _table[i].last_heard_ms < oldestMs) {
            oldest   = i;
            oldestMs = _table[i].last_heard_ms;
        }
    }
    return oldest;
}