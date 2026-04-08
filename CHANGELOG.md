# Changelog

Semua perubahan penting pada proyek Loko (Lobby Toko) WhatsApp API akan didokumentasikan dalam file ini.

Format berdasarkan [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
dan proyek ini mengikuti [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-03-10

### 🎉 Rilis Pertama

Rilis pertama Loko dengan fitur lengkap untuk integrasi WhatsApp Business.

### ✨ Fitur Utama

#### 🔐 Autentikasi & Manajemen User
- Sistem autentikasi lengkap dengan JWT
- Registrasi dan login user
- Manajemen profil user
- Role-based access control (Super Admin, Admin, User)
- OAuth integration dengan Google dan GitHub
- Login history tracking
- Token revocation system

#### 📱 WhatsApp Session Management
- Multi-session WhatsApp support
- QR code generation untuk pairing device
- Real-time session status monitoring
- Session persistence dengan PostgreSQL
- Auto-reconnect mechanism
- Session isolation per user
- Device management dan monitoring

#### 💬 Messaging Features
- Kirim pesan teks
- Kirim media (gambar, video, audio, dokumen)
- Reply to message (quoted message)
- Forward message
- Delete message
- Star/unstar message
- Message reactions
- Broadcast messaging
- Bulk messaging
- Message history dengan pagination
- Real-time message streaming via SSE (Server-Sent Events)

#### 👥 Contact Management
- Contact synchronization dari WhatsApp
- Import contacts dari CSV
- Contact list dengan search dan filter
- Contact name resolution
- Contact caching dengan Redis

#### 💬 Chat Management
- Chat list dengan pagination
- Real-time chat updates
- Unread message counter
- Last message preview
- Chat search dan filter
- Chat archiving
- Infinite scroll untuk message history
- Optimistic UI updates
- Message deduplication

#### 📊 Group Management
- Create WhatsApp group
- Update group info (name, description, picture)
- Add/remove participants
- Promote/demote admins
- Leave group
- Group invitation links
- Group participant management

#### 📱 Status (Story) Management
- Send text status
- Send media status (image, video)
- View status list
- Status privacy settings

#### 💰 Subscription & Licensing
- Subscription package management
- License generation dan validation
- Subscription reports
- Revenue tracking
- Billing schedule management
- Transaction history
- AI quota management per user

#### 🎨 Frontend Dashboard
- Modern React-based UI dengan TypeScript
- Responsive design dengan Tailwind CSS
- Real-time updates dengan SSE
- Chat interface mirip WhatsApp Web
- Device status monitoring
- Session management UI
- Contact management UI
- Broadcast composer
- Media upload dengan preview
- Message context menu
- Dark mode support

#### 🔧 Technical Features
- **Backend**: Go (Golang) dengan Gin Framework
- **Database**: PostgreSQL dengan GORM
- **Cache**: Redis untuk session dan chat caching
- **Message Queue**: RabbitMQ untuk async processing
- **Storage**: S3-compatible storage untuk media files
- **Real-time**: Server-Sent Events (SSE) untuk live updates
- **API Documentation**: Swagger/OpenAPI
- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **State Management**: React Query untuk data caching
- **UI Components**: Radix UI + shadcn/ui

#### 📡 API Endpoints
- RESTful API design
- Comprehensive error handling
- Request validation
- API logging middleware
- Rate limiting support
- CORS configuration
- Health check endpoint

#### 🔒 Security
- JWT-based authentication
- Password hashing dengan bcrypt
- Token refresh mechanism
- License validation middleware
- Role-based authorization
- Secure session storage
- Environment-based configuration

#### 🚀 Infrastructure
- Docker support dengan multi-stage build
- Podman support
- Docker Compose configuration
- Database migration system
- Automated admin creation script
- Environment variable management

#### 📊 Monitoring & Logging
- Structured API logging
- Request/response logging
- Error tracking
- Performance monitoring
- Database query logging

#### 🎯 Developer Experience
- Comprehensive Swagger documentation
- Postman collection included
- Example environment configuration
- Database initialization scripts
- Development scripts (manage.sh)
- Clear project structure
- Code organization by modules

### 🏗️ Arsitektur

#### Backend Structure
```
server/
├── auth/           # Authentication logic
├── cache/          # Redis caching
├── connection/     # Database & external connections
├── dto/            # Data Transfer Objects
├── http/           # HTTP server setup
├── middleware/     # HTTP middlewares
├── model/          # Database models
├── module/         # Business logic modules
├── response/       # Response structures
├── storage/        # S3 storage integration
└── util/           # Utility functions
```

#### Frontend Structure
```
frontend/src/
├── components/     # React components
├── contexts/       # React contexts
├── hooks/          # Custom React hooks
├── pages/          # Page components
├── services/       # API services
├── types/          # TypeScript types
└── utils/          # Utility functions
```

### 📦 Dependencies

#### Backend (Go)
- gin-gonic/gin - HTTP framework
- gorm.io/gorm - ORM
- go.mau.fi/whatsmeow - WhatsApp library
- redis/go-redis - Redis client
- rabbitmq/amqp091-go - RabbitMQ client
- aws/aws-sdk-go - S3 storage
- swaggo/swag - API documentation
- golang-jwt/jwt - JWT authentication

#### Frontend (React)
- react + react-dom - UI framework
- typescript - Type safety
- vite - Build tool
- tailwindcss - CSS framework
- @tanstack/react-query - Data fetching
- @radix-ui/* - UI primitives
- lucide-react - Icons

### 🐛 Bug Fixes
- Fixed session isolation issues
- Fixed chat loading with proper pagination
- Fixed message deduplication logic
- Fixed media download and caching
- Fixed contact synchronization
- Fixed QR code generation timing
- Fixed SSE connection handling
- Fixed mobile responsive layout

### 🔄 Improvements
- Optimized chat list loading dengan offset-based pagination
- Enhanced message caching strategy
- Improved error handling across all modules
- Better session state management
- Optimized database queries
- Enhanced UI/UX responsiveness
- Improved media handling with retry logic
- Better scroll behavior in chat

### 📝 Documentation
- Comprehensive README.md
- API documentation via Swagger
- Postman collection untuk testing
- Environment setup guide
- Docker deployment guide
- Code comments dan inline documentation

### 🎯 Known Limitations
- Maximum 5 concurrent WhatsApp sessions per user (configurable)
- Media files cached locally dengan size limit
- SSE connection timeout setelah 1 jam (auto-reconnect)
- Bulk message rate limited untuk prevent spam

### 🔮 Future Plans
- Webhook support untuk incoming messages
- Message templates management
- Advanced analytics dashboard
- Message scheduling
- Auto-reply features
- Chatbot integration
- Multi-language support
- Enhanced reporting features

---

## Format Changelog

### Types of Changes
- `Added` untuk fitur baru
- `Changed` untuk perubahan pada fitur yang sudah ada
- `Deprecated` untuk fitur yang akan dihapus
- `Removed` untuk fitur yang sudah dihapus
- `Fixed` untuk bug fixes
- `Security` untuk vulnerability fixes

---

**Loko (Lobby Toko)** - Connecting your business with WhatsApp 🚀

[1.0.0]: https://github.com/yourusername/loko-backend/releases/tag/v1.0.0
