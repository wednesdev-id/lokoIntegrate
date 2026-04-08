package session

import (
	"database/sql"
	"log"
	"loko/server/cache"
	"loko/server/connection"
	"loko/server/dto"
	"loko/server/response"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Handler handles session-related HTTP requests
type Handler struct {
	DB    *gorm.DB
	SqlDB *sql.DB
	Cache cache.ChatCache
}

// NewHandler creates a new session handler
func NewHandler(db *gorm.DB, sqlDB *sql.DB, cache cache.ChatCache) *Handler {
	return &Handler{
		DB:    db,
		SqlDB: sqlDB,
		Cache: cache,
	}
}

// CreateSession creates a new WhatsApp session
// @Summary Create new WhatsApp session
// @Description Create a new WhatsApp session for multi-device support
// @Tags WhatsApp Session
// @Accept json
// @Produce json
// @Param request body dto.CreateSessionRequest true "Session creation request"
// @Success 201 {object} response.WhatsAppBaseResponse{data=dto.SessionResponse}
// @Failure 400 {object} response.ErrorResponse
// @Failure 500 {object} response.ErrorResponse
// @Router /whatsapp/v1/sessions [post]
func (h *Handler) CreateSession(c *fiber.Ctx) error {
	var req dto.CreateSessionRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(response.ErrorResponse{
			Success: false,
			Message: "Invalid request body",
			Error:   err.Error(),
		})
	}

	if err := validateStruct(req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(response.ErrorResponse{
			Success: false,
			Message: "Validation failed",
			Error:   err.Error(),
		})
	}

	// Get user ID from authentication context (set by UseAuth middleware)
	userIDVal := c.Locals("user_id")
	userID, ok := userIDVal.(string)
	if !ok || userID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(response.ErrorResponse{
			Success: false,
			Message: "Unauthorized: user ID not found in context",
		})
	}

	sessionManager := connection.GetSessionManager(h.DB, h.SqlDB)
	session, err := sessionManager.CreateSession(userID, req.SessionName)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(response.ErrorResponse{
			Success: false,
			Message: "Failed to create session",
			Error:   err.Error(),
		})
	}

	sessionResponse := dto.SessionResponse{
		SessionID:   session.ID.String(), // Use UUID primary key, not deprecated SessionID string
		SessionCode: session.SessionCode, // New field
		SessionName: session.SessionName,
		Status:      session.Status,
		AIAutoReply: session.AIAutoReply,
		AIPrompt:    session.AIPrompt,
		CreatedAt:   session.CreatedAt,
		UpdatedAt:   session.UpdatedAt,
	}

	return c.Status(fiber.StatusCreated).JSON(response.NewSuccessResponse("Session created successfully", sessionResponse))
}

// ListSessions lists all WhatsApp sessions for the current user
// @Summary List WhatsApp sessions
// @Description Get all WhatsApp sessions for the authenticated user
// @Tags WhatsApp Session
// @Accept json
// @Produce json
// @Success 200 {object} response.WhatsAppBaseResponse{data=dto.ListSessionsResponse}
// @Failure 500 {object} response.ErrorResponse
// @Router /whatsapp/v1/sessions [get]
func (h *Handler) ListSessions(c *fiber.Ctx) error {
	// Get user ID from authentication context (set by UseAuth middleware)
	userIDVal := c.Locals("user_id")
	userID, ok := userIDVal.(string)
	if !ok || userID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(response.ErrorResponse{
			Success: false,
			Message: "Unauthorized: user ID not found in context",
		})
	}

	sessionManager := connection.GetSessionManager(h.DB, h.SqlDB)
	sessions, err := sessionManager.GetUserSessions(userID)
	if err != nil {
		log.Printf("ERROR: Failed to get sessions for userID %s: %v", userID, err)
		return c.Status(fiber.StatusInternalServerError).JSON(response.ErrorResponse{
			Success: false,
			Message: "Failed to get sessions",
			Error:   err.Error(),
		})
	}

	var sessionResponses []dto.SessionResponse
	for _, session := range sessions {
		sessionResp := dto.SessionResponse{
			SessionID:   session.ID.String(), // Use UUID primary key, not SessionID string field
			SessionCode: session.SessionCode, // New field
			SessionName: session.SessionName,
			Status:      session.Status,
			AIAutoReply: session.AIAutoReply,
			AIPrompt:    session.AIPrompt,
			CreatedAt:   session.CreatedAt,
			UpdatedAt:   session.UpdatedAt,
		}
		if session.PhoneNumber != nil && *session.PhoneNumber != "" {
			sessionResp.PhoneNumber = session.PhoneNumber
		}
		if client, exists := sessionManager.GetClient(session.ID); exists && client.IsConnected() {
			lastConnected := time.Now()
			sessionResp.LastConnected = &lastConnected
		}
		sessionResponses = append(sessionResponses, sessionResp)
	}

	listResponse := dto.ListSessionsResponse{
		Sessions: sessionResponses,
		Total:    len(sessionResponses),
	}

	return c.Status(fiber.StatusOK).JSON(response.NewSuccessResponse("Sessions retrieved successfully", listResponse))
}

