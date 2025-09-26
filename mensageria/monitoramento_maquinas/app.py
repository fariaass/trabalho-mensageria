import pika
import pika.exchange_type
import time
import signal
import sys
import datetime
import json
import os
from rand import random

memory_total_bytes = 1048576

queue = os.getenv("RABBITMQ_QUEUE")
print(queue)
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

while True:
    latitude, longitude = random.randomCoordinates()
    cpu_usage = random.randomFloat(0.1, 1)
    mem_usage = random.randomFloat(0.1, 1)
    temperature = random.randomFloat(40, 60)
    
    dados = {
        "metadata": {
            "name": os.getenv("MACHINE_NAME")
        },
        "metrics": {
            "coordinates": {
                "latitude": f"{latitude} N",
                "longitude": f"{longitude} W",
            },
            "cpu_usage_porc": cpu_usage,
            "mem_usage_porc": mem_usage,
            "mem_usage_bytes": int(mem_usage * memory_total_bytes),
            "temperature": temperature
        }
    }

    channel.basic_publish(
        exchange="e_metrics",
        routing_key="metrics",
        body=json.dumps(dados)
    )

    print(f"[{datetime.datetime.now()}] Metric sent")

    time.sleep(5)
