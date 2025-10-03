package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
)

type Sensor struct {
	Id              string
	Location        string
	Name            string
	AverageMoisture float64
}

type Message struct {
	Sensors []Sensor
}

var (
	moistureThreshold float64
	irrigators = strings.Split(os.Getenv("IRRIGATORS_LIST"), ",")
)

func main() {
	username := os.Getenv("RABBITMQ_USERNAME")
	password := os.Getenv("RABBITMQ_PASSWORD")
	host := os.Getenv("RABBITMQ_HOST")
	port := os.Getenv("RABBITMQ_PORT")
	queue := os.Getenv("RABBITMQ_QUEUE")

	var err error
	moistureThreshold, err = strconv.ParseFloat(os.Getenv("MOISTURE_THRESHOLD"), 64)
	if err != nil {
		log.Fatal(err.Error())
	}

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

	if err := registerExchanges(ch); err != nil {
		log.Fatal(err.Error())
	}

	if err := registerIrrigators(ch); err != nil {
		log.Fatal(err.Error())
	}

	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt, syscall.SIGTERM)

main_loop:
	for {
		select {
		case msg := <-msgsCh:
			if err := triggerIrrigators(ch, msg.Body); err != nil {
				log.Printf("failed to trigger irrigators: %v", err)
			}

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
		true,
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

func registerExchanges(ch *amqp.Channel) error {
	if err := ch.ExchangeDeclare(
		"all",
		amqp.ExchangeFanout,
		false,
		false,
		false,
		false,
		nil,
	); err != nil {
		return fmt.Errorf("failed to declare exchange \"all\": %w", err)
	}

	if err := ch.ExchangeDeclare(
		"quadrants",
		amqp.ExchangeTopic,
		false,
		false,
		false,
		false,
		nil,
	); err != nil {
		return fmt.Errorf("failed to declare exchange \"quadrants\": %w", err)
	}

	return nil
}

func registerIrrigators(ch *amqp.Channel) error {
	for _, i := range irrigators {
		queue, err := ch.QueueDeclare(
			i,
			false,
			false,
			false,
			false,
			nil,
		)
		if err != nil {
			return fmt.Errorf("failed to declare queue \"%s\": %w", i, err)
		}

		err = ch.ExchangeDeclare(
			i,
			amqp.ExchangeDirect,
			false,
			false,
			false,
			false,
			nil,
		)
		if err != nil {
			return fmt.Errorf("failed to declare exchange \"%s\": %w", i, err)
		}

		irrigatorFields := strings.Split(i, "-")
		if len(irrigatorFields) != 3 {
			return fmt.Errorf("failed to parse irrigator fields: %s", irrigatorFields)
		}

		ch.QueueBind(
			queue.Name,
			"",
			"all",
			false,
			nil,
		)

		ch.QueueBind(
			queue.Name,
			irrigatorFields[1],
			"quadrants",
			false,
			nil,
		)

		ch.QueueBind(
			queue.Name,
			i,
			i,
			false,
			nil,
		)
	}

	return nil
}

func triggerIrrigators(ch *amqp.Channel, data []byte) error {
	var msg Message
	if err := json.Unmarshal(data, &msg); err != nil {
		return fmt.Errorf("failed to unmarshal message content: %w", err)
	}

	log.Printf("Received message: %s", string(data))

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	count := 0
	sensorsUnderThreshold := map[string][]string{}
	payload := amqp.Publishing{
		ContentType: "text/plain",
		Body:        []byte("irrigate"),
	}

	for _, sensor := range msg.Sensors {
		if sensor.AverageMoisture <= moistureThreshold {
			sensorsUnderThreshold[sensor.Location] = append(sensorsUnderThreshold[sensor.Location], sensor.Id)
			count++
		}
	}

	if count == len(irrigators) {
		if err := ch.PublishWithContext(
			ctx,
			"all",
			"",
			false,
			false,
			payload,
		); err != nil {
			return fmt.Errorf("failed to publish message in exchange \"all\": %w", err)
		}

		log.Println("Message sent to exchange \"all\"")
		return nil
	}

	errs := []error{}
	for k, v := range sensorsUnderThreshold {
		if len(v) == 1 {
			if err := ch.PublishWithContext(
				ctx,
				v[0],
				v[0],
				false,
				false,
				payload,
			); err != nil {
				errs = append(errs, fmt.Errorf("failed to publish message in exchange \"%s\": %w", v[0], err))
			}

			log.Printf("Message sent to exchange \"%s\"", v[0])
			continue
		}
		
		if err := ch.PublishWithContext(
			ctx,
			"quadrants",
			k,
			false,
			false,
			payload,
		); err != nil {
			errs = append(errs, fmt.Errorf("failed to publish message in exchange \"%s\": %w", k, err))
		}

		log.Printf("Message sent to exchange \"quadrants\" with routing key \"%s\"", k)
	}

	return errors.Join(errs...)
}
