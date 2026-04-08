package message

import (
	"context"
	"fmt"
	"log"
	"loko/server/connection"
	"loko/server/dto"
	"loko/server/model"
	"loko/server/response"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/types"
)

// MarkAsRead marks messages as read
// @Summary Mark messages as read
// @Description Send read receipts for specified messages
// @Tags WhatsApp Messages
// @Accept json
// @Produce json
// @Param request body dto.MarkReadRequest true "Mark read request"
// @Success 200 {object} response.WhatsAppBaseResponse
// @Failure 400 {object} response.ErrorResponse
// @Router /whatsapp/v1/messages/mark-read [post]
func (h *Handler) MarkAsRead(c *fiber.Ctx) error {
	var req dto.MarkReadRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(response.ErrorResponse{
			Success: false,
			Message: "Invalid request body",
			Error:   err.Error(),
		})
	}

	// Get session manager
	sessionManager := connection.GetSessionManager(h.DB, h.SqlDB)

	// Get session ID from first message
	var sessionID string
	if len(req.MessageIDs) > 0 {
		h.DB.Model(&model.WhatsAppMessage{}).
			Select("session_id").
			Where("message_id = ?", req.MessageIDs[0]).
			First(&sessionID)
	}

	if sessionID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(response.ErrorResponse{
			Success: false,
			Message: "Could not determine session",
			Error:   "No messages found with provided IDs",
		})
	}

	// Get WhatsApp client for this session
	var session model.WhatsAppSessionModel
	var client *whatsmeow.Client
	var clientAvailable bool

	log.Printf("🔍 MarkAsRead: Received session_id=%s", sessionID)

	// Try parsing as UUID first
	sessionUUID, err := uuid.Parse(sessionID)
	if err == nil {
		// sessionID is a UUID string
		if err := h.DB.Where("id = ?", sessionUUID).First(&session).Error; err != nil {
			log.Printf("⚠️  MarkAsRead: Failed to find session by UUID %s: %v", sessionUUID, err)
		} else {
			client, clientAvailable = sessionManager.GetClient(session.ID)
			log.Printf("🔍 MarkAsRead: Found session in DB, looking up client by session.ID=%s - available=%v", session.ID, clientAvailable)
		}
	} else {
		// Not a UUID, try finding by session_id field
		if err := h.DB.Where("session_id = ?", sessionID).First(&session).Error; err != nil {
			log.Printf("⚠️  MarkAsRead: Failed to find session by session_id %s: %v", sessionID, err)
		} else {
			client, clientAvailable = sessionManager.GetClient(session.ID)
			log.Printf("🔍 MarkAsRead: Found session in DB by session_id, looking up client by session.ID=%s - available=%v", session.ID, clientAvailable)
		}
	}

	// Parse chat JID
	chatJID, err := types.ParseJID(req.ChatJID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(response.ErrorResponse{
			Success: false,
			Message: "Invalid chat JID",
			Error:   err.Error(),
		})
	}

	// Send read receipt to WhatsApp (if client available)
	if clientAvailable && client != nil {
		for _, messageID := range req.MessageIDs {
			msgIDs := []types.MessageID{types.MessageID(messageID)}
			err := client.MarkRead(context.Background(), msgIDs, time.Now(), chatJID, chatJID)
			if err != nil {
				log.Printf("⚠️  Failed to send read receipt to WhatsApp for %s: %v", messageID, err)
			}
		}
		log.Printf("✅ Sent read receipts to WhatsApp for %d messages", len(req.MessageIDs))
	} else {
		log.Printf("⚠️  WhatsApp client not available, skipping read receipt (DB will still be updated)")
	}

	// === UPDATE DATABASE ===
	err = h.DB.Model(&model.WhatsAppMessage{}).
		Where("session_id = ? AND message_id IN ?", session.ID.String(), req.MessageIDs).
		Updates(map[string]interface{}{
			"is_read": true,
			"status":  "read",
		}).Error

	if err != nil {
		log.Printf("⚠️ Failed to update database for read messages: %v", err)
	}

	// === CLEAR REDIS CACHE ===
	if h.RedisCache != nil && h.RedisCache.IsAvailable() {
		ctx := context.Background()
		chatKey := fmt.Sprintf("chats:data:%s:%s", session.ID.String(), chatJID.String())

		// Reset the unread count in Redis to 0 to reflect the read state
		h.RedisCache.HSet(ctx, chatKey, "unread_count", 0)
	}

	log.Printf("✅ Mark-read request completed for %d messages in chat %s", len(req.MessageIDs), req.ChatJID)

	return c.Status(fiber.StatusOK).JSON(response.NewSuccessResponse("Messages marked as read", nil))
}

// SendTyping sends typing notification
// @Summary Send typing indicator
// @Description Send typing or stopped-typing indicator to a chat
// @Tags WhatsApp Messages
// @Accept json
// @Produce json
// @Param request body dto.SendTypingRequest true "Typing request"
// @Success 200 {object} response.WhatsAppBaseResponse
// @Failure 400 {object} response.ErrorResponse
// @Router /whatsapp/v1/messages/typing [post]
func (h *Handler) SendTyping(c *fiber.Ctx) error {
	var req dto.SendTypingRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(response.ErrorResponse{
			Success: false,
			Message: "Invalid request body",
			Error:   err.Error(),
		})
	}

	if connection.WhatsAppClient == nil || !connection.WhatsAppClient.IsLoggedIn() {
		return c.Status(fiber.StatusServiceUnavailable).JSON(response.ErrorResponse{
			Success: false,
			Message: "WhatsApp client not connected",
			Error:   "Client not available or not logged in",
		})
	}

	// Parse chat JID
	_, err := types.ParseJID(req.ChatJID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(response.ErrorResponse{
			Success: false,
			Message: "Invalid chat JID",
			Error:   err.Error(),
		})
	}

	// Send typing notification
	var presence types.Presence
	if req.IsTyping {
		presence = "composing"
	} else {
		presence = "available"
	}

	err = connection.WhatsAppClient.SendPresence(context.Background(), presence)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(response.ErrorResponse{
			Success: false,
			Message: "Failed to send presence",
			Error:   err.Error(),
		})
	}

	return c.Status(fiber.StatusOK).JSON(response.NewSuccessResponse("Typing notification sent", nil))
}
