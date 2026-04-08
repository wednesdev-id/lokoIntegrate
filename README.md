# Loko (Lobby Toko) - WhatsApp Integration API

![Loko Logo](https://img.shields.io/badge/Loko-WhatsApp%20API-green?style=for-the-badge&logo=whatsapp)

**Loko** adalah aplikasi backend yang menyediakan integrasi WhatsApp untuk keperluan bisnis dan toko online. Dengan Loko, Anda dapat mengirim pesan, mengelola status WhatsApp, dan mengintegrasikan WhatsApp dengan sistem toko Anda.

## 🚀 Fitur Utama

- **📱 Manajemen Device WhatsApp**: Koneksi dan monitoring status device WhatsApp
- **💬 Pengiriman Pesan**: Kirim pesan teks, gambar, video, audio, dan dokumen
- **📊 Status WhatsApp**: Kirim dan kelola status WhatsApp (Story)
- **🔗 QR Code Integration**: Generate QR code untuk koneksi device baru
- **📚 Dokumentasi API**: Swagger UI terintegrasi untuk dokumentasi API
- **🔄 Real-time Monitoring**: Monitoring status koneksi dan pesan

## 🛠️ Tech Stack

- **Backend**: Go (Golang) dengan Gin Framework
- **Database**: MongoDB
- **WhatsApp Integration**: go.mau.fi/whatsmeow
- **Authentication**: Goth (OAuth2)
- **Documentation**: Swagger/OpenAPI
- **Environment**: Docker support

## 📋 Prerequisites

Sebelum menjalankan aplikasi, pastikan Anda telah menginstall:

- Go 1.19 atau lebih baru
- MongoDB
- Git

### macOS Installation

```bash
# Install Go
brew install go

# Install MongoDB
brew tap mongodb/brew
brew install mongodb-community

# Start MongoDB service
brew services start mongodb-community
```

## 🚀 Quick Start

### 1. Clone Repository

```bash
git clone <repository-url>
cd loko-backend
```

### 2. Environment Setup

Buat file `.env` di root directory:

```env
# Database Configuration
MONGO_URI=mongodb://localhost:27017
MONGO_DATABASE=loko_db

# Server Configuration
PORT=8000
ENVIRONMENT=development

# WhatsApp Configuration
WHATSAPP_SESSION_PATH=./sessions

# OAuth Configuration (Optional)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
```

### 3. Install Dependencies

```bash
go mod download
```

### 4. Generate Swagger Documentation

```bash
# Install swag CLI
go install github.com/swaggo/swag/cmd/swag@latest

# Generate docs
swag init
```

### 5. Run Application

```bash
go run main.go
```

Server akan berjalan di `http://localhost:8000`

## 📖 API Documentation

### Swagger UI
Akses dokumentasi API interaktif di: `http://localhost:8000/swagger/index.html`

### Postman Collection
Import file `Loko_WhatsApp_API.postman_collection.json` ke Postman untuk testing API.

## 🔌 API Endpoints

### Device Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/whatsapp/device/status` | Cek status koneksi device |
| GET | `/whatsapp/qr` | Generate QR code untuk koneksi |

### Messaging

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/whatsapp/send` | Kirim pesan WhatsApp |

### Status Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/whatsapp/status` | Ambil daftar status |
| POST | `/whatsapp/status/send` | Kirim status WhatsApp |

## 💡 Contoh Penggunaan

### 1. Cek Status Device

```bash
curl -X GET "http://localhost:8000/whatsapp/device/status" \
  -H "Content-Type: application/json"
```

### 2. Kirim Pesan Teks

```bash
curl -X POST "http://localhost:8000/whatsapp/send" \
  -H "Content-Type: application/json" \
  -d '{
    "chat_jid": "6281234567890@s.whatsapp.net",
    "message_type": "text",
    "content": "Halo dari Loko!"
  }'
```

### 3. Kirim Pesan Gambar

```bash
curl -X POST "http://localhost:8000/whatsapp/send" \
  -H "Content-Type: application/json" \
  -d '{
    "chat_jid": "6281234567890@s.whatsapp.net",
    "message_type": "image",
    "media_url": "https://example.com/image.jpg",
    "caption": "Produk terbaru dari toko kami!"
  }'
```

### 4. Kirim Status WhatsApp

```bash
curl -X POST "http://localhost:8000/whatsapp/status/send" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "text",
    "content": "Update terbaru dari Loko!"
  }'
```

## 📁 Struktur Project

```
loko-backend/
├── main.go                 # Entry point aplikasi
├── docs/                   # Swagger documentation
│   ├── docs.go
│   ├── swagger.json
│   └── swagger.yaml
├── internal/               # Internal packages
│   ├── config/            # Konfigurasi aplikasi
│   ├── handlers/          # HTTP handlers
│   ├── models/            # Data models
│   ├── services/          # Business logic
│   └── utils/             # Utility functions
├── sessions/              # WhatsApp session files
├── .env                   # Environment variables
├── go.mod                 # Go modules
├── go.sum                 # Go dependencies
├── README.md              # Dokumentasi ini
└── Loko_WhatsApp_API.postman_collection.json  # Postman collection
```

## 🔧 Konfigurasi

### Environment Variables

| Variable | Description | Default |
|----------|-------------|----------|
| `MONGO_URI` | MongoDB connection string | `mongodb://localhost:27017` |
| `MONGO_DATABASE` | Database name | `loko_db` |
| `PORT` | Server port | `8000` |
| `ENVIRONMENT` | Environment mode | `development` |
| `WHATSAPP_SESSION_PATH` | WhatsApp session storage path | `./sessions` |

### MongoDB Collections

Aplikasi akan otomatis membuat collections berikut:
- `messages` - Menyimpan riwayat pesan
- `status` - Menyimpan riwayat status WhatsApp
- `devices` - Menyimpan informasi device WhatsApp

## 🐳 Docker Support

### Dockerfile

```dockerfile
FROM golang:1.19-alpine AS builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN go build -o main .

FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/

COPY --from=builder /app/main .
COPY --from=builder /app/docs ./docs

EXPOSE 8000
CMD ["./main"]
```

### Docker Compose

```yaml
version: '3.8'
services:
  loko-api:
    build: .
    ports:
      - "8000:8000"
    environment:
      - MONGO_URI=mongodb://mongo:27017
      - MONGO_DATABASE=loko_db
    depends_on:
      - mongo
    volumes:
      - ./sessions:/root/sessions

  mongo:
    image: mongo:5.0
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db

volumes:
  mongo_data:
```

## 🔒 Security

- Pastikan untuk tidak commit file `.env` ke repository
- Gunakan environment variables untuk konfigurasi sensitif
- Implementasikan rate limiting untuk production
- Gunakan HTTPS untuk production deployment

## 🧪 Testing

### Unit Testing

```bash
go test ./...
```

### API Testing dengan Postman

1. Import collection `Loko_WhatsApp_API.postman_collection.json`
2. Set environment variable `base_url` ke `http://localhost:8000`
3. Jalankan collection tests

## 📊 Monitoring

### Health Check

```bash
curl -X GET "http://localhost:8000/health"
```

### Logs

Aplikasi menggunakan structured logging. Logs akan ditampilkan di console dengan format JSON untuk production.

## 🤝 Contributing

1. Fork repository
2. Buat feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📝 License

Project ini menggunakan MIT License. Lihat file `LICENSE` untuk detail.

## 🆘 Support

Jika Anda mengalami masalah atau memiliki pertanyaan:

1. Cek dokumentasi API di Swagger UI
2. Lihat issues yang sudah ada di repository
3. Buat issue baru jika diperlukan

## 🔄 Changelog

### v1.0.0 (Current)
- ✅ WhatsApp device management
- ✅ Send text, image, video, audio, document messages
- ✅ WhatsApp status management
- ✅ QR code generation
- ✅ Swagger documentation
- ✅ MongoDB integration
- ✅ Postman collection

## 🎯 Roadmap

- [ ] Webhook support untuk incoming messages
- [ ] Message templates
- [ ] Bulk messaging
- [ ] Analytics dashboard
- [ ] Multi-device support
- [ ] Message scheduling
- [ ] Auto-reply features

---

**Loko (Lobby Toko)** - Connecting your business with WhatsApp 🚀

Dibuat dengan ❤️ untuk memudahkan integrasi WhatsApp dalam bisnis Anda.