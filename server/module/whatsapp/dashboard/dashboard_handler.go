package dashboard

import (
	"context"
	"database/sql"
	"fmt"
	"loko/server/cache"
	"loko/server/connection"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Handler struct {
	DB         *gorm.DB
	SqlDB      *sql.DB
	RedisCache *cache.RedisCache
}

func NewHandler(db *gorm.DB, sqlDB *sql.DB, redisCache *cache.RedisCache) *Handler {
	return &Handler{
		DB:         db,
		SqlDB:      sqlDB,
		RedisCache: redisCache,
	}
}

// GetStats returns the dashboard statistics for a specific session
func (h *Handler) GetStats(c *fiber.Ctx) error {
	sessionID := c.Query("session_id")
	if sessionID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "session_id query parameter is required",
		})
	}

	sessionManager := connection.GetSessionManager(h.DB, h.SqlDB)

	// Validate session existence
	_, err := sessionManager.GetSession(sessionID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"message": "Session not found",
		})
	}

	// 1. Calculate Active Chats (from Redis)
	activeChats := int64(0)
	if h.RedisCache != nil && h.RedisCache.IsAvailable() {
		ctx := context.Background()
		chatKey := fmt.Sprintf("chats:list:%s", sessionID)
		activeChats, _ = h.RedisCache.ZCard(ctx, chatKey)
	}

	// 2. Total Contacts
	totalContacts := 0
	sessionUUID, parseErr := uuid.Parse(sessionID)
	if parseErr == nil {
		client, exists := sessionManager.GetClient(sessionUUID)
		if exists && client != nil && client.Store != nil && client.Store.Contacts != nil {
			contacts, _ := client.Store.Contacts.GetAllContacts(context.Background())
			totalContacts = len(contacts)
		}
	}

	// 3. Messages Sent Today
	var messagesSentToday int64 = 0
	if h.SqlDB != nil {
		todayStart := time.Now().Truncate(24 * time.Hour)

		query := `
			SELECT COUNT(id) 
			FROM whatsapp_messages 
			WHERE session_id = $1 
			  AND is_from_me = true 
			  AND timestamp >= $2
		`
		err := h.SqlDB.QueryRow(query, sessionID, todayStart).Scan(&messagesSentToday)
		if err != nil && err != sql.ErrNoRows {
			// Do not block if stats calculation fails, just log it
			fmt.Printf("Warning: failed to count messages today: %v\n", err)
		}
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data": fiber.Map{
			"session_id":          sessionID,
			"active_chats":        activeChats,
			"total_contacts":      totalContacts,
			"messages_sent_today": messagesSentToday,
		},
	})
}
