package broadcast

import (
	"database/sql"
	"errors"
	"loko/server/connection"
	"loko/server/model"
	"loko/server/response"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Handler handles broadcast schedule HTTP requests
type Handler struct {
	DB    *gorm.DB
	SqlDB *sql.DB
}

// NewHandler creates a new broadcast handler
func NewHandler(db *gorm.DB, sqlDB *sql.DB) *Handler {
	return &Handler{DB: db, SqlDB: sqlDB}
}

// validateSessionCode checks that session_code is provided and matches the session.
// Returns the resolved session model on success.
func validateSessionCode(sessionManager *connection.SessionManager, sessionID, sessionCode string) (*model.WhatsAppSessionModel, error) {
	if sessionCode == "" {
		return nil, errors.New("session_code is required")
	}
	session, err := sessionManager.GetSession(sessionID)
	if err != nil {
		return nil, errors.New("session not found")
	}
	if err := sessionManager.ValidateSession(session.ID.String(), sessionCode); err != nil {
		return nil, errors.New("invalid session_code")
	}
	return session, nil
}

// CreateBroadcastRequest is the request body for creating a broadcast schedule
type CreateBroadcastRequest struct {
	SessionID     string   `json:"session_id"`
	SessionCode   string   `json:"session_code"`
	BroadcastType string   `json:"broadcast_type"` // "individual" | "group"
	Recipients    []string `json:"recipients"`
	Message       string   `json:"message"`
	Caption       string   `json:"caption"`
	MediaURL      *string  `json:"media_url"`
	MessageType   string   `json:"message_type"` // text/image/video
	DelayMs       int      `json:"delay_ms"`
	UseUniqueCode bool     `json:"use_unique_code"`
	ScheduledAt   string   `json:"scheduled_at"` // RFC3339 e.g. "2026-03-20T15:00:00+07:00"
}

// CreateBroadcast creates a new broadcast schedule
// POST /api/whatsapp/v1/broadcasts
func (h *Handler) CreateBroadcast(c *fiber.Ctx) error {
	var req CreateBroadcastRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(response.ErrorResponse{
			Success: false,
			Message: "Invalid request body",
			Error:   err.Error(),
		})
	}

	if req.SessionID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(response.ErrorResponse{
			Success: false,
			Message: "session_id is required",
		})
	}
	if len(req.Recipients) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(response.ErrorResponse{
			Success: false,
			Message: "recipients cannot be empty",
		})
	}
	if req.Message == "" && req.MediaURL == nil {
		return c.Status(fiber.StatusBadRequest).JSON(response.ErrorResponse{
			Success: false,
			Message: "message or media_url is required",
		})
	}

	// Validate session + session_code
	sessionManager := connection.GetSessionManager(h.DB, h.SqlDB)
	session, err := validateSessionCode(sessionManager, req.SessionID, req.SessionCode)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(response.ErrorResponse{
			Success: false,
			Message: "Unauthorized: " + err.Error(),
		})
	}

	// Parse scheduled_at
	var scheduledAt time.Time
	if req.ScheduledAt != "" {
		scheduledAt, err = time.Parse(time.RFC3339, req.ScheduledAt)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(response.ErrorResponse{
				Success: false,
				Message: "Invalid scheduled_at format — use RFC3339 (e.g. 2026-03-20T15:00:00+07:00)",
				Error:   err.Error(),
			})
		}
	} else {
		// Send immediately — schedule 1s from now so the scheduler picks it up right away
		scheduledAt = time.Now().Add(1 * time.Second)
	}

	broadcastType := req.BroadcastType
	if broadcastType == "" {
		broadcastType = "individual"
	}
	messageType := req.MessageType
	if messageType == "" {
		messageType = "text"
	}
	delayMs := req.DelayMs
	if delayMs <= 0 {
		delayMs = 1000
	}

	// Get user_id from auth context
	userID, _ := c.Locals("user_id").(string)
	if userID == "" {
		userID = session.UserID
	}

	schedule := model.BroadcastSchedule{
		SessionID:     session.ID.String(),
		SessionCode:   req.SessionCode,
		UserID:        userID,
		BroadcastType: broadcastType,
		Recipients:    model.StringSlice(req.Recipients),
		Message:       req.Message,
		Caption:       req.Caption,
		MediaURL:      req.MediaURL,
		MessageType:   messageType,
		DelayMs:       delayMs,
		UseUniqueCode: req.UseUniqueCode,
		ScheduledAt:   scheduledAt,
		Status:        "pending",
	}

	if err := h.DB.Create(&schedule).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(response.ErrorResponse{
			Success: false,
			Message: "Failed to create broadcast schedule",
			Error:   err.Error(),
		})
	}

	return c.Status(fiber.StatusCreated).JSON(response.NewSuccessResponse("Broadcast schedule created", schedule))
}

