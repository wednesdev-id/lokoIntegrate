package contact

import (
	"context"
	"database/sql"
	"loko/server/cache"
	"loko/server/connection"
	"loko/server/dto"
	"loko/server/response"
	"time"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

// Handler handles contact-related HTTP requests
type Handler struct {
	DB    *gorm.DB
	SqlDB *sql.DB
	Cache cache.ChatCache
}

// NewHandler creates a new contact handler
func NewHandler(db *gorm.DB, sqlDB *sql.DB, cache cache.ChatCache) *Handler {
	return &Handler{
		DB:    db,
		SqlDB: sqlDB,
		Cache: cache,
	}
}

// GetContacts retrieves all WhatsApp contacts
// @Summary Get WhatsApp contacts
// @Description Get list of all WhatsApp contacts
// @Tags WhatsApp Contacts
// @Accept json
// @Produce json
// @Success 200 {object} response.WhatsAppBaseResponse
// @Failure 503 {object} response.ErrorResponse
// @Router /whatsapp/contacts [get]
func (h *Handler) GetContacts(c *fiber.Ctx) error {
	// Validate connection
	if connection.WhatsAppClient == nil || !connection.WhatsAppClient.IsConnected() {
		return c.Status(fiber.StatusServiceUnavailable).JSON(response.ErrorResponse{
			Success: false,
			Message: "WhatsApp client not connected",
			Error:   "Please connect to WhatsApp first",
		})
	}

	// Get contacts from WhatsApp
	contacts, err := connection.WhatsAppClient.Store.Contacts.GetAllContacts(context.Background())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(response.ErrorResponse{
			Success: false,
			Message: "Failed to get contacts",
			Error:   err.Error(),
		})
	}

	// Convert to response format
	var contactResponses []dto.ContactResponse
	for jid, contact := range contacts {
		contactResponse := dto.ContactResponse{
			JID:         jid.String(),
			PhoneNumber: jid.User,
			Name:        contact.FullName,
			PushName:    &contact.PushName,
			IsBlocked:   false, // WhatsApp doesn't provide this info directly
			IsBusiness:  contact.BusinessName != "",
			CreatedAt:   time.Now(),
			UpdatedAt:   time.Now(),
		}

		if contact.BusinessName != "" {
			contactResponse.BusinessName = &contact.BusinessName
		}

		contactResponses = append(contactResponses, contactResponse)
	}

	return c.Status(fiber.StatusOK).JSON(response.NewSuccessResponse("Contacts retrieved successfully", map[string]interface{}{
		"contacts": contactResponses,
		"total":    len(contactResponses),
	}))
}
