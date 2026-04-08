# --- 🛠️ Multi-stage build with Bun and Go --- #
FROM oven/bun:1.2-alpine AS frontend-builder
LABEL org.opencontainers.image.authors="jefriherditriyanto@gmail.com"

# Build Frontend with Bun
WORKDIR /frontend
COPY frontend/package.json frontend/bun.lock* ./
RUN bun install

COPY frontend/ ./
RUN bun run build

# --- 🛠️ golang as backend builder --- #
FROM golang:1.24-alpine AS backend-builder

#-> Setup Environment
ENV GO111MODULE=on
ENV CGO_ENABLED=0
ENV GOOS=linux
ENV GOARCH=amd64

#-> 🌊 Install Require
RUN apk add --no-cache \
    gcc \
    musl-dev \
    tzdata

WORKDIR /build
COPY . .

# Copy built frontend from previous stage
COPY --from=frontend-builder /frontend/dist ./server/static/dist/

#-> 🌊 Install Golang Module
RUN go mod download

#-> ⚒️ Build App with embedded frontend
RUN go build -o ./run

# =============================================================================== #

# --- 🚀 Finishing --- #
# Pin to alpine:3.19 for stable ffmpeg (alpine:latest 3.21+ has broken libglslang deps)
FROM alpine:3.19 AS runner
WORKDIR /app

# Install runtime dependencies (ffmpeg from stable 3.19 repo)
RUN apk add --no-cache openssl curl nano ffmpeg

COPY --from=backend-builder /build/run /app/run
COPY --from=backend-builder /build/server/static /app/server/static

RUN chmod +x ./run

ENTRYPOINT ["/app/run"]