// ListBroadcasts lists broadcast schedules for the authenticated session
// GET /api/whatsapp/v1/broadcasts?session_id=...&session_code=...&status=...
func (h *Handler) ListBroadcasts(c *fiber.Ctx) error {
	sessionID := c.Query("session_id")
	sessionCode := c.Query("session_code")
	statusFilter := c.Query("status")

	if sessionID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(response.ErrorResponse{
			Success: false,
			Message: "session_id is required",
		})
	}

	sessionManager := connection.GetSessionManager(h.DB, h.SqlDB)
	session, err := validateSessionCode(sessionManager, sessionID, sessionCode)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(response.ErrorResponse{
			Success: false,
			Message: "Unauthorized: " + err.Error(),
		})
	}

	query := h.DB.Where("session_id = ? AND session_code = ?", session.ID.String(), sessionCode)
	if statusFilter != "" {
		query = query.Where("status = ?", statusFilter)
	}

	var schedules []model.BroadcastSchedule
	if err := query.Order("created_at DESC").Find(&schedules).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(response.ErrorResponse{
			Success: false,
			Message: "Failed to retrieve broadcast schedules",
			Error:   err.Error(),
		})
	}

	return c.Status(fiber.StatusOK).JSON(response.NewSuccessResponse("Broadcast schedules retrieved", map[string]interface{}{
		"schedules": schedules,
		"total":     len(schedules),
	}))
}

// CancelBroadcast cancels a pending broadcast schedule
// DELETE /api/whatsapp/v1/broadcasts/:id?session_id=...&session_code=...
func (h *Handler) CancelBroadcast(c *fiber.Ctx) error {
	idStr := c.Params("id")
	sessionID := c.Query("session_id")
	sessionCode := c.Query("session_code")

	id, err := uuid.Parse(idStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(response.ErrorResponse{
			Success: false,
			Message: "Invalid broadcast ID",
		})
	}

	// Validate session_code
	sessionManager := connection.GetSessionManager(h.DB, h.SqlDB)
	session, err := validateSessionCode(sessionManager, sessionID, sessionCode)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(response.ErrorResponse{
			Success: false,
			Message: "Unauthorized: " + err.Error(),
		})
	}

	// Find schedule and verify ownership via session_id + session_code
	var schedule model.BroadcastSchedule
	if err := h.DB.Where("id = ? AND session_id = ? AND session_code = ?",
		id, session.ID.String(), sessionCode).First(&schedule).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(response.ErrorResponse{
			Success: false,
			Message: "Broadcast schedule not found",
		})
	}

	if schedule.Status != "pending" {
		return c.Status(fiber.StatusBadRequest).JSON(response.ErrorResponse{
			Success: false,
			Message: "Only pending schedules can be cancelled (current status: " + schedule.Status + ")",
		})
	}

	if err := h.DB.Model(&schedule).Update("status", "cancelled").Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(response.ErrorResponse{
			Success: false,
			Message: "Failed to cancel broadcast schedule",
			Error:   err.Error(),
		})
	}

	return c.Status(fiber.StatusOK).JSON(response.NewSuccessResponse("Broadcast schedule cancelled", nil))
}

// SendBroadcastNow triggers an immediate send for a pending broadcast
// POST /api/whatsapp/v1/broadcasts/:id/send?session_id=...&session_code=...
func (h *Handler) SendBroadcastNow(c *fiber.Ctx) error {
	idStr := c.Params("id")
	sessionID := c.Query("session_id")
	sessionCode := c.Query("session_code")

	id, err := uuid.Parse(idStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(response.ErrorResponse{
			Success: false,
			Message: "Invalid broadcast ID",
		})
	}

	sessionManager := connection.GetSessionManager(h.DB, h.SqlDB)
	session, err := validateSessionCode(sessionManager, sessionID, sessionCode)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(response.ErrorResponse{
			Success: false,
			Message: "Unauthorized: " + err.Error(),
		})
	}

	var schedule model.BroadcastSchedule
	if err := h.DB.Where("id = ? AND session_id = ? AND session_code = ?",
		id, session.ID.String(), sessionCode).First(&schedule).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(response.ErrorResponse{
			Success: false,
			Message: "Broadcast schedule not found",
		})
	}

	if schedule.Status != "pending" && schedule.Status != "failed" {
		return c.Status(fiber.StatusBadRequest).JSON(response.ErrorResponse{
			Success: false,
			Message: "Only pending or failed schedules can be sent now (current status: " + schedule.Status + ")",
		})
	}

	// Trigger async send immediately
	go ProcessBroadcast(h.DB, h.SqlDB, schedule)

	return c.Status(fiber.StatusOK).JSON(response.NewSuccessResponse("Broadcast send triggered", nil))
}