// GetSessionDetail gets details of a specific session
// @Summary Get session details
// @Description Retrieve details of a specific WhatsApp session
// @Tags WhatsApp Session
// @Accept json
// @Produce json
// @Param session_id path string true "Session ID"
// @Success 200 {object} response.WhatsAppBaseResponse{data=dto.SessionResponse}
// @Failure 404 {object} response.ErrorResponse
// @Router /whatsapp/v1/sessions/{session_id} [get]
func (h *Handler) GetSessionDetail(c *fiber.Ctx) error {
	sessionID := c.Params("session_id")

	sessionManager := connection.GetSessionManager(h.DB, h.SqlDB)
	session, err := sessionManager.GetSession(sessionID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(response.ErrorResponse{
			Success: false,
			Message: "Session not found",
			Error:   err.Error(),
		})
	}

	// Validate user ownership
	userID := c.Locals("user_id").(string)
	if session.UserID != userID {
		return c.Status(fiber.StatusForbidden).JSON(response.ErrorResponse{
			Success: false,
			Message: "Access denied: you don't own this session",
		})
	}

	// Build response
	var phoneNumber *string
	if session.PhoneNumber != nil && *session.PhoneNumber != "" {
		phoneNumber = session.PhoneNumber
	}
	responseData := dto.SessionResponse{
		SessionID:   session.ID.String(), // Use UUID primary key, not deprecated SessionID string
		SessionCode: session.SessionCode, // New field
		SessionName: session.SessionName,
		Status:      session.Status,
		PhoneNumber: phoneNumber,
		AIAutoReply: session.AIAutoReply,
		AIPrompt:    session.AIPrompt,
		CreatedAt:   session.CreatedAt,
		UpdatedAt:   session.UpdatedAt,
	}

	// Check if client is connected
	if client, exists := sessionManager.GetClient(session.ID); exists && client.IsConnected() {
		lastConnected := time.Now()
		responseData.LastConnected = &lastConnected
	}

	return c.Status(fiber.StatusOK).JSON(response.NewSuccessResponse("Session retrieved successfully", responseData))
}

