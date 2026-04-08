package module

import (
	"log"

	"loko/server/connection"
	"loko/server/middleware"
	"loko/server/model"
	"loko/server/variable"

	"github.com/gofiber/fiber/v2"
)

type Setting struct{}

func (ref Setting) Route(api fiber.Router) {
	handler := SettingHandler{}

	// Protect all settings routes with Auth middleware
	setting := api.Group("/settings", middleware.UseAuth)

	// Super admin only: manage API key and global settings
	setting.Get("/", handler.GetSettings)
	setting.Put("/:key", handler.UpdateSetting)

	// All authenticated users: check if AI is configured (boolean only)
	setting.Get("/ai-brief", handler.GetAIBrief)
}

type SettingHandler struct{}

// GetSettings retrieves all public or admin settings.
// OpenRouter API Key is masked unless specifically requested by an admin action if needed, or we just restrict settings to admin.
func (handler SettingHandler) GetSettings(c *fiber.Ctx) error {
	roleCode := c.Locals("role_code")
	if roleCode != variable.SuperAdmin {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Only super admins can view system settings",
		})
	}

	sql := connection.SQL{}
	db, err := sql.Connect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Database connection failed"})
	}

	var settings []model.SystemSetting
	if err := db.Find(&settings).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to retrieve settings"})
	}

	// Map to simplify response
	settingsMap := make(map[string]string)
	for _, s := range settings {
		settingsMap[s.Key] = s.Value
	}

	return c.JSON(fiber.Map{
		"settings": settingsMap,
	})
}

type UpdateSettingBody struct {
	Value string `json:"value"`
}

// UpdateSetting updates a specific system setting by key
func (handler SettingHandler) UpdateSetting(c *fiber.Ctx) error {
	roleCode := c.Locals("role_code")
	if roleCode != variable.SuperAdmin {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Only super admins can update system settings",
		})
	}

	key := c.Params("key")
	if key == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Setting key is required"})
	}

	var body UpdateSettingBody
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Invalid request body"})
	}

	sql := connection.SQL{}
	db, err := sql.Connect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Database connection failed"})
	}

	// Upsert the setting
	var setting model.SystemSetting
	err = db.Where("key = ?", key).First(&setting).Error
	if err != nil {
		// Create new
		setting = model.SystemSetting{
			Key:   key,
			Value: body.Value,
		}
		if err := db.Create(&setting).Error; err != nil {
			log.Printf("Failed to create setting %s: %v", key, err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to create setting"})
		}
	} else {
		// Update existing
		setting.Value = body.Value
		if err := db.Save(&setting).Error; err != nil {
			log.Printf("Failed to update setting %s: %v", key, err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to update setting"})
		}
	}

	return c.JSON(fiber.Map{
		"message": "Setting updated successfully",
		"setting": setting,
	})
}

// GetAIBrief returns whether the AI is configured (for customers to know if AI auto-reply is available)
func (handler SettingHandler) GetAIBrief(c *fiber.Ctx) error {
	sql := connection.SQL{}
	db, err := sql.Connect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Database connection failed"})
	}

	var setting model.SystemSetting
	err = db.Where("key = ?", "OPENROUTER_API_KEY").First(&setting).Error
	aiConfigured := err == nil && setting.Value != ""

	return c.JSON(fiber.Map{
		"ai_configured": aiConfigured,
	})
}
