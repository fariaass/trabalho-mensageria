FROM alpine:latest AS builder

WORKDIR /app

RUN apk update && \
    apk add gcc musl-dev rabbitmq-c-dev

COPY . .
RUN gcc irrigador.c -o app.o -lrabbitmq

FROM alpine:latest

WORKDIR /

COPY --from=builder /app/app.o app

CMD ["/app"]
