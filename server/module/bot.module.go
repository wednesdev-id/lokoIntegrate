package module

import (
	"fmt"
	"loko/server/middleware"
	"loko/server/model"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type Bot struct{}

func (ref Bot) Route(api fiber.Router) {
	handler := BotHandler{}

	// Protect with Auth
	bot := api.Group("/bots", middleware.UseAuth)

	// List bots
	bot.Get("/", handler.ListBots)

	// Get usage/limit info
	bot.Get("/usage", handler.GetBotUsage)

	// Create bot
	bot.Post("/", handler.CreateBot)

	// Get bot detail
	bot.Get("/:id", handler.GetBot)

	// Update bot
	bot.Put("/:id", handler.UpdateBot)

	// Delete bot
	bot.Delete("/:id", handler.DeleteBot)
}

type BotHandler struct{}

// --- ListBots ---
func (handler BotHandler) ListBots(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)

	db, err := dbConnect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Database connection failed"})
	}

	var bots []model.Bot
	if err := db.Where("user_id = ?", userID).Order("created_at DESC").Find(&bots).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to retrieve bots"})
	}

	return c.JSON(fiber.Map{"data": bots})
}

// --- GetBotUsage ---
func (handler BotHandler) GetBotUsage(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)

	db, err := dbConnect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Database connection failed"})
	}

	// Get user with subscription package
	var user model.User
	if err := db.Preload("SubscriptionPackage").Where("id = ?", userID).First(&user).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"message": "User not found"})
	}

	var maxBots int
	if user.SubscriptionPackage != nil {
		maxBots = user.SubscriptionPackage.MaxBots
	} else {
		maxBots = 1 // Default limit if no package
	}

	// Count current bots
	var currentBots int64
	if err := db.Model(&model.Bot{}).Where("user_id = ?", userID).Count(&currentBots).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to check bot count"})
	}

	// Calculate available bots (handle unlimited: -1)
	isUnlimited := maxBots == -1
	var availableBots int
	var usagePercent float64
	var isLimitReached bool

	if isUnlimited {
		availableBots = 999999 // Represent "unlimited available"
		usagePercent = 0
		isLimitReached = false
	} else {
		availableBots = maxBots - int(currentBots)
		if availableBots < 0 {
			availableBots = 0
		}
		if maxBots > 0 {
			usagePercent = float64(currentBots) / float64(maxBots) * 100
		}
		isLimitReached = int(currentBots) >= maxBots
	}

	var aiLimit int
	if user.SubscriptionPackage != nil {
		aiLimit = user.SubscriptionPackage.AILimit
	}

	return c.JSON(fiber.Map{
		"data": fiber.Map{
			"current_bots":     int(currentBots),
			"max_bots":         maxBots,
			"available_bots":   availableBots,
			"usage_percent":    usagePercent,
			"is_limit_reached": isLimitReached,
			"is_unlimited":     isUnlimited,
			"ai_quota":         user.AIQuota,
			"ai_limit":         aiLimit,
		},
	})
}

// --- GetBot ---
func (handler BotHandler) GetBot(c *fiber.Ctx) error {
	id := c.Params("id")
	userID := c.Locals("user_id").(string)

	db, err := dbConnect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Database connection failed"})
	}

	var bot model.Bot
	if err := db.Where("id = ? AND user_id = ?", id, userID).First(&bot).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"message": "Bot not found"})
	}

	return c.JSON(fiber.Map{"data": bot})
}

// --- CreateBot ---
type CreateBotBody struct {
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Instruction string   `json:"instruction"`
	Trigger     string   `json:"trigger"`     // Optional: trigger keywords
	TemplateID  *string  `json:"template_id"` // Optional: create from template
	Temperature *float64 `json:"temperature"` // Optional: override subscription default
	MaxTokens   *int     `json:"max_tokens"`  // Optional: override subscription default
}

