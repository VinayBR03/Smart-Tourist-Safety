#pragma once

#include <stdint.h>
#include <stdbool.h>
#include "packet_types.h"
#include "../config_node.h"


// One entry in the proximity table — records the last time a wristband
// was heard and its signal strength so the node can report who is nearby.
struct ProximityEntry {
    char     device_id[DEVICE_ID_LEN];
    int8_t   rssi;
    uint32_t last_heard_ms;
    bool     occupied;
};

class MeshRouter {
public:
    MeshRouter() = default;

    // Record a wristband sighting — updates or inserts into proximity table.
    void recordSighting(const char* device_id, int8_t rssi);

    // Build a NodeHeader from this node's identity and the given RSSI.
    // The caller passes the RSSI from the packet that just arrived.
    NodeHeader buildHeader(int8_t rssi) const;

    // Remove stale entries older than MESH_PROXIMITY_TTL_MS.
    // Call once per main loop iteration.
    void evictStale();

    // Returns how many wristbands are currently tracked in the proximity table.
    uint8_t trackedCount() const;

    // True if hop count embedded in the buffer would exceed MESH_MAX_HOP_COUNT.
    // Node prepends its NodeHeader — which counts as one hop — before calling this.
    // We inspect the original wristband packet's packet_type byte to detect
    // already-forwarded frames (those will have a NodeHeader prefix).
    bool wouldExceedMaxHops(uint8_t currentHopCount) const;

private:
    ProximityEntry _table[PROXIMITY_TABLE_SIZE] = {};

    int findEntry(const char* device_id) const;
    int findEmptySlot() const;
    int findOldestEntry() const;
};