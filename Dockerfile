# Stage 1: build Go binary
FROM golang:1.24-alpine AS builder

WORKDIR /app

# Dependencies (cached separately)
COPY go.mod go.sum ./
RUN go mod download

# Source
COPY . .

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -trimpath -ldflags="-s -w" -o server ./cmd/server/

# Stage 2: minimal runtime image
FROM alpine:3.21

RUN apk --no-cache add ca-certificates tzdata curl

# Non-root user (UID 1000); ensure ./data is writable on the host if using a bind mount
RUN addgroup -g 1000 tga && adduser -D -u 1000 -G tga tga

WORKDIR /app

COPY --from=builder /app/server   ./server
COPY --from=builder /app/web      ./web

RUN mkdir -p /app/data && chown -R tga:tga /app

# Data directory is mounted at runtime
VOLUME ["/app/data"]

ENV TGA_DATA=/app/data
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8080/health || exit 1

USER tga

ENTRYPOINT ["./server"]
