package status

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"loko/server/cache"
	"loko/server/connection"
	"loko/server/dto"
	"loko/server/model"
	"loko/server/response"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v2"
	waProto "go.mau.fi/whatsmeow/binary/proto"
	"go.mau.fi/whatsmeow/types"
	"gorm.io/gorm"
)

// Handler handles status-related HTTP requests
type Handler struct {
	DB    *gorm.DB
	SqlDB *sql.DB
	Cache cache.ChatCache
}

// NewHandler creates a new status handler
func NewHandler(db *gorm.DB, sqlDB *sql.DB, cache cache.ChatCache) *Handler {
	return &Handler{
		DB:    db,
		SqlDB: sqlDB,
		Cache: cache,
	}
}

// SendStatus sends a WhatsApp status message
// @Summary Send WhatsApp status
// @Description Send text, image, or video status message to WhatsApp
// @Tags WhatsApp Status
// @Accept json
// @Produce json
// @Param status body dto.SendStatusRequest true "Status data"
// @Success 200 {object} response.WhatsAppBaseResponse
// @Failure 400 {object} response.ErrorResponse
// @Failure 503 {object} response.ErrorResponse
// @Router /whatsapp/status/send [post]
func (h *Handler) SendStatus(c *fiber.Ctx) error {
	var req dto.SendStatusRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(response.ErrorResponse{
			Success: false,
			Message: "Invalid request body",
			Error:   err.Error(),
		})
	}

	client := connection.WhatsAppClient
	if client == nil || !client.IsConnected() {
		return c.Status(fiber.StatusServiceUnavailable).JSON(response.ErrorResponse{
			Success: false,
			Message: "WhatsApp client not connected",
			Error:   "Please connect to WhatsApp first",
		})
	}

	// Create status message based on type
	var statusMessage *waProto.Message

	switch req.Type {
	case "text":
		if req.Content == nil {
			return c.Status(fiber.StatusBadRequest).JSON(response.ErrorResponse{
				Success: false,
				Message: "Content is required for text status",
				Error:   "Missing content field",
			})
		}
		statusMessage = &waProto.Message{
			ExtendedTextMessage: &waProto.ExtendedTextMessage{
				Text: req.Content,
			},
		}
	case "image", "video":
		if req.MediaURL == nil {
			return c.Status(fiber.StatusBadRequest).JSON(response.ErrorResponse{
				Success: false,
				Message: "Media URL is required for media status",
				Error:   "Missing media_url field",
			})
		}
		// For status messages, we'll create a simple text message with media info
		caption := "Media status"
		if req.Caption != nil {
			caption = *req.Caption
		}
		statusMessage = &waProto.Message{
			ExtendedTextMessage: &waProto.ExtendedTextMessage{
				Text: &caption,
			},
		}
	default:
		return c.Status(fiber.StatusBadRequest).JSON(response.ErrorResponse{
			Success: false,
			Message: "Invalid status type",
			Error:   "Supported types: text, image, video",
		})
	}

	// Send status (broadcast to status)
	statusJID := types.NewJID(client.Store.ID.User, types.BroadcastServer)
	resp, err := client.SendMessage(context.Background(), statusJID, statusMessage)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(response.ErrorResponse{
			Success: false,
			Message: "Failed to send status",
			Error:   err.Error(),
		})
	}

	// Save status to database
	status := model.WhatsAppMessage{
		SenderJID:   client.Store.ID.User,
		ChatJID:     statusJID.String(),
		MessageID:   resp.ID,
		MessageType: req.Type,
		Content:     "",
		IsFromMe:    true,
		Timestamp:   resp.Timestamp,
		Status:      "sent",
		CreatedAt:   time.Now(),
	}

	if req.Content != nil {
		status.Content = *req.Content
	}
	if req.MediaURL != nil {
		status.MediaURL = req.MediaURL
	}

	log.Printf("Status sent: %s", resp.ID)

	return c.Status(fiber.StatusOK).JSON(response.WhatsAppBaseResponse{
		Success: true,
		Message: "Status sent successfully",
		Data: dto.StatusResponse{
			ID:        fmt.Sprintf("%d", status.ID),
			JID:       status.SenderJID,
			StatusID:  resp.ID,
			Type:      req.Type,
			Content:   req.Content,
			MediaURL:  req.MediaURL,
			Timestamp: resp.Timestamp,
			ExpiresAt: resp.Timestamp.Add(24 * time.Hour), // Status expires after 24 hours
			CreatedAt: time.Now(),
		},
	})
}

