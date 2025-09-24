import pika
import pika.exchange_type
import time
import signal
import sys
import datetime
import json

# TODO: get credentials by env
connection = pika.BlockingConnection(pika.ConnectionParameters('localhost', credentials=pika.PlainCredentials("user", "password")))

def signal_handler(sig, frame):
    global connection
    print()
    print("interrupting...")
    connection.close()
    sys.exit(0)

signal.signal(signal.SIGINT, signal_handler)

channel = connection.channel()
channel.exchange_declare("e_metrics", pika.exchange_type.ExchangeType.direct)
channel.queue_declare("q_metrics")
channel.queue_bind("q_metrics", "e_metrics", "metrics")

# TODO: generate random metric data
while True:
    
    # TODO: get machine name by env
    dados = {
        "metadata": {
            "name": "machine_01"
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
