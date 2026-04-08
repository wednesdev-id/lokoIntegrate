package session

import (
	"context"
	"log"
	"loko/server/connection"
	"loko/server/dto"
	"loko/server/model"
	"loko/server/response"
	"loko/server/util"
	"strings"

	"github.com/gofiber/fiber/v2"
	waProto "go.mau.fi/whatsmeow/binary/proto"
	"go.mau.fi/whatsmeow/types"
	"google.golang.org/protobuf/proto"
)

// ContactResponse represents contact information
type ContactResponse struct {
	PhoneNumber    string  `json:"phone_number"`
	JID            string  `json:"jid"` // Raw JID
	Name           *string `json:"name,omitempty"`
	BusinessName   *string `json:"business_name,omitempty"`
	ProfilePicture *string `json:"profile_picture,omitempty"`
	Status         *string `json:"status,omitempty"`
}

// ChatResponse  represents chat information
type ChatResponse struct {
	ChatID          string  `json:"chat_id"`
	PhoneNumber     string  `json:"phone_number"`
	Name            *string `json:"name,omitempty"`
	LastMessage     *string `json:"last_message,omitempty"`
	LastMessageTime *string `json:"last_message_time,omitempty"`
	UnreadCount     int     `json:"unread_count"`
	ChatType        string  `json:"chat_type"` // "individual" or "group"
}

// SyncContactsFromWhatsApp syncs contacts from WhatsApp store to local database
func (h *Handler) SyncContactsFromWhatsApp(sessionID string) error {
	sessionManager := connection.GetSessionManager(h.DB, h.SqlDB)
	session, err := sessionManager.GetSession(sessionID)
	if err != nil {
		return err
	}

	client, ok := sessionManager.GetClient(session.ID)
	if !ok || !client.IsLoggedIn() {
		return nil // Cannot sync if not connected, but not an error for the caller
	}

	// Get contacts from WhatsApp client store
	contacts, err := client.Store.Contacts.GetAllContacts(context.Background())
	if err != nil {
		log.Printf("❌ Failed to get contacts from store for session %s: %v", sessionID, err)
		return err
	}

	log.Printf("📱 Found %d contacts in WhatsApp store for session %s", len(contacts), sessionID)

	// Begin transaction
	tx := h.DB.Begin()

	countNew := 0
	countUpdated := 0
	countSkipped := 0

	for jid, contact := range contacts {
		// Skip group contacts
		if jid.Server == "g.us" {
			continue
		}

		phoneNumber := jid.User
		name := contact.FullName
		if name == "" {
			name = contact.PushName
		}
		if name == "" {
			name = phoneNumber
		}

		// Upsert contact
		var existingContact model.WhatsAppContact
		result := tx.Where("session_id = ? AND jid = ?", session.SessionID, jid.String()).First(&existingContact)

		if result.Error == nil {
			// Update existing if changed
			if existingContact.Name != name {
				existingContact.Name = name
				existingContact.PhoneNumber = phoneNumber
				tx.Save(&existingContact)
				countUpdated++
				// log.Printf("🔄 Updated contact: %s (%s)", name, phoneNumber)
			} else {
				countSkipped++
			}
		} else {
			// Create new
			newContact := model.WhatsAppContact{
				SessionID:   session.SessionID,
				JID:         jid.String(),
				Name:        name,
				PhoneNumber: phoneNumber,
			}
			if err := tx.Create(&newContact).Error; err != nil {
				log.Printf("❌ Failed to create contact %s: %v", phoneNumber, err)
			} else {
				countNew++
				log.Printf("✅ New contact saved: %s (%s)", name, phoneNumber)
			}
		}
	}

	if err := tx.Commit().Error; err != nil {
		log.Printf("❌ Transaction commit failed: %v", err)
		return err
	}

	log.Printf("📊 Contact Sync Summary for %s: New=%d, Updated=%d, Skipped=%d, Total=%d",
		sessionID, countNew, countUpdated, countSkipped, len(contacts))

	return nil
}

// GetSessionContacts retrieves contacts for a specific WhatsApp session
// @Summary Get session contacts
// @Description Retrieve all contacts for a specific WhatsApp session
// @Tags WhatsApp Session
// @Accept json
// @Produce json
// @Param session_id path string true "Session ID"
// @Success 200 {object} response.WhatsAppBaseResponse
// @Failure 404 {object} response.ErrorResponse
// @Router /whatsapp/v1/sessions/{session_id}/contacts [get]
func (h *Handler) GetSessionContacts(c *fiber.Ctx) error {
	sessionIDStr := c.Params("session_id")

	// Get session first
	sessionManager := connection.GetSessionManager(h.DB, h.SqlDB)
	session, err := sessionManager.GetSession(sessionIDStr)
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

	// Try to sync contacts first (best effort)
	// We don't block response on sync error, just log it
	if err := h.SyncContactsFromWhatsApp(sessionIDStr); err != nil {
		// Log error but continue to serve from DB
		// log.Printf("Failed to sync contacts: %v", err)
	}

	// Retrieve contacts from local database
	// IMPORTANT: Use session.SessionID (from struct) not sessionIDStr (from URL/UUID)
	// The contacts are indexed by the string SessionID field, not the UUID PK.
	var contacts []model.WhatsAppContact
	if err := h.DB.Where("session_id = ?", session.SessionID).Find(&contacts).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(response.ErrorResponse{
			Success: false,
			Message: "Failed to retrieve contacts from database",
			Error:   err.Error(),
		})
	}

	var contactResponses = make([]ContactResponse, 0)
	for _, contact := range contacts {
		name := contact.Name
		// Clean phone number - ensure it's a valid WhatsApp number, not an ID or JID
		phoneNumber := contact.PhoneNumber
		if !util.IsValidPhoneNumber(phoneNumber) {
			// If phone number looks invalid (e.g., UUID or ID), extract from JID
			phoneNumber = util.ParseWhatsAppJID(contact.JID)
		}
		contactResp := ContactResponse{
			PhoneNumber: phoneNumber,
			JID:         contact.JID,
			Name:        &name,
		}
		contactResponses = append(contactResponses, contactResp)
	}

	return c.Status(fiber.StatusOK).JSON(response.NewSuccessResponse("Contacts retrieved successfully", contactResponses))
}