// GetStatus retrieves WhatsApp status messages with pagination
// @Summary Get WhatsApp status messages
// @Description Retrieve sent status messages with pagination support
// @Tags WhatsApp Status
// @Accept json
// @Produce json
// @Param page query int false "Page number" default(1)
// @Param limit query int false "Items per page" default(10)
// @Success 200 {object} response.GetStatusSuccessResponse
// @Failure 400 {object} response.ErrorResponse
// @Failure 503 {object} response.ErrorResponse
// @Router /whatsapp/status [get]
func (h *Handler) GetStatus(c *fiber.Ctx) error {
	client := connection.WhatsAppClient
	if client == nil || !client.IsConnected() {
		return c.Status(fiber.StatusServiceUnavailable).JSON(response.ErrorResponse{
			Success: false,
			Message: "WhatsApp client not connected",
			Error:   "Please connect to WhatsApp first",
		})
	}

	// Parse query parameters
	limitStr := c.Query("limit", "20")
	offsetStr := c.Query("offset", "0")

	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}

	offset, err := strconv.Atoi(offsetStr)
	if err != nil || offset < 0 {
		offset = 0
	}

	// Get status messages from database
	// Logic: Groups statuses by SenderJID and returns the latest status for each sender (like WhatsApp UI)
	type StatusGroup struct {
		SenderJID     string
		LastStatusID  string
		LastType      string
		LastContent   string
		LastMediaURL  string
		LastTimestamp time.Time
		Count         int
	}

	var statusGroups []StatusGroup
	
	// Query to get latest status per sender in last 24 hours
	// Note: This is a simplification. Ideally we want all valid statuses per user.
	// For the list view, we just need the preview (latest one).
	cutoff := time.Now().Add(-24 * time.Hour)
	
	err = h.DB.Model(&model.WhatsAppMessage{}).
		Select("sender_j_id, MAX(message_id) as last_status_id, MAX(timestamp) as last_timestamp, COUNT(*) as count").
		Where("chat_j_id = ? AND timestamp > ?", "status@broadcast", cutoff).
		Group("sender_j_id").
		Order("last_timestamp DESC").
		Limit(limit).
		Offset(offset).
		Scan(&statusGroups).Error

	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(response.ErrorResponse{
			Success: false,
			Message: "Failed to retrieve statuses",
			Error:   err.Error(),
		})
	}

	// Fetch details for the latest status of each user
	var statusResponses []dto.StatusResponse
	
	for _, group := range statusGroups {
		// Get full message details for the latest status
		var msg model.WhatsAppMessage
		h.DB.Where("message_id = ?", group.LastStatusID).First(&msg)
		
		// Map to DTO
		resp := dto.StatusResponse{
			ID:        group.SenderJID, // Group ID is the Sender
			JID:       group.SenderJID,
			StatusID:  group.LastStatusID, // Latest status ID
			Type:      msg.MessageType,
			Timestamp: group.LastTimestamp,
			ExpiresAt: group.LastTimestamp.Add(24 * time.Hour),
            CreatedAt: msg.CreatedAt,
		}
		
		if msg.Content != "" {
			resp.Content = &msg.Content
		}
		if msg.MediaURL != nil {
			resp.MediaURL = msg.MediaURL
		}
		
		statusResponses = append(statusResponses, resp)
	}
	
	// If empty, return empty slice not null
	if statusResponses == nil {
		statusResponses = []dto.StatusResponse{}
	}

	pagination := response.CalculatePagination(offset/limit+1, limit, int64(len(statusResponses))) // Approx total

	return c.Status(fiber.StatusOK).JSON(response.GetStatusSuccessResponse{
		Success:    true,
		Message:    "Status messages retrieved successfully",
		Data:       statusResponses,
		Pagination: pagination,
	})
}

// Helper function to create string pointer
func stringPtr(s string) *string {
	return &s
}
