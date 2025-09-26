package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/signal"
	"strconv"
	"strings"

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
	pusher   = push.New(os.Getenv("PROMETHEUS_PUSHGATEWAY_HOST"), "machines_monitoring").Gatherer(registry)

	latitudeMetric = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name:      "latitude",
			Help:      "latitude coordinate of machine",
			Namespace: metricsNamespace,
		},
		[]string{"cardinal_point"},
	)

	longitudeMetric = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name:      "longitude",
			Help:      "longitude coordinate of machine",
			Namespace: metricsNamespace,
		},
		[]string{"cardinal_point"},
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
	Latitude  string `json:"latitude"`
	Longitude string `json:"longitude"`
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
	username := os.Getenv("RABBITMQ_USERNAME")
	password := os.Getenv("RABBITMQ_PASSWORD")
	host := os.Getenv("RABBITMQ_HOST")
	port := os.Getenv("RABBITMQ_PORT")
	queue := os.Getenv("RABBITMQ_QUEUE")
	conn, err := amqp.Dial(fmt.Sprintf("amqp://%s:%s@%s:%s/", username, password, host, port))
	if err != nil {
		log.Fatalf("failed to connect to rabbitmq: %v", err)
	}

	ch, err := conn.Channel()
	if err != nil {
		log.Fatalf("failed to open a channel: %v", err)
	}

	msgsCh, err := registerConsumer(ch, queue)
	if err != nil {
		log.Fatal(err.Error())
	}

	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt, os.Kill)

main_loop:
	for {
		select {
		case msg := <-msgsCh:
			sendMetrics(msg.Body)

		case <-c:
			fmt.Println("interrupting...")
			ch.Close()
			conn.Close()
			break main_loop
		}
	}
}

func registerConsumer(ch *amqp.Channel, queue string) (<-chan amqp.Delivery, error) {
	q, err := ch.QueueDeclare(
		queue,
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

func sendMetrics(data []byte) {
	var msg Message
	if err := json.Unmarshal(data, &msg); err != nil {
		log.Printf("failed to unmarshal message content: %v", err)
		return
	}

	pusher = pusher.Grouping("machine_name", msg.Metadata.Name)

	latitude_coordinates := msg.Metrics.Coordinates.Latitude
	coordinates := strings.Split(latitude_coordinates, " ")
	if len(coordinates) != 2 {
		fmt.Println("invalid latitude coordinate")
	} else {
		latitude := coordinates[0]
		coordinate, err := strconv.ParseFloat(latitude, 64)
		if err != nil {
			fmt.Println("invalid latitude coordinate")
		}
	
		cardinalPoint := coordinates[1]
		latitudeMetric.WithLabelValues(cardinalPoint).Set(coordinate)
	}
	
	longitude_coordinates := msg.Metrics.Coordinates.Longitude
	coordinates = strings.Split(longitude_coordinates, " ")
	if len(coordinates) != 2 {
		fmt.Println("invalid longitude coordinate")
	} else {
		longitude := coordinates[0]
		coordinate, err := strconv.ParseFloat(longitude, 64)
		if err != nil {
			fmt.Println("invalid longitude coordinate")
		}
	
		cardinalPoint := coordinates[1]
		longitudeMetric.WithLabelValues(cardinalPoint).Set(coordinate)
	}

	temperatureMetric.WithLabelValues().Set(msg.Metrics.Temperature)
	cpuUsagePorcMetric.WithLabelValues().Set(msg.Metrics.CPUUsagePorc)
	memUsagePorcMetric.WithLabelValues().Set(msg.Metrics.MemUsagePorc)
	memUsageBytesMetric.WithLabelValues().Set(float64(msg.Metrics.MemUsageBytes))

	if err := pusher.Add(); err != nil {
		log.Printf("failed to push metrics: %v", err)
	}
}
