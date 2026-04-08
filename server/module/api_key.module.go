package module

import (
	"log"
	"loko/server/connection"
	"loko/server/middleware"
	"loko/server/model"
	"loko/server/variable"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type ApiKey struct{}

func (ref ApiKey) Route(api fiber.Router) {
	handler := ApiKeyHandler{}

	// Public endpoint for dropdown selection (e.g. Session AI Config)
	api.Get("/whatsapp/sessions/api-keys", middleware.UseAuth, handler.GetPublicApiKeys)

	// Admin endpoints
	apiKey := api.Group("/settings/api-keys", middleware.UseAuth)

	apiKey.Get("/", handler.GetApiKeys)
	apiKey.Post("/", handler.CreateApiKey)
	apiKey.Put("/:id", handler.UpdateApiKey)
	apiKey.Delete("/:id", handler.DeleteApiKey)
}

type ApiKeyHandler struct{}

type ApiKeyResponse struct {
	ID        uuid.UUID `json:"id"`
	Code      string    `json:"code"`
	Provider  string    `json:"provider"`
	Name      string    `json:"name"`
	Models    string    `json:"models"`
	IsActive  bool      `json:"is_active"`
}

// GetApiKeys retrieves all API keys for Super Admin
// @Summary List API Keys
// @Description Get all API keys with full metadata (masks payload)
// @Tags Super Admin
// @Produce json
// @Success 200 {object} fiber.Map
// @Router /settings/api-keys [get]
func (handler ApiKeyHandler) GetApiKeys(c *fiber.Ctx) error {
	roleCode := c.Locals("role_code")
	if roleCode != variable.SuperAdmin {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Only super admins can view api keys",
		})
	}

	sql := connection.SQL{}
	db, err := sql.Connect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Database connection failed"})
	}

	var keys []model.ApiKey
	if err := db.Order("created_at DESC").Find(&keys).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to retrieve keys"})
	}

	return c.JSON(fiber.Map{
		"api_keys": keys, // Key is already masked by json:"-"
	})
}

// GetPublicApiKeys retrieves active keys for selection list
// @Summary List Available API Keys
// @Description Get list of active keys suitable for dropdown selectors
// @Tags WhatsApp
// @Produce json
// @Success 200 {object} fiber.Map
// @Router /whatsapp/sessions/api-keys [get]
func (handler ApiKeyHandler) GetPublicApiKeys(c *fiber.Ctx) error {
	sql := connection.SQL{}
	db, err := sql.Connect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Database connection failed"})
	}

	var keys []model.ApiKey
	if err := db.Where("is_active = ?", true).Order("name ASC").Find(&keys).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to retrieve keys"})
	}

	var response []ApiKeyResponse
	for _, k := range keys {
		response = append(response, ApiKeyResponse{
			ID:       k.ID,
			Code:     k.Code,
			Provider: k.Provider,
			Name:     k.Name,
			Models:   k.Models,
			IsActive: k.IsActive,
		})
	}

	return c.JSON(fiber.Map{
		"api_keys": response,
	})
}

type CreateApiKeyRequest struct {
	Code       string `json:"code"`
	Provider   string `json:"provider"`
	Name       string `json:"name"`
	Key        string `json:"key"`
	Models     string `json:"models"`
	WebhookURL string `json:"webhook_url"`
}

// CreateApiKey creates a new API key
// @Summary Create API key
// @Description Admin operation to register AI provider gateway key
// @Tags Super Admin
// @Accept json
// @Produce json
// @Param body body CreateApiKeyRequest true "Form Payload"
// @Success 201 {object} fiber.Map
// @Router /settings/api-keys [post]
func (handler ApiKeyHandler) CreateApiKey(c *fiber.Ctx) error {
	roleCode := c.Locals("role_code")
	if roleCode != variable.SuperAdmin {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"message": "Unauthorized admin action"})
	}

	var req CreateApiKeyRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Invalid request payload"})
	}

	if req.Code == "" || req.Provider == "" || req.Name == "" || req.Key == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Code, Provider, Name, and Key are required"})
	}

	sql := connection.SQL{}
	db, err := sql.Connect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Database connection failed"})
	}

	key := model.ApiKey{
		Code:       req.Code,
		Provider:   req.Provider,
		Name:       req.Name,
		Key:        req.Key,
		Models:     req.Models,
		WebhookURL: req.WebhookURL,
		IsActive:   true,
	}

	if err := db.Create(&key).Error; err != nil {
		log.Printf("Failed to create api_key: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to create key", "error": err.Error()})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message": "API key created successfully",
		"id":      key.ID,
	})
}

type UpdateApiKeyRequest struct {
	Code       *string `json:"code,omitempty"`
	Provider   *string `json:"provider,omitempty"`
	Name       *string `json:"name,omitempty"`
	Key        *string `json:"key,omitempty"`
	Models     *string `json:"models,omitempty"`
	WebhookURL *string `json:"webhook_url,omitempty"`
	IsActive   *bool   `json:"is_active,omitempty"`
}

// UpdateApiKey modifies existing instance
// @Summary Edit API key
// @Tags Super Admin
// @Param id path string true "API Key ID UUID"
// @Param body body UpdateApiKeyRequest true "Update payload"
// @Router /settings/api-keys/{id} [put]
func (handler ApiKeyHandler) UpdateApiKey(c *fiber.Ctx) error {
	roleCode := c.Locals("role_code")
	if roleCode != variable.SuperAdmin {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"message": "Unauthorized admin action"})
	}

	idStr := c.Params("id")
	uid, err := uuid.Parse(idStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Invalid ID format"})
	}

	var req UpdateApiKeyRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Invalid request payload"})
	}

	sql := connection.SQL{}
	db, err := sql.Connect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Database connection failed"})
	}

	var key model.ApiKey
	if err := db.Where("id = ?", uid).First(&key).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"message": "API key not found"})
	}

	if req.Code != nil {
		key.Code = *req.Code
	}
	if req.Provider != nil {
		key.Provider = *req.Provider
	}
	if req.Name != nil {
		key.Name = *req.Name
	}
	if req.Models != nil {
		key.Models = *req.Models
	}
	if req.WebhookURL != nil {
		key.WebhookURL = *req.WebhookURL
	}
	if req.IsActive != nil {
		key.IsActive = *req.IsActive
	}
	if req.Key != nil && *req.Key != "" {
		key.Key = *req.Key // Update key string if provided
	}

	if err := db.Save(&key).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Update failed", "error": err.Error()})
	}

	return c.JSON(fiber.Map{"message": "API key updated successfully"})
}

// DeleteApiKey soft deletes an instance
// @Summary Delete API key
// @Tags Super Admin
// @Param id path string true "API key ID UUID"
// @Router /settings/api-keys/{id} [delete]
func (handler ApiKeyHandler) DeleteApiKey(c *fiber.Ctx) error {
	roleCode := c.Locals("role_code")
	if roleCode != variable.SuperAdmin {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"message": "Unauthorized"})
	}

	idStr := c.Params("id")
	uid, err := uuid.Parse(idStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Invalid ID"})
	}

	sql := connection.SQL{}
	db, err := sql.Connect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "DB connection failed"})
	}

	if err := db.Delete(&model.ApiKey{}, "id = ?", uid).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Delete failed"})
	}

	return c.JSON(fiber.Map{"message": "API key deleted successfully"})
}
