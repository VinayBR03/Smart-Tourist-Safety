#pragma once

#include <stdint.h>
#include <stdbool.h>

static constexpr uint16_t QUEUE_ENDPOINT_LEN = 64;
static constexpr uint16_t QUEUE_JSON_LEN = 512;
static constexpr char QUEUE_FILE_PATH[] = "/queue.bin";
static constexpr char QUEUE_META_PATH[] = "/queue.meta";

struct QueueRecord {
    char endpoint[QUEUE_ENDPOINT_LEN];
    char json[QUEUE_JSON_LEN];
};

static constexpr uint16_t QUEUE_RECORD_SIZE = sizeof(QueueRecord);

struct QueueMeta {
    uint32_t count;
    uint32_t head;
    uint32_t tail;
};

class PacketQueue {
public:
    bool begin();
    bool push(const char* endpoint, const char* json);
    bool peek(QueueRecord& out) const;
    void commit();
    bool pop(QueueRecord& out);
    void clear();

    bool isEmpty() const;
    bool isFull() const;
    uint32_t count() const;

private:
    bool loadMeta();
    bool saveMeta();
    bool ensureFileExists();
    bool readRecord(uint32_t index, QueueRecord& out) const;
    bool writeRecord(uint32_t index, const QueueRecord& rec);

    bool _mounted = false;
    QueueMeta _meta = { 0, 0, 0 };
};