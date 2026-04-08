package message

import (
	"fmt"
	"log"
	"loko/server/connection"
	"loko/server/dto"
	"loko/server/model"
	"loko/server/response"
	"strconv"

	"github.com/gofiber/fiber/v2"
)

// GetMessages retrieves messages from database
// @Summary Get WhatsApp messages
// @Description Retrieve WhatsApp messages with filtering and pagination support
// @Tags WhatsApp Messages
// @Accept json
// @Produce json
// @Param session_id query string false "Filter by session ID"
// @Param chat_jid query string false "Filter by chat JID" example("6281234567890@s.whatsapp.net")
// @Param limit query int false "Limit results (max 100)" default(50)
// @Param offset query int false "Offset for pagination" default(0)
// @Param is_from_me query bool false "Filter by sender (true=sent, false=received)"
// @Success 200 {object} response.WhatsAppPaginatedResponse{data=[]dto.MessageResponse} "Messages retrieved successfully"
// @Failure 500 {object} response.ErrorResponse "Failed to retrieve messages"
// @Router /whatsapp/v1/messages [get]
func (h *Handler) GetMessages(c *fiber.Ctx) error {
	// Parse query parameters
	sessionID := c.Query("session_id")
	chatJID := c.Query("chat_jid")
	limitStr := c.Query("limit", "50")
	offsetStr := c.Query("offset", "0")
	isFromMeStr := c.Query("is_from_me")

	sessionCode := c.Query("session_code")
	log.Printf("🔍 GetMessages: Received request - session_id=%q, session_code=%q, chat_jid=%q, limit=%s, offset=%s", sessionID, sessionCode, chatJID, limitStr, offsetStr)

	limit, _ := strconv.Atoi(limitStr)
	offset, _ := strconv.Atoi(offsetStr)

	if limit <= 0 || limit > 100 {
		limit = 50
	}

	// Calculate page number for cache key
	page := (offset / limit) + 1

	// Build query
	query := h.DB.Model(&model.WhatsAppMessage{})

	// Apply filters
	var actualSessionID string
	if sessionID != "" {
		// Attempt to resolve session ID to actual UUID using session manager
		actualSessionID = sessionID
		sessionManager := connection.GetSessionManager(h.DB, h.SqlDB)
		if session, err := sessionManager.GetSession(sessionID); err == nil {
			log.Printf("✅ GetMessages: Session resolved %s -> %s", sessionID, session.ID.String())
			actualSessionID = session.ID.String()
		} else {
			log.Printf("⚠️ GetMessages: Session resolution failed for %s: %v (using original)", sessionID, err)
		}

		// session_code is mandatory to prevent cross-session data leakage
		sessionCodeVal := c.Query("session_code")
		log.Printf("🔍 GetMessages: Validating session_code=%q for session_id=%q", sessionCodeVal, actualSessionID)
		if sessionCodeVal == "" {
			return c.Status(fiber.StatusBadRequest).JSON(response.ErrorResponse{
				Success: false,
				Message: "session_code is required for session validation",
				Error:   "Missing session_code parameter",
			})
		}
		if err := sessionManager.ValidateSession(actualSessionID, sessionCodeVal); err != nil {
			log.Printf("❌ GetMessages: Session code validation failed: %v", err)
			return c.Status(fiber.StatusUnauthorized).JSON(response.ErrorResponse{
				Success: false,
				Message: "Unauthorized: Invalid session code",
				Error:   err.Error(),
			})
		}
		log.Printf("✅ GetMessages: Session code validated successfully")

		log.Printf("🔍 GetMessages: Filtering by session_id = %q", actualSessionID)
		query = query.Where("session_id = ?", actualSessionID)
	} else {
		// No session_id provided — use authenticated user's first connected session
		userID := c.Locals("user_id").(string)
		sessionManager := connection.GetSessionManager(h.DB, h.SqlDB)
		if sessions, err := sessionManager.GetUserSessions(userID); err == nil && len(sessions) > 0 {
			foundConnected := false
			for i := range sessions {
				if sessions[i].Status == "connected" {
					log.Printf("🔍 GetMessages: Using first connected session %s", sessions[i].ID.String())
					query = query.Where("session_id = ?", sessions[i].ID.String())
					actualSessionID = sessions[i].ID.String()
					foundConnected = true
					break
				}
			}
			if !foundConnected {
				log.Printf("🔍 GetMessages: No connected session, using first session %s", sessions[0].ID.String())
				query = query.Where("session_id = ?", sessions[0].ID.String())
				actualSessionID = sessions[0].ID.String()
			}
		}
	}
	if chatJID != "" {
		log.Printf("🔍 GetMessages: Filtering by chat_j_id = %q", chatJID)
		query = query.Where("chat_j_id = ?", chatJID)
	}
	if isFromMeStr != "" {
		isFromMe, _ := strconv.ParseBool(isFromMeStr)
		log.Printf("🔍 GetMessages: Filtering by is_from_me = %v", isFromMe)
		query = query.Where("is_from_me = ?", isFromMe)
	}

	// Get total count
	var total int64
	query.Model(&model.WhatsAppMessage{}).Count(&total)
	log.Printf("📊 GetMessages: Total messages matching filters: %d", total)

	// Get messages with pagination
	var messages []model.WhatsAppMessage
	result := query.Order("timestamp DESC").
		Limit(limit).
		Offset(offset).
		Find(&messages)

	if result.Error != nil {
		log.Printf("❌ GetMessages: Query failed: %v", result.Error)
		return c.Status(fiber.StatusInternalServerError).JSON(response.ErrorResponse{
			Success: false,
			Message: "Failed to retrieve messages",
			Error:   result.Error.Error(),
		})
	}

	log.Printf("✅ GetMessages: Retrieved %d messages (session_id=%s, chat_jid=%s)", len(messages), actualSessionID, chatJID)

	// Debug: Log first few messages to verify data
	if len(messages) > 0 {
		for i, msg := range messages {
			if i < 3 { // Only log first 3 messages
				contentPreview := msg.Content
				if len(contentPreview) > 50 {
					contentPreview = contentPreview[:50] + "..."
				}
				log.Printf("  📨 Msg[%d]: id=%s, chat_jid=%s, is_from_me=%v, content=%q", i, msg.MessageID, msg.ChatJID, msg.IsFromMe, contentPreview)
			}
		}
	} else {
		log.Printf("⚠️ GetMessages: No messages found! Checking if messages exist in DB...")
		// Debug: Check if ANY messages exist for this session
		var sessionMsgCount int64
		h.DB.Model(&model.WhatsAppMessage{}).Where("session_id = ?", actualSessionID).Count(&sessionMsgCount)
		log.Printf("  📊 Total messages for session %s: %d", actualSessionID, sessionMsgCount)

		// Debug: Check if ANY messages exist for this chat_jid (regardless of session)
		var chatMsgCount int64
		h.DB.Model(&model.WhatsAppMessage{}).Where("chat_j_id = ?", chatJID).Count(&chatMsgCount)
		log.Printf("  📊 Total messages for chat_j_id %s: %d", chatJID, chatMsgCount)
	}

	// Convert to response format
	var messageResponses []dto.MessageResponse
	for _, msg := range messages {
		mediaURL := ""
		if msg.MediaURL != nil {
			mediaURL = *msg.MediaURL
		}
		mediaType := ""
		if msg.MediaType != nil {
			mediaType = *msg.MediaType
		}

		// Extract quoted message fields
		quotedMsgID := ""
		if msg.QuotedMessageID != nil {
			quotedMsgID = *msg.QuotedMessageID
		}
		quotedContent := ""
		if msg.QuotedMessageContent != nil {
			quotedContent = *msg.QuotedMessageContent
		}
		quotedSender := ""
		if msg.QuotedMessageSender != nil {
			quotedSender = *msg.QuotedMessageSender
		}

		messageResponses = append(messageResponses, dto.MessageResponse{
			ID:                   fmt.Sprintf("%d", msg.ID),
			JID:                  msg.SenderJID,
			ChatJID:              msg.ChatJID,
			MessageID:            msg.MessageID,
			MessageType:          msg.MessageType,
			Content:              msg.Content,
			MediaURL:             &mediaURL,
			MediaType:            &mediaType,
			IsFromMe:             msg.IsFromMe,
			IsRead:               msg.IsRead,
			Timestamp:            msg.Timestamp,
			Status:               msg.Status,
			QuotedMessageID:      quotedMsgID,
			QuotedMessageContent: quotedContent,
			QuotedMessageSender:  quotedSender,
			CreatedAt:            msg.CreatedAt,
		})
	}

	// Calculate pagination
	pagination := response.CalculatePagination(page, limit, total)
	apiResponse := response.NewPaginatedResponse("Messages retrieved successfully", messageResponses, pagination)

	return c.Status(fiber.StatusOK).JSON(apiResponse)
}
