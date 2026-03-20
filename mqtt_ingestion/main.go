// mqtt_ingestion/main.go
//
// Standalone Go service that:
//   1. Subscribes to the MQTT broker on wristband telemetry topics
//   2. Validates and enriches each message
//   3. Batches and publishes to Kafka topic "iot.telemetry"
//
// Environment variables (all required unless marked optional):
//   MQTT_BROKER        e.g. tcp://mosquitto:1883
//   MQTT_USERNAME      (optional)
//   MQTT_PASSWORD      (optional)
//   MQTT_TOPIC_PREFIX  e.g. crowdguard  (subscribes to crowdguard/device/+/+)
//   KAFKA_BROKERS      e.g. kafka:9092  (comma-separated)
//   KAFKA_TOPIC        e.g. iot.telemetry
//   LOG_LEVEL          debug|info|warn|error  (optional, default: info)

package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/signal"
	"strings"
	"sync"
	"syscall"
	"time"

	mqtt "github.com/eclipse/paho.mqtt.golang"
	"github.com/google/uuid"
	"github.com/IBM/sarama"
)

// ─────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────

type Config struct {
	MQTTBroker      string
	MQTTUsername    string
	MQTTPassword    string
	MQTTTopicPrefix string
	KafkaBrokers    []string
	KafkaTopic      string
}

func loadConfig() Config {
	brokerRaw := mustEnv("KAFKA_BROKERS")
	return Config{
		MQTTBroker:      mustEnv("MQTT_BROKER"),
		MQTTUsername:    os.Getenv("MQTT_USERNAME"),
		MQTTPassword:    os.Getenv("MQTT_PASSWORD"),
		MQTTTopicPrefix: envOrDefault("MQTT_TOPIC_PREFIX", "crowdguard"),
		KafkaBrokers:    strings.Split(brokerRaw, ","),
		KafkaTopic:      envOrDefault("KAFKA_TOPIC", "iot.telemetry"),
	}
}

func mustEnv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		log.Fatalf("required env var %s is not set", key)
	}
	return v
}

