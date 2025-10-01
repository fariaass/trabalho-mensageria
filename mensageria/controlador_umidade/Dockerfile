#build stage
FROM golang:1.24.7-alpine3.22 AS builder

WORKDIR /app

RUN apk add --no-cache git

COPY . .
RUN go mod download && \
    go mod verify

RUN go build -v -o app main.go

FROM cgr.dev/chainguard/wolfi-base

WORKDIR /
COPY --from=builder /app/app /

CMD ["/app"]
