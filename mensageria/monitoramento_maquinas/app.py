import pika
import pika.exchange_type
import time
import signal
import sys
import datetime
import json
import os

queue = os.getenv("RABBITMQ_QUEUE")
connection = pika.BlockingConnection(pika.ConnectionParameters(os.getenv("RABBITMQ_HOST"), os.getenv("RABBITMQ_PORT"), credentials=pika.PlainCredentials(os.getenv("RABBITMQ_USERNAME"), os.getenv("RABBITMQ_PASSWORD"))))

def signal_handler(sig, frame):
    global connection
    print()
    print("interrupting...")
    connection.close()
    sys.exit(0)

signal.signal(signal.SIGINT, signal_handler)

channel = connection.channel()
channel.exchange_declare("e_metrics", pika.exchange_type.ExchangeType.direct)
channel.queue_declare(queue)
channel.queue_bind(queue, "e_metrics", "metrics")

# TODO: generate random metric data
while True:
    
    dados = {
        "metadata": {
            "name": os.getenv("MACHINE_NAME")
        },
        "metrics": {
            "coordinates": {
                "latitude": 70.3,
                "longitude": 72.4,
            },
            "cpu_usage_porc": 0.7,
            "mem_usage_porc": 0.8,
            "mem_usage_bytes": 10000000,
            "temperature": 40.3
        }
    }

    channel.basic_publish(
        exchange="e_metrics",
        routing_key="metrics",
        body=json.dumps(dados)
    )

    print(f"[{datetime.datetime.now()}] Metric sent")

    time.sleep(1)
