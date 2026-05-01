FROM golang:1.22-bookworm AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    git ca-certificates tzdata \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

COPY go.mod go.sum ./
RUN go mod download

COPY main.go ./

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -ldflags="-w -s" -o sentineltour-mqtt-ingestion .

# ─────────────────────────────────────────
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates tzdata \
    && rm -rf /var/lib/apt/lists/*

# FIX #7: run as non-root user
RUN groupadd --gid 1001 mqttgroup && \
    useradd  --uid 1001 --gid mqttgroup --no-create-home mqttuser

COPY --from=builder /build/sentineltour-mqtt-ingestion /sentineltour-mqtt-ingestion

USER mqttuser

# FIX #8: healthcheck — process alive check (no curl in distroless-like image)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD pgrep -x sentineltour-mqtt-ingestion > /dev/null || exit 1

ENTRYPOINT ["/sentineltour-mqtt-ingestion"]
