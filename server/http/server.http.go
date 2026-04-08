package http

import (
	"log"
	"loko/server/connection"
	"loko/server/env"
	"encoding/json"
	"fmt"
	"loko/server/middleware"
	"loko/server/model"
	"loko/server/util"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/compress"
	"gorm.io/gorm"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/helmet"
	"github.com/gofiber/fiber/v2/middleware/requestid"
	"github.com/gofiber/swagger"
)

func Server() *fiber.App {
	var err error

	port := env.GetServerPort()
	server_name := env.GetServerName()

	app := fiber.New(fiber.Config{
		ServerHeader:          server_name,
		DisableStartupMessage: true,
		CaseSensitive:         true,
		BodyLimit:             10 * 1024 * 1024, // 10 MB / max file size
	})

	app.Use(helmet.New(helmet.Config{
		CrossOriginEmbedderPolicy: "unsafe-none",
	}))
	app.Use(cors.New(cors.Config{
		AllowOrigins:     "http://localhost:3000,http://localhost:8000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:8000,http://127.0.0.1:5173",
		AllowMethods:     "GET,POST,PUT,PATCH,DELETE,OPTIONS",
		AllowHeaders:     "Origin,Content-Type,Accept,Authorization,X-Requested-With,Cache-Control,X-Browser-ID",
		ExposeHeaders:    "Content-Type,Authorization,Accept,X-Browser-ID",
		AllowCredentials: true,
		Next: func(c *fiber.Ctx) bool {
			// Skip global CORS for public endpoints to allow route-specific CORS
			return strings.HasPrefix(c.Path(), "/api/public/")
		},
	}))
	app.Use(requestid.New())
	app.Use(compress.New(compress.Config{
		Level: compress.LevelBestSpeed,
		Next: func(c *fiber.Ctx) bool {
			// Skip compression for SSE endpoints to prevent ERR_INCOMPLETE_CHUNKED_ENCODING
			// and buffering issues
			if c.Path() == "/api/whatsapp/v1/messages/stream" || strings.HasSuffix(c.Path(), "/stream") {
				return true
			}
			return false
		},
	}))

	// Setup API Request/Response Logger
	app.Use(middleware.APILogger())

	app.Use(middleware.ErrorHandler())

	// Swagger documentation route
	app.Get("/swagger/*", swagger.HandlerDefault)

	// Get DB connection for module initialization
	sql := connection.SQL{}
	db, err := sql.Connect()
	if err != nil {
		log.Fatal(err)
	}

	// Load Webhook Config on Startup
	loadWebhookConfig(db)

	// Contoh route yang menyebabkan panic
	app.Get("/panic", func(c *fiber.Ctx) error {
		panic("something went wrong!")
	})

	Module(app, db) // Pass db connection to Module

	// Setup static file serving for React frontend
	app.Static("/", "./server/static", fiber.Static{
		Compress:      true,
		ByteRange:     true,
		Browse:        false,
		Index:         "index.html",
		CacheDuration: 0, // Disable cache for development
	})

	// Fallback to index.html for SPA routing
	app.Use("*", func(c *fiber.Ctx) error {
		// Check if it's an API route
		if len(c.Path()) >= 4 && c.Path()[:4] == "/api" {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"error": "Endpoint not found!",
			})
		}
		// For non-API routes, serve index.html (SPA fallback)
		c.Set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate")
		c.Set("Pragma", "no-cache")
		c.Set("Expires", "0")
		return c.SendFile("./server/static/index.html")
	})

	// Bind to 0.0.0.0 in production/docker so nginx can proxy, 127.0.0.1 in dev
	bindAddr := "0.0.0.0"
	if env.GetEnvironment() == "development" {
		bindAddr = "127.0.0.1"
	}
	log.Printf("✅ Server \"%s\" started on %s:%s\n", server_name, bindAddr, port)
	if err = app.Listen(bindAddr + ":" + port); err != nil {
		log.Fatalln("error start server:", err)
	}

	return app
}

func loadWebhookConfig(db *gorm.DB) {
	log.Printf("🔌 Loading Webhook Configuration from Database...")
	var settings []model.SystemSetting
	if err := db.Where("key LIKE ?", "WEBHOOK_%").Find(&settings).Error; err != nil {
		log.Printf("⚠️ Failed to load webhook settings from DB: %v", err)
		return
	}

	config := util.WebhookConfig{
		Enabled:    false,
		MaxRetries: 3,
		RetryDelay: 1 * time.Second,
	}

	for _, s := range settings {
		switch s.Key {
		case "WEBHOOK_URL":
			config.URL = s.Value
		case "WEBHOOK_SECRET":
			config.Secret = s.Value
		case "WEBHOOK_ENABLED":
			config.Enabled = s.Value == "true"
		case "WEBHOOK_MAX_RETRIES":
			var retries int
			fmt.Sscanf(s.Value, "%d", &retries)
			config.MaxRetries = retries
		case "WEBHOOK_RETRY_DELAY":
			var delay int
			fmt.Sscanf(s.Value, "%d", &delay)
			config.RetryDelay = time.Duration(delay) * time.Second
		case "WEBHOOK_HEADERS":
			var headers map[string]string
			if err := json.Unmarshal([]byte(s.Value), &headers); err == nil {
				config.Headers = headers
			}
		}
	}

	if config.URL != "" {
		util.SetWebhookConfig(config)
		log.Printf("✅ Webhook configured to: %s (Enabled: %t)", config.URL, config.Enabled)
	} else {
		log.Printf("ℹ️ No Webhook URL configured in Database")
	}
}