func (handler BotHandler) CreateBot(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)

	var body CreateBotBody
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Invalid request body"})
	}

	if body.Name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Bot name is required"})
	}

	db, err := dbConnect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Database connection failed"})
	}

	// 1. Check Subscription Limits and get AI Config
	var user model.User
	if err := db.Preload("SubscriptionPackage").Where("id = ?", userID).First(&user).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"message": "User not found"})
	}

	if user.SubscriptionPackage == nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"message": "No active subscription package"})
	}

	maxBots := user.SubscriptionPackage.MaxBots

	var currentBots int64
	if err := db.Model(&model.Bot{}).Where("user_id = ?", userID).Count(&currentBots).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to check bot limit"})
	}

	// Check limit only if not unlimited (-1)
	if maxBots != -1 && int(currentBots) >= maxBots {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": fmt.Sprintf("Bot limit reached (%d/%d). Please upgrade your subscription.", currentBots, maxBots),
		})
	}

	// 2. Get instruction from template if provided
	instruction := body.Instruction
	var templateID *uuid.UUID

	if body.TemplateID != nil && *body.TemplateID != "" {
		var template model.BotTemplate
		if err := db.Where("id = ? AND is_active = ?", *body.TemplateID, true).First(&template).Error; err == nil {
			instruction = template.Instruction
			tid, _ := uuid.Parse(*body.TemplateID)
			templateID = &tid
		}
	}

	// If no instruction and no template, require instruction
	if instruction == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Instruction (Brief) is required"})
	}

	// 3. Use subscription AI config, with optional overrides
	bot := model.Bot{
		UserID:      userID,
		Name:        body.Name,
		Description: body.Description,
		Instruction: instruction,
		Trigger:     body.Trigger,
		TemplateID:  templateID,
		IsActive:    true, // Default active on create
		// Use optional overrides or subscription defaults
		Temperature: body.Temperature,
		MaxTokens:   body.MaxTokens,
	}

	// Apply subscription defaults if not overridden
	if body.Temperature == nil {
		temp := user.SubscriptionPackage.AITemperature
		bot.Temperature = &temp
	}
	if body.MaxTokens == nil {
		maxTok := user.SubscriptionPackage.AIMaxTokens
		bot.MaxTokens = &maxTok
	}

	if err := db.Create(&bot).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to create bot", "error": err.Error()})
	}

	// Return bot with subscription AI info
	response := fiber.Map{
		"id":          bot.ID,
		"user_id":     bot.UserID,
		"name":        bot.Name,
		"description": bot.Description,
		"instruction": bot.Instruction,
		"bot_code":    bot.BotCode,
		"is_active":   bot.IsActive,
		"temperature": bot.Temperature,
		"max_tokens":  bot.MaxTokens,
		"template_id": bot.TemplateID,
		"created_at":  bot.CreatedAt,
		"updated_at":  bot.UpdatedAt,
		// Include AI config from subscription
		"ai_provider": user.SubscriptionPackage.AIProvider,
		"ai_model":    user.SubscriptionPackage.AIModel,
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"message": "Bot created successfully", "data": response})
}

// --- UpdateBot ---
type UpdateBotBody struct {
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Instruction string   `json:"instruction"`
	Trigger     *string  `json:"trigger"`     // Use pointer to allow empty string update
	Temperature *float64 `json:"temperature"` // Optional: override subscription default
	MaxTokens   *int     `json:"max_tokens"`  // Optional: override subscription default
	IsActive    *bool    `json:"is_active"`
}

func (handler BotHandler) UpdateBot(c *fiber.Ctx) error {
	id := c.Params("id")
	userID := c.Locals("user_id").(string)

	var body UpdateBotBody
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Invalid request body"})
	}

	db, err := dbConnect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Database connection failed"})
	}

	var bot model.Bot
	if err := db.Where("id = ? AND user_id = ?", id, userID).First(&bot).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"message": "Bot not found"})
	}

	// Update fields
	if body.Name != "" {
		bot.Name = body.Name
	}
	if body.Description != "" {
		bot.Description = body.Description
	}
	if body.Instruction != "" {
		bot.Instruction = body.Instruction
	}
	if body.Trigger != nil {
		bot.Trigger = *body.Trigger
	}
	if body.Temperature != nil {
		bot.Temperature = body.Temperature
	}
	if body.MaxTokens != nil {
		bot.MaxTokens = body.MaxTokens
	}
	if body.IsActive != nil {
		bot.IsActive = *body.IsActive
	}

	bot.UpdatedAt = time.Now()

	if err := db.Save(&bot).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to update bot"})
	}

	return c.JSON(fiber.Map{"message": "Bot updated successfully", "data": bot})
}

// --- DeleteBot ---
func (handler BotHandler) DeleteBot(c *fiber.Ctx) error {
	id := c.Params("id")
	userID := c.Locals("user_id").(string)

	db, err := dbConnect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Database connection failed"})
	}

	result := db.Where("id = ? AND user_id = ?", id, userID).Delete(&model.Bot{})
	if result.Error != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to delete bot"})
	}
	if result.RowsAffected == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"message": "Bot not found"})
	}

	return c.JSON(fiber.Map{"message": "Bot deleted successfully"})
}
