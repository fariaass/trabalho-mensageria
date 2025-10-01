package controladorumidade

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/signal"
	"strconv"
	"strings"

	amqp "github.com/rabbitmq/amqp091-go"
)

type Message struct {
	
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
			triggerIrrigators(msg)

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

func registerExchanges(ch *amqp.Channel, queue string) (<-chan amqp.Delivery, error) {
	if err := ch.ExchangeDeclare(
		"all",
		amqp.ExchangeFanout,
		false,
		false,
		false,
		false,
		nil,
	); err != nil {
		return nil, fmt.Errorf("failed to declare \"all\" exchange: %w", err)
	}

	for i := range 4 {
		quadrant := fmt.Sprintf("q%d", i+1)
		if err := ch.ExchangeDeclare(
			quadrant,
			amqp.ExchangeTopic,
			false,
			false,
			false,
			false,
			nil,
		); err != nil {
			return nil, fmt.Errorf("failed to declare \"%s\" exchange: %w", quadrant, err)
		}
	}

	return msgs, nil
}

func triggerIrrigators(data []byte) {
	var msg Message
	if err := json.Unmarshal(data, &msg); err != nil {
		log.Printf("failed to unmarshal message content: %v", err)
		return
	}


}
