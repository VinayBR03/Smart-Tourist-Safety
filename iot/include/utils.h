#pragma once

#include <stdint.h>
#include <stddef.h>
#include <string.h>

// ─────────────────────────────────────────────
// XOR checksum
// Computes XOR of every byte in `data` up to `len` bytes.
// The last byte of every packet is this checksum — receiver
// recomputes and compares before processing.
// ─────────────────────────────────────────────
inline uint8_t compute_checksum(const uint8_t* data, size_t len) {
    uint8_t result = 0;
    for (size_t i = 0; i < len; i++) {
        result ^= data[i];
    }
    return result;
}

// Convenience: compute checksum over a struct (excluding its last byte, which IS the checksum)
template <typename T>
inline uint8_t compute_packet_checksum(const T& pkt) {
    // All packet structs store checksum as the very last byte.
    // We XOR everything except the final byte.
    const uint8_t* raw = reinterpret_cast<const uint8_t*>(&pkt);
    return compute_checksum(raw, sizeof(T) - 1);
}

// Writes checksum into the last byte of a packet struct in-place
template <typename T>
inline void stamp_checksum(T& pkt) {
    uint8_t* raw = reinterpret_cast<uint8_t*>(&pkt);
    raw[sizeof(T) - 1] = compute_checksum(raw, sizeof(T) - 1);
}

// Returns true if the packet's embedded checksum matches a fresh computation
template <typename T>
inline bool validate_checksum(const T& pkt) {
    const uint8_t* raw = reinterpret_cast<const uint8_t*>(&pkt);
    uint8_t expected = compute_checksum(raw, sizeof(T) - 1);
    return raw[sizeof(T) - 1] == expected;
}

// ─────────────────────────────────────────────
// GPS encoding helpers
// ─────────────────────────────────────────────

// Encode float degrees → int32_t × 1e7
inline int32_t encode_gps(float degrees) {
    return static_cast<int32_t>(degrees * 10000000.0f);
}

// Decode int32_t × 1e7 → float degrees
inline float decode_gps(int32_t encoded) {
    return static_cast<float>(encoded) / 10000000.0f;
}

// ─────────────────────────────────────────────
// Sensor value encoding helpers
// ─────────────────────────────────────────────

// Heart rate: float bpm → int16_t (× 10)
inline int16_t encode_heart_rate(float bpm) {
    return static_cast<int16_t>(bpm * 10.0f);
}

inline float decode_heart_rate(int16_t encoded) {
    return static_cast<float>(encoded) / 10.0f;
}

// Body temperature: float °C → int16_t (× 100)
inline int16_t encode_body_temp(float celsius) {
    return static_cast<int16_t>(celsius * 100.0f);
}

inline float decode_body_temp(int16_t encoded) {
    return static_cast<float>(encoded) / 100.0f;
}

// ─────────────────────────────────────────────
// Device ID helpers
// ─────────────────────────────────────────────

// Safely copy a device ID string into a fixed-size char array (always null-terminates)
template <size_t N>
inline void copy_device_id(char (&dest)[N], const char* src) {
    strncpy(dest, src, N - 1);
    dest[N - 1] = '\0';
}

// ─────────────────────────────────────────────
// Debug logging — compiled out in production builds
// Usage: DEBUG_LOG("sensor read failed")
// ─────────────────────────────────────────────
#ifdef DEBUG_SERIAL
    #define DEBUG_LOG(msg)        Serial.println(F(msg))
    #define DEBUG_LOGF(fmt, ...)  Serial.printf(fmt, __VA_ARGS__)
#else
    #define DEBUG_LOG(msg)        do {} while (0)
    #define DEBUG_LOGF(fmt, ...)  do {} while (0)
#endif