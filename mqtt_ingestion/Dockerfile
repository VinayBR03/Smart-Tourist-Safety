FROM golang:1.22-alpine AS builder

RUN apk add --no-cache git ca-certificates tzdata

WORKDIR /build

COPY go.mod go.sum ./
RUN go mod download

COPY main.go ./
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -ldflags="-w -s" -o sentineltour-mqtt-ingestion .

FROM scratch

COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /usr/share/zoneinfo /usr/share/zoneinfo

# Binary name matches what was built above
COPY --from=builder /build/sentineltour-mqtt-ingestion /sentineltour-mqtt-ingestion

ENTRYPOINT ["/sentineltour-mqtt-ingestion"]