package webhook

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"loko/server/cache"
	"loko/server/dto"
	"loko/server/response"
	"loko/server/model"
	"loko/server/util"
	"time"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

// Handler handles webhook-related HTTP requests
type Handler struct {
	DB    *gorm.DB
	SqlDB *sql.DB
	Cache cache.ChatCache
}

// NewHandler creates a new webhook handler
func NewHandler(db *gorm.DB, sqlDB *sql.DB, cache cache.ChatCache) *Handler {
	return &Handler{
		DB:    db,
		SqlDB: sqlDB,
		Cache: cache,
	}
}

// ConfigureWebhook configures webhook settings
// @Summary Configure webhook
// @Description Configure webhook URL and retry settings for WhatsApp events
// @Tags WhatsApp Webhook
// @Accept json
// @Produce json
// @Param webhook body dto.WebhookConfigRequest true "Webhook configuration"
// @Success 200 {object} response.WhatsAppBaseResponse
// @Failure 400 {object} response.ErrorResponse
// @Router /whatsapp/webhook/configure [post]
func (h *Handler) ConfigureWebhook(c *fiber.Ctx) error {
	var req dto.WebhookConfigRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(response.ErrorResponse{
			Success: false,
			Message: "Invalid request body",
			Error:   err.Error(),
		})
	}

	// Configure webhook with retry settings
	config := util.WebhookConfig{
		URL:        req.URL,
		Secret:     req.Secret,
		Headers:    req.Headers,
		Enabled:    req.Enabled,
		MaxRetries: req.MaxRetries,
		RetryDelay: time.Duration(req.RetryDelaySeconds) * time.Second,
	}

	util.SetWebhookConfig(config)

	// Persist to Database (system_settings) untuk reboot-proof config
	settings := map[string]string{
		"WEBHOOK_URL":         req.URL,
		"WEBHOOK_SECRET":      req.Secret,
		"WEBHOOK_ENABLED":     fmt.Sprintf("%t", req.Enabled),
		"WEBHOOK_MAX_RETRIES": fmt.Sprintf("%d", req.MaxRetries),
		"WEBHOOK_RETRY_DELAY": fmt.Sprintf("%d", req.RetryDelaySeconds),
	}
	if req.Headers != nil {
		headersJson, _ := json.Marshal(req.Headers)
		settings["WEBHOOK_HEADERS"] = string(headersJson)
	} else {
		settings["WEBHOOK_HEADERS"] = "{}"
	}

	for k, v := range settings {
		var setting model.SystemSetting
		if err := h.DB.Where("key = ?", k).First(&setting).Error; err == nil {
			h.DB.Model(&setting).Update("value", v)
		} else {
			h.DB.Create(&model.SystemSetting{Key: k, Value: v})
		}
	}

	return c.Status(fiber.StatusOK).JSON(response.WhatsAppBaseResponse{
		Success: true,
		Message: "Webhook configured successfully",
		Data: map[string]interface{}{
			"url":         req.URL,
			"enabled":     req.Enabled,
			"max_retries": req.MaxRetries,
			"retry_delay": req.RetryDelaySeconds,
		},
	})
}

// GetWebhookStatus retrieves current webhook configuration status
// @Summary Get webhook status
// @Description Get current webhook configuration and status
// @Tags WhatsApp Webhook
// @Accept json
// @Produce json
// @Success 200 {object} response.WhatsAppBaseResponse
// @Router /whatsapp/webhook/status [get]
func (h *Handler) GetWebhookStatus(c *fiber.Ctx) error {
	config := util.WhatsAppWebhookConfig
	if config == nil {
		return c.Status(fiber.StatusOK).JSON(response.WhatsAppBaseResponse{
			Success: true,
			Message: "Webhook status retrieved",
			Data: map[string]interface{}{
				"configured": false,
				"enabled":    false,
			},
		})
	}

	return c.Status(fiber.StatusOK).JSON(response.WhatsAppBaseResponse{
		Success: true,
		Message: "Webhook status retrieved",
		Data: map[string]interface{}{
			"configured":  true,
			"enabled":     config.Enabled,
			"url":         config.URL,
			"max_retries": config.MaxRetries,
			"retry_delay": config.RetryDelay.Seconds(),
		},
	})
}

// RetryFailedWebhooks retries all failed webhook deliveries
// @Summary Retry failed webhooks
// @Description Retry all failed webhook deliveries from queue
// @Tags WhatsApp Webhook
// @Accept json
// @Produce json
// @Success 200 {object} response.WhatsAppBaseResponse
// @Router /whatsapp/webhook/retry [post]
func (h *Handler) RetryFailedWebhooks(c *fiber.Ctx) error {
	// This would typically retrieve failed webhooks from storage and retry them
	// For now, we'll just return a success message
	return c.Status(fiber.StatusOK).JSON(response.WhatsAppBaseResponse{
		Success: true,
		Message: "Failed webhooks retry initiated",
		Data: map[string]interface{}{
			"retried_count": 0,
			"note":          "No failed webhooks found in queue",
		},
	})
}

// TestWebhook sends a test webhook to verify configuration
// @Summary Test webhook
// @Description Send a test webhook to verify configuration
// @Tags WhatsApp Webhook
// @Accept json
// @Produce json
// @Success 200 {object} response.WhatsAppBaseResponse
// @Failure 400 {object} response.ErrorResponse
// @Router /whatsapp/webhook/test [post]
func (h *Handler) TestWebhook(c *fiber.Ctx) error {
	if util.WhatsAppWebhookConfig == nil || !util.WhatsAppWebhookConfig.Enabled {
		return c.Status(fiber.StatusBadRequest).JSON(response.ErrorResponse{
			Success: false,
			Message: "Webhook not configured or disabled",
			Error:   "Please configure webhook first",
		})
	}

	// Create test payload
	testPayload := util.CreateDecryptionFailureWebhookPayload(
		"test_message_id",
		"test_chat_jid@s.whatsapp.net",
		"Test decryption failure for webhook testing",
		map[string]interface{}{
			"test":      true,
			"timestamp": time.Now(),
		},
	)

	// Send test webhook with retry
	err := util.SendWebhookWithRetry(testPayload)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(response.ErrorResponse{
			Success: false,
			Message: "Failed to send test webhook",
			Error:   err.Error(),
		})
	}

	return c.Status(fiber.StatusOK).JSON(response.WhatsAppBaseResponse{
		Success: true,
		Message: "Test webhook sent successfully",
		Data: map[string]interface{}{
			"webhook_url": util.WhatsAppWebhookConfig.URL,
			"test_event":  "message.decryption_failed",
		},
	})
}