// GetSessionChats retrieves chat list for a specific WhatsApp session
// @Summary Get session chats
// @Description Retrieve all chats for a specific WhatsApp session
// @Tags WhatsApp Session
// @Accept json
// @Produce json
// @Param session_id path string true "Session ID"
// @Success 200 {object} response.WhatsAppBaseResponse
// @Failure 404 {object} response.ErrorResponse
// @Router /whatsapp/v1/sessions/{session_id}/chats [get]
func (h *Handler) GetSessionChats(c *fiber.Ctx) error {
	sessionIDStr := c.Params("session_id")

	// Get session first to get UUID
	sessionManager := connection.GetSessionManager(h.DB, h.SqlDB)
	session, err := sessionManager.GetSession(sessionIDStr)
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

	client, ok := sessionManager.GetClient(session.ID)
	if !ok {
		return c.Status(fiber.StatusNotFound).JSON(response.ErrorResponse{
			Success: false,
			Message: "Session not connected",
			Error:   "Client not found",
		})
	}

	if !client.IsLoggedIn() {
		return c.Status(fiber.StatusServiceUnavailable).JSON(response.ErrorResponse{
			Success: false,
			Message: "Session not connected",
			Error:   "Please connect the session first",
		})
	}

	// Get contacts for chat names
	contacts, _ := client.Store.Contacts.GetAllContacts(context.Background())

	var chatResponses []ChatResponse
	for jid, contact := range contacts {
		chatType := "individual"
		if jid.Server == "g.us" {
			chatType = "group"
		}

		chatResp := ChatResponse{
			ChatID:      jid.String(),
			PhoneNumber: jid.User,
			UnreadCount: 0, // TODO: Get actual unread count if available
			ChatType:    chatType,
		}

		// Get contact name
		if contact.FullName != "" {
			chatResp.Name = &contact.FullName
		} else if contact.PushName != "" {
			chatResp.Name = &contact.PushName
		}

		chatResponses = append(chatResponses, chatResp)
	}

	return c.Status(fiber.StatusOK).JSON(response.NewSuccessResponse("Chats retrieved successfully", chatResponses))
}

// SendMessageBySession sends a message using a specific WhatsApp session
// @Summary Send message by session
// @Description Send a WhatsApp message using a specific session
// @Tags WhatsApp Session
// @Accept json
// @Produce json
// @Param session_id path string true "Session ID"
// @Param message body dto.SendMessageBySessionRequest true "Message data"
// @Success 200 {object} response.WhatsAppBaseResponse
// @Failure 400 {object} response.ErrorResponse
// @Failure 404 {object} response.ErrorResponse
// @Router /whatsapp/v1/sessions/{session_id}/messages/send [post]
func (h *Handler) SendMessageBySession(c *fiber.Ctx) error {
	sessionIDStr := c.Params("session_id")

	var req dto.SendMessageBySessionRequest
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

	// Get session first to get UUID
	sessionManager := connection.GetSessionManager(h.DB, h.SqlDB)
	session, err := sessionManager.GetSession(sessionIDStr)
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

	client, ok := sessionManager.GetClient(session.ID)
	if !ok {
		return c.Status(fiber.StatusNotFound).JSON(response.ErrorResponse{
			Success: false,
			Message: "Session not connected",
			Error:   "Client not found",
		})
	}

	if !client.IsLoggedIn() {
		return c.Status(fiber.StatusServiceUnavailable).JSON(response.ErrorResponse{
			Success: false,
			Message: "Session not connected",
			Error:   "Please connect the session first",
		})
	}

	// Parse recipient phone number to JID
	phoneNumber := req.PhoneNumber
	if !strings.Contains(phoneNumber, "@") {
		// Assume it's a regular phone number
		phoneNumber = phoneNumber + "@s.whatsapp.net"
	}

	recipientJID, err := types.ParseJID(phoneNumber)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(response.ErrorResponse{
			Success: false,
			Message: "Invalid phone number format",
			Error:   err.Error(),
		})
	}

	// Create message
	message := &waProto.Message{
		Conversation: proto.String(req.Message),
	}

	// Send message
	resp, err := client.SendMessage(context.Background(), recipientJID, message)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(response.ErrorResponse{
			Success: false,
			Message: "Failed to send message",
			Error:   err.Error(),
		})
	}

	return c.Status(fiber.StatusOK).JSON(response.NewSuccessResponse("Message sent successfully", fiber.Map{
		"message_id": resp.ID,
		"timestamp":  resp.Timestamp.Unix(),
		"status":     "sent",
	}))
}
