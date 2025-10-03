FROM alpine:latest AS builder

WORKDIR /

RUN apk update && \
    apk add gcc musl-dev rabbitmq-c-dev

COPY . .
RUN gcc irrigador.c -o app.o -lrabbitmq

CMD ["/app.o"]
