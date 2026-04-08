package contact

import (
	"bytes"
	"encoding/csv"
	"fmt"
	"log"
	"loko/server/connection"
	"loko/server/response"
	"loko/server/util"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v2"
)

// MasterDataContactResponse represents the response for master data contacts
type MasterDataContactResponse struct {
	ID          uint      `json:"id"`
	SessionID   string    `json:"session_id"`
	JID         string    `json:"jid"`
	Name        string    `json:"name"`
	PhoneNumber string    `json:"phone_number"`
	UserName    string    `json:"user_name"` // From User table
	CreatedAt   time.Time `json:"created_at"`
}

// cleanPhoneNumber ensures phone_number is a valid WhatsApp number (not an ID or JID)
func cleanPhoneNumber(phoneNumber, jid string) string {
	// If phone_number looks like a UUID or ID (contains dashes and letters), extract from JID instead
	if len(phoneNumber) == 36 && phoneNumber[8] == '-' && phoneNumber[13] == '-' {
		// Looks like UUID, extract from JID
		return util.ParseWhatsAppJID(jid)
	}

	// If phone_number contains @ (it's a JID), extract the user part
	if util.IsValidJID(phoneNumber) {
		return util.ParseWhatsAppJID(phoneNumber)
	}

	// Clean the phone number
	return util.CleanPhoneNumber(phoneNumber)
}

// GetMasterDataContacts retrieves all contacts for Super Admin
// @Summary Get all contacts (Master Data)
// @Description Retrieve all contacts with pagination, search, and filtering
// @Tags Super Admin
// @Accept json
// @Produce json
// @Param page query int false "Page number" default(1)
// @Param limit query int false "Limit results" default(50)
// @Param search query string false "Search by name or phone"
// @Param session_id query string false "Filter by Session ID"
// @Param session_code query string false "Session Code for validation (if session_id is provided)"
// @Success 200 {object} response.WhatsAppPaginatedResponse
// @Router /api/v1/whatsapp/admin/contacts [get]
func (h *Handler) GetMasterDataContacts(c *fiber.Ctx) error {
	pageStr := c.Query("page", "1")
	limitStr := c.Query("limit", "50")
	search := c.Query("search")
	sessionID := c.Query("session_id")
	sessionCode := c.Query("session_code")

	page, _ := strconv.Atoi(pageStr)
	limit, _ := strconv.Atoi(limitStr)
	if page <= 0 {
		page = 1
	}
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	offset := (page - 1) * limit

	// Validate Session Code if session_id is provided
	if sessionID != "" && sessionCode != "" {
		sessionManager := connection.GetSessionManager(h.DB, h.SqlDB)
		if err := sessionManager.ValidateSession(sessionID, sessionCode); err != nil {
			log.Printf("❌ ValidateSession failed for Super Admin: %v", err)
			return c.Status(fiber.StatusUnauthorized).JSON(response.ErrorResponse{
				Success: false,
				Message: "Unauthorized: Invalid session code",
				Error:   err.Error(),
			})
		}
	}

	// Build query with joins to get User information
	query := h.DB.Table("whatsapp_contacts").
		Select("whatsapp_contacts.*, users.name as user_name").
		Joins("LEFT JOIN whatsapp_sessions ON whatsapp_contacts.session_id = whatsapp_sessions.session_id").
		Joins("LEFT JOIN users ON whatsapp_sessions.user_id = users.id::text")

	// Apply filters
	if sessionID != "" {
		query = query.Where("whatsapp_contacts.session_id = ?", sessionID)
	}

	if search != "" {
		searchPattern := "%" + search + "%"
		query = query.Where("(whatsapp_contacts.name ILIKE ? OR whatsapp_contacts.phone_number ILIKE ?)", searchPattern, searchPattern)
	}

	// Get total count
	var total int64
	query.Count(&total)

	// Get data with pagination
	var contacts []MasterDataContactResponse
	err := query.Order("whatsapp_contacts.created_at DESC").
		Offset(offset).
		Limit(limit).
		Scan(&contacts).Error

	if err != nil {
		log.Printf("❌ Failed to query master data contacts: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(response.ErrorResponse{
			Success: false,
			Message: "Failed to retrieve contacts",
			Error:   err.Error(),
		})
	}

	// Clean phone numbers - ensure they are valid WhatsApp numbers, not IDs
	for i := range contacts {
		contacts[i].PhoneNumber = cleanPhoneNumber(contacts[i].PhoneNumber, contacts[i].JID)
	}

	pagination := response.CalculatePagination(page, limit, total)
	apiResponse := response.NewPaginatedResponse("Contacts retrieved successfully", contacts, pagination)

	return c.Status(fiber.StatusOK).JSON(apiResponse)
}

// ExportMasterDataContacts exports contacts to CSV
// @Summary Export all contacts to CSV
// @Description Export all contacts with filtering to CSV
// @Tags Super Admin
// @Produce text/csv
// @Param search query string false "Search by name or phone"
// @Param session_id query string false "Filter by Session ID"
// @Param session_code query string false "Session Code for validation (if session_id is provided)"
// @Router /api/v1/whatsapp/admin/contacts/export [get]
func (h *Handler) ExportMasterDataContacts(c *fiber.Ctx) error {
	search := c.Query("search")
	sessionID := c.Query("session_id")
	sessionCode := c.Query("session_code")

	// Validate Session Code if session_id is provided
	if sessionID != "" && sessionCode != "" {
		sessionManager := connection.GetSessionManager(h.DB, h.SqlDB)
		if err := sessionManager.ValidateSession(sessionID, sessionCode); err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(response.ErrorResponse{
				Success: false,
				Message: "Unauthorized: Invalid session code",
			})
		}
	}

	// Build query
	query := h.DB.Table("whatsapp_contacts").
		Select("whatsapp_contacts.*, users.name as user_name").
		Joins("LEFT JOIN whatsapp_sessions ON whatsapp_contacts.session_id = whatsapp_sessions.session_id").
		Joins("LEFT JOIN users ON whatsapp_sessions.user_id = users.id::text")

	if sessionID != "" {
		query = query.Where("whatsapp_contacts.session_id = ?", sessionID)
	}

	if search != "" {
		searchPattern := "%" + search + "%"
		query = query.Where("(whatsapp_contacts.name ILIKE ? OR whatsapp_contacts.phone_number ILIKE ?)", searchPattern, searchPattern)
	}

	var contacts []MasterDataContactResponse
	err := query.Order("whatsapp_contacts.created_at DESC").Scan(&contacts).Error

	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(response.ErrorResponse{
			Success: false,
			Message: "Failed to query contacts for export",
			Error:   err.Error(),
		})
	}

	// Generate CSV
	var buf bytes.Buffer
	writer := csv.NewWriter(&buf)

	// Write Header
	writer.Write([]string{"ID", "Session ID", "JID", "Name", "Phone Number", "Customer Name", "Created At"})

	// Write Data
	for _, contact := range contacts {
		// Clean phone number before exporting
		cleanPhone := cleanPhoneNumber(contact.PhoneNumber, contact.JID)
		writer.Write([]string{
			fmt.Sprintf("%d", contact.ID),
			contact.SessionID,
			contact.JID,
			contact.Name,
			cleanPhone,
			contact.UserName,
			contact.CreatedAt.Format("2006-01-02 15:04:05"),
		})
	}

	writer.Flush()

	// Set headers for file download
	c.Set("Content-Type", "text/csv")
	c.Set("Content-Disposition", "attachment; filename=contacts_export_"+time.Now().Format("20060102150405")+".csv")

	return c.Send(buf.Bytes())
}
