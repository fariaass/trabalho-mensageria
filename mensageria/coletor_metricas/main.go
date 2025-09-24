package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/signal"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/push"
	amqp "github.com/rabbitmq/amqp091-go"
)

const (
	metricsNamespace = "machines_monitoring"
	machineNameLabel = "machine_name"
)

var (
	registry = prometheus.NewRegistry()

	// TODO: get host by env
	pusher   = push.New("http://localhost:9091", "machines_monitoring").Gatherer(registry)

	latitudeMetric = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name:      "latitude",
			Help:      "latitude coordinate of machine",
			Namespace: metricsNamespace,
		},
		[]string{},
	)

	longitudeMetric = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name:      "longitude",
			Help:      "longitude coordinate of machine",
			Namespace: metricsNamespace,
		},
		[]string{},
	)

	temperatureMetric = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name:      "temperature",
			Help:      "temperature of machine",
			Namespace: metricsNamespace,
		},
		[]string{},
	)

	cpuUsagePorcMetric = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name:      "cpu_usage_porc",
			Help:      "cpu usage of machine in porcentage (0.0 - 1.0)",
			Namespace: metricsNamespace,
		},
		[]string{},
	)

	memUsagePorcMetric = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name:      "mem_usage_porc",
			Help:      "memory usage of machine in porcentage (0.0 - 1.0)",
			Namespace: metricsNamespace,
		},
		[]string{},
	)

	memUsageBytesMetric = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name:      "mem_usage_bytes",
			Help:      "memory usage of machine in bytes",
			Namespace: metricsNamespace,
		},
		[]string{},
	)
)

type Metadata struct {
	Name string `json:"name"`
}

type Coordinates struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
}

type Metrics struct {
	Coordinates   Coordinates `json:"coordinates"`
	Temperature   float64     `json:"temperature"`
	CPUUsagePorc  float64     `json:"cpu_usage_porc"`
	MemUsagePorc  float64     `json:"mem_usage_porc"`
	MemUsageBytes int         `json:"mem_usage_bytes"`
}

type Message struct {
	Metadata Metadata `json:"metadata"`
	Metrics  Metrics  `json:"metrics"`
}

func init() {
	registry.MustRegister(latitudeMetric)
	registry.MustRegister(longitudeMetric)
	registry.MustRegister(temperatureMetric)
	registry.MustRegister(cpuUsagePorcMetric)
	registry.MustRegister(memUsagePorcMetric)
	registry.MustRegister(memUsageBytesMetric)
}

func main() {
	// TODO: get credentials by env
	conn, err := amqp.Dial(fmt.Sprintf("amqp://user:password@localhost:5672/"))
	if err != nil {
		log.Fatalf("failed to connect to rabbitmq: %v", err)
	}

	ch, err := conn.Channel()
	if err != nil {
		log.Fatalf("failed to open a channel: %v", err)
	}

	msgsCh, err := registerConsumer(ch)
	if err != nil {
		log.Fatal(err.Error())
	}

	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt, os.Kill)

main_loop:
	for {
		select {
		case msg := <-msgsCh:
			enviaMetricas(msg.Body)

		case <-c:
			fmt.Println("interrupting...")
			ch.Close()
			conn.Close()
			break main_loop
		}
	}
}

func registerConsumer(ch *amqp.Channel) (<-chan amqp.Delivery, error) {
	q, err := ch.QueueDeclare(
		"q_metrics",
		false,
		false,
		false,
		false,
		nil,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to declare a queue: %w", err)
	}

	msgs, err := ch.Consume(
		q.Name,
		"collector",
		true,
		false,
		false,
		false,
		nil,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to register a consumer: %w", err)
	}

	return msgs, nil
}

func enviaMetricas(data []byte) {
	var msg Message
	if err := json.Unmarshal(data, &msg); err != nil {
		log.Printf("failed to unmarshal message content: %v", err)
		return
	}

	pusher = pusher.Grouping("machine_name", msg.Metadata.Name)

	latitudeMetric.WithLabelValues().Set(msg.Metrics.Coordinates.Latitude)
	longitudeMetric.WithLabelValues().Set(msg.Metrics.Coordinates.Longitude)
	temperatureMetric.WithLabelValues().Set(msg.Metrics.Temperature)
	cpuUsagePorcMetric.WithLabelValues().Set(msg.Metrics.CPUUsagePorc)
	memUsagePorcMetric.WithLabelValues().Set(msg.Metrics.MemUsagePorc)
	memUsageBytesMetric.WithLabelValues().Set(float64(msg.Metrics.MemUsageBytes))

	if err := pusher.Add(); err != nil {
		log.Printf("failed to push metrics: %v", err)
	}
}