// DeleteSession deletes a WhatsApp session
// @Summary Delete session
// @Description Delete a WhatsApp session and cleanup resources
// @Tags WhatsApp Session
// @Accept json
// @Produce json
// @Param session_id path string true "Session ID"
// @Success 200 {object} response.WhatsAppBaseResponse
// @Failure 404 {object} response.ErrorResponse
// @Failure 500 {object} response.ErrorResponse
// @Router /whatsapp/v1/sessions/{session_id} [delete]
func (h *Handler) DeleteSession(c *fiber.Ctx) error {
	sessionID := c.Params("session_id")

	sessionManager := connection.GetSessionManager(h.DB, h.SqlDB)

	// Validate user ownership before deletion
	session, err := sessionManager.GetSession(sessionID)
	if err != nil {
		if strings.Contains(err.Error(), "not found") || strings.Contains(err.Error(), "record not found") {
			return c.Status(fiber.StatusNotFound).JSON(response.ErrorResponse{
				Success: false,
				Message: "Session not found",
				Error:   err.Error(),
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(response.ErrorResponse{
			Success: false,
			Message: "Failed to verify session",
			Error:   err.Error(),
		})
	}

	userID := c.Locals("user_id").(string)
	if session.UserID != userID {
		return c.Status(fiber.StatusForbidden).JSON(response.ErrorResponse{
			Success: false,
			Message: "Access denied: you don't own this session",
		})
	}

	// Pass sessionID as string, not UUID
	err = sessionManager.DeleteSession(sessionID)
	if err != nil {
		// Check if it's a "not found" error
		if strings.Contains(err.Error(), "not found") || strings.Contains(err.Error(), "record not found") {
			return c.Status(fiber.StatusNotFound).JSON(response.ErrorResponse{
				Success: false,
				Message: "Session not found",
				Error:   err.Error(),
			})
		}

		return c.Status(fiber.StatusInternalServerError).JSON(response.ErrorResponse{
			Success: false,
			Message: "Invalid request body",
			Error:   err.Error(),
		})
	}

	return c.Status(fiber.StatusOK).JSON(response.NewSuccessResponse("Session deleted successfully", nil))
}

// GetSessionQR gets QR code for a specific session
// @Summary Get session QR code
// @Description Retrieve QR code for WhatsApp session authentication
// @Tags WhatsApp Session
// @Accept json
// @Produce json
// @Param session_id path string true "Session ID"
// @Success 200 {object} response.WhatsAppBaseResponse{data=map[string]string}
// @Failure 404 {object} response.ErrorResponse
// @Router /whatsapp/v1/sessions/{session_id}/qr [get]
func (h *Handler) GetSessionQR(c *fiber.Ctx) error {
	sessionID := c.Params("session_id")

	sessionManager := connection.GetSessionManager(h.DB, h.SqlDB)

	// Validate user ownership
	session, err := sessionManager.GetSession(sessionID)
	if err == nil {
		userID := c.Locals("user_id").(string)
		if session.UserID != userID {
			return c.Status(fiber.StatusForbidden).JSON(response.ErrorResponse{
				Success: false,
				Message: "Access denied: you don't own this session",
			})
		}
	}
	qrCode, err := sessionManager.GetSessionQRCode(sessionID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(response.ErrorResponse{
			Success: false,
			Message: "Session not found",
			Error:   err.Error(),
		})
	}

	if qrCode == "" {
		return c.Status(fiber.StatusNotFound).JSON(response.ErrorResponse{
			Success: false,
			Message: "QR code not available",
			Error:   "Session may be already connected or not in connecting state",
		})
	}

	return c.Status(fiber.StatusOK).JSON(response.NewSuccessResponse("QR code retrieved", fiber.Map{
		"qr_code": qrCode,
	}))
}

// ConnectSession initiates connection for a WhatsApp session
// @Summary Connect session
// @Description Start WhatsApp connection process for a session (generates QR code)
// @Tags WhatsApp Session
// @Accept json
// @Produce json
// @Param session_id path string true "Session ID"
// @Success 200 {object} response.WhatsAppBaseResponse
// @Failure 404 {object} response.ErrorResponse
// @Failure 500 {object} response.ErrorResponse
// @Router /whatsapp/v1/sessions/{session_id}/connect [post]
func (h *Handler) ConnectSession(c *fiber.Ctx) error {
	sessionID := c.Params("session_id")

	sessionManager := connection.GetSessionManager(h.DB, h.SqlDB)
	session, err := sessionManager.GetSession(sessionID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(response.ErrorResponse{
			Success: false,
			Message: "Session not found",
			Error:   err.Error(),
		})
	}

	// Get user ID from authentication context
	userID := c.Locals("user_id").(string)
	if session.UserID != userID {
		return c.Status(fiber.StatusForbidden).JSON(response.ErrorResponse{
			Success: false,
			Message: "Access denied: you don't own this session",
		})
	}
	err = sessionManager.ConnectSession(session)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(response.ErrorResponse{
			Success: false,
			Message: "Failed to initiate connection",
			Error:   err.Error(),
		})
	}

	return c.Status(fiber.StatusOK).JSON(response.NewSuccessResponse("Connection initiated. Check QR code endpoint for authentication", nil))
}

// DisconnectSession disconnects a WhatsApp session
// @Summary Disconnect session
// @Description Disconnect an active WhatsApp session
// @Tags WhatsApp Session
// @Accept json
// @Produce json
// @Param session_id path string true "Session ID"
// @Success 200 {object} response.WhatsAppBaseResponse
// @Failure 404 {object} response.ErrorResponse
// @Failure 500 {object} response.ErrorResponse
// @Router /whatsapp/v1/sessions/{session_id}/disconnect [post]
func (h *Handler) DisconnectSession(c *fiber.Ctx) error {
	sessionID := c.Params("session_id")

	sessionManager := connection.GetSessionManager(h.DB, h.SqlDB)
	session, err := sessionManager.GetSession(sessionID)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			return c.Status(fiber.StatusNotFound).JSON(response.ErrorResponse{
				Success: false,
				Message: "Session not found",
				Error:   err.Error(),
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(response.ErrorResponse{
			Success: false,
		})
	}

	// Get user ID from authentication context
	userID := c.Locals("user_id").(string)
	if session.UserID != userID {
		return c.Status(fiber.StatusForbidden).JSON(response.ErrorResponse{
			Success: false,
			Message: "Access denied: you don't own this session",
		})
	}

	// Actually disconnect the session
	err = sessionManager.DisconnectSession(sessionID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(response.ErrorResponse{
			Success: false,
			Message: "Failed to disconnect session",
			Error:   err.Error(),
		})
	}

	return c.Status(fiber.StatusOK).JSON(response.NewSuccessResponse("Session disconnected successfully", nil))
}

// Simple validation function
func validateStruct(_ interface{}) error {
	// Basic validation - in production, use a proper validator
	return nil
}

type UpdateAIConfigReq struct {
	AIAutoReply bool    `json:"ai_auto_reply"`
	AIPrompt    string  `json:"ai_prompt"`
	APIKeyID    *string `json:"api_key_id,omitempty"`
	AIModel     string  `json:"ai_model"`
}

// UpdateAIConfig updates the AI auto reply configuration for a session
// @Summary Update AI config
// @Description Enable/Disable AI auto reply and set custom prompt
// @Tags WhatsApp Session
// @Accept json
// @Produce json
// @Param session_id path string true "Session ID"
// @Param request body UpdateAIConfigReq true "AI Config request"
// @Success 200 {object} response.WhatsAppBaseResponse
// @Failure 404 {object} response.ErrorResponse
// @Router /whatsapp/v1/sessions/{session_id}/ai-config [put]
func (h *Handler) UpdateAIConfig(c *fiber.Ctx) error {
	var req UpdateAIConfigReq
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(response.ErrorResponse{
			Success: false,
			Message: "Invalid request body",
			Error:   err.Error(),
		})
	}

	sessionID := c.Params("session_id")
	userID := c.Locals("user_id").(string)

	sessionManager := connection.GetSessionManager(h.DB, h.SqlDB)
	session, err := sessionManager.GetSession(sessionID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(response.ErrorResponse{
			Success: false,
			Message: "Session not found",
			Error:   err.Error(),
		})
	}

	if session.UserID != userID {
		return c.Status(fiber.StatusForbidden).JSON(response.ErrorResponse{
			Success: false,
			Message: "Access denied: you don't own this session",
		})
	}

	// Update DB
	updates := map[string]interface{}{
		"ai_auto_reply": req.AIAutoReply,
		"ai_prompt":     req.AIPrompt,
		"ai_model":      req.AIModel,
	}

	if req.APIKeyID != nil && *req.APIKeyID != "" {
		uid, err := uuid.Parse(*req.APIKeyID)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(response.ErrorResponse{
				Success: false,
				Message: "Invalid APIKeyID format",
			})
		}
		updates["api_key_id"] = uid
	} else {
		updates["api_key_id"] = nil
	}

	err = h.DB.Model(&session).Updates(updates).Error

	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(response.ErrorResponse{
			Success: false,
			Message: "Failed to update AI config",
			Error:   err.Error(),
		})
	}

	return c.Status(fiber.StatusOK).JSON(response.NewSuccessResponse("AI configuration updated successfully", nil))
}
