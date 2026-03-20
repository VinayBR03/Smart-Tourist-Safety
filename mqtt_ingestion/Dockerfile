# ─────────────────────────────────────────────
# Stage 1: Build
# ─────────────────────────────────────────────
FROM golang:1.22-alpine AS builder

# Required for go mod download (git) and TLS (ca-certificates)
RUN apk add --no-cache git ca-certificates tzdata

WORKDIR /build

# Cache dependencies before copying source
COPY go.mod go.sum ./
RUN go mod download

# Copy source and build
COPY main.go ./
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -ldflags="-w -s" -o sentineltour-mqtt-ingestion .

# ─────────────────────────────────────────────
# Stage 2: Runtime
# ─────────────────────────────────────────────
FROM scratch

# CA certs for TLS MQTT / Kafka connections
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /usr/share/zoneinfo /usr/share/zoneinfo

# Binary only — final image is ~8MB
COPY --from=builder /build/sentineltour-mqtt-ingestion /crowdguard-mqtt-ingestion

ENTRYPOINT ["/sentineltour-mqtt-ingestion"]