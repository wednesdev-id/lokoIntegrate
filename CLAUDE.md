# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Loko is a WhatsApp integration API service that provides business messaging capabilities. It's a full-stack application with a Go backend using Fiber framework and a React TypeScript frontend. The application supports both PostgreSQL (primary) and MongoDB databases, with WhatsApp functionality powered by the `go.mau.fi/whatsmeow` library.

## Architecture

### Backend (Go)
- **Framework**: Fiber v2 (high-performance HTTP framework)
- **Language**: Go 1.23+ with TypeScript frontend support
- **Database**: PostgreSQL (primary via GORM) + MongoDB (legacy)
- **WhatsApp Integration**: go.mau.fi/whatsmeow library
- **Authentication**: JWT with Goth OAuth2 providers (Google, GitHub)
- **API Documentation**: Swagger/OpenAPI with auto-generation
- **Static Files**: Embedded React frontend using Go embed

### Frontend (React)
- **Framework**: React 18 with TypeScript
- **Bundler**: Vite with hot reload
- **Styling**: Tailwind CSS
- **State Management**: Axios for API calls
- **Build Tool**: Bun (preferred) or npm

### Module Structure
The backend follows a modular pattern:
- `server/module/` - Business logic modules (auth, user, whatsapp, project, team)
- `server/http/` - HTTP handlers and routing
- `server/model/` - Database models (GORM structs)
- `server/dto/` - Data transfer objects
- `server/connection/` - Database connections (PostgreSQL, MongoDB, Redis, RabbitMQ)
- `server/middleware/` - Fiber middleware (auth, CORS, logging)
- `server/util/` - Utility functions (JWT, encryption, validation)
- `server/env/` - Environment configuration
- `frontend/src/` - React application source

## Development Commands

### Using Management Script (Recommended)
The project includes a comprehensive `manage.sh` script:

```bash
# Development with hot reload
./manage.sh dev

# Build full-stack application (frontend + backend)
./manage.sh build-fullstack

# Build production binary
./manage.sh build-prod

# Run production binary
./manage.sh run-prod

# Stop all services
./manage.sh stop-all

# Rebuild everything
./manage.sh rebuild-all

# View logs
./manage.sh logs

# Create admin user
./manage.sh create-admin
```

### Manual Development Commands

#### Frontend Development
```bash
cd frontend
bun install          # or npm install
bun run dev          # Start dev server on http://localhost:5173
bun run build        # Build for production
```

#### Backend Development
```bash
# Install dependencies
go mod download
go mod tidy

# Run development server
go run main.go

# Build binary
go build -o bin/loko-backend .

# Generate Swagger documentation
swag init

# Run tests (when available)
go test ./...
```

#### Docker Development
```bash
# Build and run with Docker Compose
docker-compose up --build

# Stop containers
docker-compose down

# View logs
docker-compose logs -f loko-backend
```

## Environment Configuration

### Required Environment Variables
Copy `.env.example` to `.env` and configure:

```env
# Server Configuration
SERVER_NAME=loko-backend
SERVER_PORT=1234
SECRET_KEY=your-secret-key-here

# PostgreSQL Database (Primary)
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USER=loko_user
DB_PASS=loko_password
DB_NAME=loko_db
DB_MIGRATION=true

# JWT Configuration
JWT_EXPIRED_DAY=7
STAY_ALIVE_MINUTE=30

# Optional Services
MONGO_URL=mongodb://localhost:27017
MONGO_NAME=loko_db
RABBIT_URL=
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
```

## Key Features

### WhatsApp Integration
- Device management with QR code generation
- Send text, image, video, audio, and document messages
- WhatsApp status management
- Real-time connection monitoring
- Session persistence

### Authentication & Authorization
- JWT-based authentication with refresh tokens
- Role-based access control (Administrator, User, etc.)
- OAuth2 integration with Google and GitHub
- Password hashing and security utilities

### API Documentation
- Auto-generated Swagger/OpenAPI documentation
- Available at `/swagger/*` endpoint
- Postman collection included: `Loko_WhatsApp_API.postman_collection.json`

## Development Workflow

### Making Changes
1. **Backend Changes**: Edit Go files in `server/` directory
2. **Frontend Changes**: Edit React files in `frontend/src/`
3. **API Changes**: Update DTOs and handlers, then regenerate Swagger docs with `swag init`
4. **Database Changes**: Modify models in `server/model/` and run migrations

### Adding New Modules
1. Create module struct in `server/module/`
2. Implement `Route()` method to register endpoints
3. Register module in `server/http/module.http.go`
4. Add corresponding models, DTOs, and handlers

### Testing
- No test files currently exist in the codebase
- Use `go test ./...` to run tests when added
- API testing via Swagger UI or Postman collection

## Deployment

### Production Build
The application uses a multi-stage Docker build:
1. Frontend built with Bun
2. Backend compiled with Go 1.23
3. Static files embedded in binary
4. Final Alpine Linux image with runtime dependencies

### Running in Production
```bash
# Build and run with Docker
docker-compose up -d

# Or run binary directly
./manage.sh build-prod
./manage.sh run-prod
```

## Database

### PostgreSQL (Primary)
- Tables: users, teams, projects, devices, billing_schedules, etc.
- Auto-migration enabled with `DB_MIGRATION=true`
- GORM ORM with connection pooling

### MongoDB (Legacy)
- Collections: messages, status, devices (WhatsApp data)
- Used for WhatsApp-specific data storage
- Will be phased out in favor of PostgreSQL

## Important Notes

- The application listens on port 1234 by default
- Frontend is embedded and served from `/static` and root paths
- CORS is configured for localhost development ports (3000, 5173, 8000)
- WhatsApp sessions stored in `./sessions` directory
- All API routes are prefixed with `/api`
- Health checks available at `/health` endpoint
- Static file serving handles React Router automatically