// GetBroadcastHistory returns per-recipient delivery status for a broadcast schedule
// GET /api/whatsapp/v1/broadcasts/:id/history?session_id=...&session_code=...
func (h *Handler) GetBroadcastHistory(c *fiber.Ctx) error {
	idStr := c.Params("id")
	sessionID := c.Query("session_id")
	sessionCode := c.Query("session_code")

	id, err := uuid.Parse(idStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(response.ErrorResponse{
			Success: false,
			Message: "Invalid broadcast ID",
		})
	}

	sessionManager := connection.GetSessionManager(h.DB, h.SqlDB)
	session, err := validateSessionCode(sessionManager, sessionID, sessionCode)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(response.ErrorResponse{
			Success: false,
			Message: "Unauthorized: " + err.Error(),
		})
	}

	var schedule model.BroadcastSchedule
	if err := h.DB.Where("id = ? AND session_id = ? AND session_code = ?",
		id, session.ID.String(), sessionCode).First(&schedule).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(response.ErrorResponse{
			Success: false,
			Message: "Broadcast schedule not found",
		})
	}

	var items []model.BroadcastRecipientStatus
	if err := h.DB.Where("broadcast_id = ?", schedule.ID).
		Order("id ASC").
		Find(&items).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(response.ErrorResponse{
			Success: false,
			Message: "Failed to retrieve broadcast history",
			Error:   err.Error(),
		})
	}

	sent := 0
	failed := 0
	pending := 0
	for _, item := range items {
		switch item.Status {
		case "sent":
			sent++
		case "failed":
			failed++
		default:
			pending++
		}
	}

	return c.Status(fiber.StatusOK).JSON(response.NewSuccessResponse("Broadcast history retrieved", map[string]interface{}{
		"schedule": schedule,
		"items":    items,
		"summary": map[string]int{
			"total":   len(items),
			"sent":    sent,
			"failed":  failed,
			"pending": pending,
		},
	}))
}

// RetryFailedRecipients creates a new schedule containing only failed recipients from the source broadcast.
// POST /api/whatsapp/v1/broadcasts/:id/retry-failed?session_id=...&session_code=...
func (h *Handler) RetryFailedRecipients(c *fiber.Ctx) error {
	idStr := c.Params("id")
	sessionID := c.Query("session_id")
	sessionCode := c.Query("session_code")

	id, err := uuid.Parse(idStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(response.ErrorResponse{
			Success: false,
			Message: "Invalid broadcast ID",
		})
	}

	sessionManager := connection.GetSessionManager(h.DB, h.SqlDB)
	session, err := validateSessionCode(sessionManager, sessionID, sessionCode)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(response.ErrorResponse{
			Success: false,
			Message: "Unauthorized: " + err.Error(),
		})
	}

	var source model.BroadcastSchedule
	if err := h.DB.Where("id = ? AND session_id = ? AND session_code = ?",
		id, session.ID.String(), sessionCode).First(&source).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(response.ErrorResponse{
			Success: false,
			Message: "Broadcast schedule not found",
		})
	}

	var failedItems []model.BroadcastRecipientStatus
	if err := h.DB.Where("broadcast_id = ? AND status = ?", source.ID, "failed").
		Order("id ASC").
		Find(&failedItems).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(response.ErrorResponse{
			Success: false,
			Message: "Failed to load failed recipients",
			Error:   err.Error(),
		})
	}
	if len(failedItems) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(response.ErrorResponse{
			Success: false,
			Message: "No failed recipients to retry",
		})
	}

	recipients := make([]string, 0, len(failedItems))
	seen := make(map[string]bool)
	for _, item := range failedItems {
		value := item.RecipientInput
		if value == "" {
			value = item.ResolvedJID
		}
		if value != "" && !seen[value] {
			seen[value] = true
			recipients = append(recipients, value)
		}
	}
	if len(recipients) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(response.ErrorResponse{
			Success: false,
			Message: "No valid failed recipients to retry",
		})
	}

	userID, _ := c.Locals("user_id").(string)
	if userID == "" {
		userID = source.UserID
	}

	retrySchedule := model.BroadcastSchedule{
		SessionID:     source.SessionID,
		SessionCode:   source.SessionCode,
		UserID:        userID,
		BroadcastType: source.BroadcastType,
		Recipients:    model.StringSlice(recipients),
		Message:       source.Message,
		Caption:       source.Caption,
		MediaURL:      source.MediaURL,
		MessageType:   source.MessageType,
		DelayMs:       source.DelayMs,
		UseUniqueCode: source.UseUniqueCode,
		ScheduledAt:   time.Now().Add(1 * time.Second),
		Status:        "pending",
	}

	if err := h.DB.Create(&retrySchedule).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(response.ErrorResponse{
			Success: false,
			Message: "Failed to create retry schedule",
			Error:   err.Error(),
		})
	}

	return c.Status(fiber.StatusOK).JSON(response.NewSuccessResponse("Retry for failed recipients created", retrySchedule))
}
