package whatsapp

import (
	"database/sql"
	"log"
	"loko/server/cache"
	"loko/server/connection"
	"loko/server/middleware"
	"loko/server/module/whatsapp/broadcast"
	"loko/server/module/whatsapp/chat"
	"loko/server/module/whatsapp/contact"
	"loko/server/module/whatsapp/dashboard"
	"loko/server/module/whatsapp/device"
	"loko/server/module/whatsapp/group"
	"loko/server/module/whatsapp/message"
	"loko/server/module/whatsapp/session"
	"loko/server/module/whatsapp/status"
	"loko/server/module/whatsapp/webhook"
	"loko/server/storage"
	"loko/server/variable"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

// Handler is the main WhatsApp handler that composes all sub-handlers
type Handler struct {
	Device    *device.Handler
	Session   *session.Handler
	Message   *message.Handler
	Group     *group.Handler
	Contact   *contact.Handler
	Chat      *chat.Handler
	Status    *status.Handler
	Dashboard *dashboard.Handler
	Webhook   *webhook.Handler
	Broadcast *broadcast.Handler
}

// NewHandler creates a new WhatsApp handler
func NewHandler(db *gorm.DB, sqlDB *sql.DB, chatCache cache.ChatCache, redisCache *cache.RedisCache) *Handler {
	return &Handler{
		Device:    device.NewHandler(db, sqlDB, chatCache),
		Session:   session.NewHandler(db, sqlDB, chatCache),
		Message:   message.NewHandler(db, sqlDB, chatCache, redisCache),
		Group:     group.NewHandler(db, sqlDB, chatCache),
		Contact:   contact.NewHandler(db, sqlDB, chatCache),
		Chat:      chat.NewHandler(db, sqlDB, chatCache, redisCache),
		Status:    status.NewHandler(db, sqlDB, chatCache),
		Dashboard: dashboard.NewHandler(db, sqlDB, redisCache),
		Webhook:   webhook.NewHandler(db, sqlDB, chatCache),
		Broadcast: broadcast.NewHandler(db, sqlDB),
	}
}

// RegisterRoutes registers all WhatsApp routes
func RegisterRoutes(api fiber.Router, h *Handler) {
	wa := api.Group("/whatsapp")

	// Device routes (legacy, no auth required for backward compatibility)
	wa.Get("/devices", h.Device.GetDevices)
	wa.Get("/device/status", h.Device.GetDeviceStatus)
	wa.Post("/device/disconnect", h.Device.DisconnectDevice)
	wa.Get("/qr", h.Device.GetQRCode)
	wa.Get("/device/qr-image", h.Device.GetQRImage)

	// === v1 API Routes — Protected by UseAuth and CheckLicense middleware ===
	v1 := wa.Group("/v1", middleware.UseAuth, middleware.CheckLicense)

	// Session routes
	v1.Post("/sessions", h.Session.CreateSession)
	v1.Get("/sessions", h.Session.ListSessions)
	v1.Get("/sessions/:session_id", h.Session.GetSessionDetail)
	v1.Delete("/sessions/:session_id", h.Session.DeleteSession)
	v1.Get("/sessions/:session_id/qr", h.Session.GetSessionQR)
	v1.Post("/sessions/:session_id/connect", h.Session.ConnectSession)
	v1.Post("/sessions/:session_id/disconnect", h.Session.DisconnectSession)
	v1.Put("/sessions/:session_id/ai-config", h.Session.UpdateAIConfig)
	v1.Get("/sessions/:session_id/contacts", h.Session.GetSessionContacts)
	v1.Get("/sessions/:session_id/groups", h.Group.GetSessionGroups)
	v1.Get("/sessions/:session_id/chats", h.Chat.GetChats)
	v1.Post("/sessions/:session_id/messages/send", h.Message.SendMessage)

	// Message routes
	v1.Post("/messages/send", h.Message.SendMessage)
	v1.Post("/broadcast/group", h.Group.SendGroupBroadcast)
	v1.Get("/messages", h.Message.GetMessages)
	v1.Post("/messages/mark-read", h.Message.MarkAsRead)
	v1.Post("/messages/typing", h.Message.SendTyping)
	v1.Get("/messages/stream", h.Message.StreamMessages)
	v1.Get("/media/download", h.Message.DownloadMedia)

	// Broadcast Schedule routes
	v1.Post("/broadcasts", h.Broadcast.CreateBroadcast)
	v1.Get("/broadcasts", h.Broadcast.ListBroadcasts)
	v1.Get("/broadcasts/:id/history", h.Broadcast.GetBroadcastHistory)
	v1.Delete("/broadcasts/:id", h.Broadcast.CancelBroadcast)
	v1.Post("/broadcasts/:id/send", h.Broadcast.SendBroadcastNow)
	v1.Post("/broadcasts/:id/retry-failed", h.Broadcast.RetryFailedRecipients)

	// Chat routes
	v1.Get("/chats", h.Chat.GetChats)
	v1.Delete("/chats", h.Chat.DeleteChat)
	v1.Post("/chats/consistency-check", h.Chat.CheckChatConsistency)

	// Dashboard routes
	v1.Get("/dashboard/stats", h.Dashboard.GetStats)

	// Admin routes
	admin := v1.Group("/admin", middleware.RoleAccess([]string{variable.SuperAdmin}))
	admin.Get("/contacts", h.Contact.GetMasterDataContacts)
	admin.Get("/contacts/export", h.Contact.ExportMasterDataContacts)

	// === Legacy routes (no auth, backward compatibility) ===

	// Group routes
	wa.Post("/groups", h.Group.CreateGroup)
	wa.Get("/groups", h.Group.GetGroups)
	wa.Get("/groups/:jid", h.Group.GetGroupInfo)
	wa.Post("/groups/join", h.Group.JoinGroup)
	wa.Post("/groups/:jid/leave", h.Group.LeaveGroup)
	wa.Put("/groups", h.Group.UpdateGroup)
	wa.Post("/groups/participants/add", h.Group.AddParticipants)
	wa.Post("/groups/participants/remove", h.Group.RemoveParticipants)

	// Contact routes
	wa.Get("/contacts", h.Contact.GetContacts)

	// Chat routes (legacy)
	wa.Get("/chats", h.Chat.GetChats)

	// Status routes
	wa.Post("/status/send", h.Status.SendStatus)
	wa.Get("/status", h.Status.GetStatus)

	// Webhook routes
	wa.Post("/webhook/configure", h.Webhook.ConfigureWebhook)
	wa.Get("/webhook/status", h.Webhook.GetWebhookStatus)
	wa.Post("/webhook/retry", h.Webhook.RetryFailedWebhooks)
	wa.Post("/webhook/test", h.Webhook.TestWebhook)
}

// InitWhatsAppModule initializes WhatsApp routes and session manager
// This is the main entry point called from module.http.go
func InitWhatsAppModule(api fiber.Router, db *gorm.DB, sqlDB *sql.DB) {
	// Session manager is initialized globally via GetSessionManager
	// No need to initialize it here

	// Create chat cache
	chatCache := cache.NewInMemoryCache()

	// Create Redis cache for media
	redisAddr := "localhost:6379" // Default, can be overridden by env
	redisCache := cache.NewRedisCache(redisAddr)

	// Inject Redis into global SessionManager
	sessionManager := connection.GetSessionManager(db, sqlDB)
	sessionManager.SetRedisCache(redisCache)

	// Initialize S3 storage and inject into SessionManager
	s3c, err := storage.NewS3Client()
	if err != nil {
		log.Printf("⚠️  S3 client initialization failed: %v", err)
	} else if s3c != nil {
		sessionManager.SetS3Client(s3c)
	}

	// Create main handler with Redis cache
	handler := NewHandler(db, sqlDB, chatCache, redisCache)

	// Start broadcast scheduler background goroutine
	broadcast.StartBroadcastScheduler(db, sqlDB)

	// Register all routes
	RegisterRoutes(api, handler)
}
