#pragma once

#include <stdint.h>
#include <stdbool.h>
#include "packet_types.h"

// All build* functions write a null-terminated JSON string into `out`.
// Pass nullptr for recordedAt to omit the field (only valid before NTP sync).
class PayloadBuilder {
public:
    // POST /iot/health — from a HealthPacket forwarded by a node
    bool buildHealth(
        const HealthPacket& pkt,
        const NodeHeader&   nodeHdr,
        const char*         recordedAt,
        char*               out,
        uint16_t            outLen
    );

    // POST /iot/health — from an SOSPacket (alert_type = "SOS")
    bool buildSOSHealth(
        const SOSPacket&  pkt,
        const NodeHeader& nodeHdr,
        const char*       recordedAt,
        char*             out,
        uint16_t          outLen
    );

    // POST /iot/location — generic location event
    bool buildLocation(
        const char* device_id,
        float       latitude,
        float       longitude,
        float       rssi,
        bool        sos_flag,
        const char* recordedAt,
        char*       out,
        uint16_t    outLen
    );

    // POST /iot/location — from an RFID checkpoint scan
    bool buildRFIDLocation(
        const RFIDPacket& pkt,
        const NodeHeader& nodeHdr,
        const char*       recordedAt,
        char*             out,
        uint16_t          outLen
    );

    // POST /iot/heartbeat — gateway reporting its own status
    bool buildHeartbeat(
        float    battery_percentage,
        float    battery_voltage_mv,
        char*    out,
        uint16_t outLen
    );

    // Returns the backend alert_type string for an ALERT_* byte.
    // Returns nullptr for ALERT_NONE or unknown values.
    static const char* alertTypeToString(uint8_t alertType);

    // Write current UTC ISO 8601 timestamp into buf ("2025-03-30T10:15:00Z").
    // Returns false if NTP has not yet synced.
    static bool currentTimestamp(char* buf, uint8_t bufLen);

    // Returns true if the system clock is NTP-synced.
    static bool isNtpSynced();
};