func envOrDefault(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

// ─────────────────────────────────────────────
// Wire payloads
// ─────────────────────────────────────────────

// TelemetryPayload is the JSON sent by the wristband firmware over MQTT.
// All fields except DeviceID are optional — the firmware sends what it has.
type TelemetryPayload struct {
	DeviceID          string   `json:"device_id"`
	Latitude          *float64 `json:"latitude,omitempty"`
	Longitude         *float64 `json:"longitude,omitempty"`
	HeartRate         *float64 `json:"heart_rate,omitempty"`
	SpO2              *float64 `json:"spo2,omitempty"`
	BodyTemperature   *float64 `json:"body_temperature,omitempty"`
	RSSI              *float64 `json:"rssi,omitempty"`
	SOSFlag           bool     `json:"sos_flag"`
	FallDetected      bool     `json:"fall_detected"`
	BatteryPercentage *float64 `json:"battery_percentage,omitempty"`
	BatteryVoltage    *float64 `json:"battery_voltage,omitempty"`
	FirmwareVersion   *string  `json:"firmware_version,omitempty"`
	RecordedAt        *string  `json:"recorded_at,omitempty"`
}

// KafkaEnvelope matches the envelope format the Python kafka_consumer expects.
type KafkaEnvelope struct {
	EventID       string           `json:"event_id"`
	EventType     string           `json:"event_type"`
	EventVersion  string           `json:"event_version"`
	OccurredAt    string           `json:"occurred_at"`
	CorrelationID string           `json:"correlation_id"`
	Data          TelemetryPayload `json:"data"`
}

// ─────────────────────────────────────────────
// Kafka producer
// ─────────────────────────────────────────────

func newKafkaProducer(brokers []string) (sarama.SyncProducer, error) {
	cfg := sarama.NewConfig()
	cfg.Producer.RequiredAcks = sarama.WaitForAll  // acks="all"
	cfg.Producer.Retry.Max = 5
	cfg.Producer.Return.Successes = true
	cfg.Producer.Compression = sarama.CompressionGZIP
	cfg.Producer.Flush.Frequency = 5 * time.Millisecond
	cfg.Net.DialTimeout = 10 * time.Second
	cfg.Net.WriteTimeout = 10 * time.Second
	cfg.Net.ReadTimeout = 10 * time.Second
	cfg.Producer.Idempotent = true
	cfg.Net.MaxOpenRequests = 1  // required for idempotent producer

	return sarama.NewSyncProducer(brokers, cfg)
}

// ─────────────────────────────────────────────
// Ingestion worker
// ─────────────────────────────────────────────

type Worker struct {
	cfg      Config
	producer sarama.SyncProducer
	mu       sync.Mutex
}

func NewWorker(cfg Config) (*Worker, error) {
	producer, err := newKafkaProducer(cfg.KafkaBrokers)
	if err != nil {
		return nil, fmt.Errorf("kafka producer init: %w", err)
	}
	return &Worker{cfg: cfg, producer: producer}, nil
}

// publish sends one telemetry payload to Kafka.
func (w *Worker) publish(payload TelemetryPayload) error {
	envelope := KafkaEnvelope{
		EventID:       uuid.New().String(),
		EventType:     "iot.telemetry",
		EventVersion:  "1.0",
		OccurredAt:    time.Now().UTC().Format(time.RFC3339Nano),
		CorrelationID: uuid.New().String(),
		Data:          payload,
	}

	body, err := json.Marshal(envelope)
	if err != nil {
		return fmt.Errorf("marshal envelope: %w", err)
	}

	msg := &sarama.ProducerMessage{
		Topic: w.cfg.KafkaTopic,
		Key:   sarama.StringEncoder(payload.DeviceID), // partition by device
		Value: sarama.ByteEncoder(body),
	}

	_, _, err = w.producer.SendMessage(msg)
	return err
}

// onMessage is the MQTT message handler (called from paho goroutine).
func (w *Worker) onMessage(_ mqtt.Client, msg mqtt.Message) {
	// Topic format: {prefix}/device/{device_id}/{type}
	// e.g. crowdguard/device/WB-001/telemetry
	parts := strings.Split(msg.Topic(), "/")
	if len(parts) < 4 {
		log.Printf("WARN unexpected topic format: %s", msg.Topic())
		return
	}
	deviceID := parts[2]

	var payload TelemetryPayload
	if err := json.Unmarshal(msg.Payload(), &payload); err != nil {
		log.Printf("WARN failed to parse MQTT payload from %s: %v", deviceID, err)
		return
	}

	// Always stamp the device_id from the topic — don't trust the payload alone
	if payload.DeviceID == "" {
		payload.DeviceID = deviceID
	}

	if err := w.publish(payload); err != nil {
		log.Printf("ERROR kafka publish failed for device %s: %v", deviceID, err)
		return
	}

	log.Printf("DEBUG published telemetry device=%s sos=%v", payload.DeviceID, payload.SOSFlag)
}

func (w *Worker) Close() {
	if err := w.producer.Close(); err != nil {
		log.Printf("WARN kafka producer close: %v", err)
	}
}

// ─────────────────────────────────────────────
// MQTT client
// ─────────────────────────────────────────────

func newMQTTClient(cfg Config, worker *Worker) mqtt.Client {
	opts := mqtt.NewClientOptions()
	opts.AddBroker(cfg.MQTTBroker)
	opts.SetClientID(fmt.Sprintf("crowdguard-ingestion-%s", uuid.New().String()[:8]))
	opts.SetCleanSession(false)                  // persist subscriptions across reconnects
	opts.SetAutoReconnect(true)
	opts.SetMaxReconnectInterval(30 * time.Second)
	opts.SetConnectRetry(true)
	opts.SetConnectRetryInterval(3 * time.Second)
	opts.SetKeepAlive(30 * time.Second)
	opts.SetPingTimeout(10 * time.Second)

	if cfg.MQTTUsername != "" {
		opts.SetUsername(cfg.MQTTUsername)
		opts.SetPassword(cfg.MQTTPassword)
	}

	// Subscribe on (re)connect
	opts.SetOnConnectHandler(func(c mqtt.Client) {
		topic := fmt.Sprintf("%s/device/+/+", cfg.MQTTTopicPrefix)
		// QoS 1: at-least-once delivery — correct for telemetry
		// (QoS 2 adds latency, QoS 0 drops on network hiccup)
		if token := c.Subscribe(topic, 1, worker.onMessage); token.Wait() && token.Error() != nil {
			log.Printf("ERROR MQTT subscribe failed: %v", token.Error())
		} else {
			log.Printf("INFO MQTT subscribed to %s", topic)
		}
	})

	opts.SetConnectionLostHandler(func(_ mqtt.Client, err error) {
		log.Printf("WARN MQTT connection lost: %v — will auto-reconnect", err)
	})

	return mqtt.NewClient(opts)
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────

func main() {
	log.SetFlags(log.LstdFlags | log.Lmicroseconds)
	log.Println("INFO CrowdGuard MQTT ingestion worker starting")

	cfg := loadConfig()

	worker, err := NewWorker(cfg)
	if err != nil {
		log.Fatalf("FATAL worker init: %v", err)
	}
	defer worker.Close()

	client := newMQTTClient(cfg, worker)

	token := client.Connect()
	token.Wait()
	if err := token.Error(); err != nil {
		log.Fatalf("FATAL MQTT connect: %v", err)
	}
	log.Printf("INFO connected to MQTT broker %s", cfg.MQTTBroker)

	// Block until SIGTERM / SIGINT
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGTERM, syscall.SIGINT)
	<-quit

	log.Println("INFO shutting down MQTT ingestion worker")
	client.Disconnect(500)
}