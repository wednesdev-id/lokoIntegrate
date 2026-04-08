package module

import (
	"loko/server/middleware"
	"loko/server/model"

	"github.com/gofiber/fiber/v2"
)

type BotTemplate struct{}

func (ref BotTemplate) Route(api fiber.Router) {
	handler := BotTemplateHandler{}

	// Public templates (available to all users)
	api.Get("/bot-templates", handler.ListTemplates)
	api.Get("/bot-templates/:id", handler.GetTemplate)

	// Protect with Auth for user templates
	userTemplate := api.Group("/bot-templates", middleware.UseAuth)

	// User can create their own templates
	userTemplate.Post("/", handler.CreateTemplate)

	// User can update/delete their own templates
	userTemplate.Put("/:id", handler.UpdateTemplate)
	userTemplate.Delete("/:id", handler.DeleteTemplate)
}

type BotTemplateHandler struct{}

// --- ListTemplates ---
func (handler BotTemplateHandler) ListTemplates(c *fiber.Ctx) error {
	db, err := dbConnect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Database connection failed"})
	}

	var templates []model.BotTemplate
	// Return active system templates + user's own templates
	if err := db.Where("is_active = ? AND (is_system = ? OR user_id = ?)", true, true, nil).
		Or("is_active = ? AND user_id = ?", true, c.Locals("user_id")).
		Order("is_system DESC, created_at DESC").
		Find(&templates).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to retrieve templates"})
	}

	return c.JSON(fiber.Map{"data": templates})
}

// --- GetTemplate ---
func (handler BotTemplateHandler) GetTemplate(c *fiber.Ctx) error {
	id := c.Params("id")

	db, err := dbConnect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Database connection failed"})
	}

	var template model.BotTemplate
	if err := db.Where("id = ?", id).First(&template).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"message": "Template not found"})
	}

	return c.JSON(fiber.Map{"data": template})
}

// --- CreateTemplate ---
type CreateTemplateBody struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Category    string `json:"category"`
	Instruction string `json:"instruction"`
}

func (handler BotTemplateHandler) CreateTemplate(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)

	var body CreateTemplateBody
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Invalid request body"})
	}

	if body.Name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Template name is required"})
	}
	if body.Instruction == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Instruction is required"})
	}

	db, err := dbConnect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Database connection failed"})
	}

	template := model.BotTemplate{
		Name:        body.Name,
		Description: body.Description,
		Category:    body.Category,
		Instruction: body.Instruction,
		IsActive:    true,
		IsSystem:    false, // User-created
		UserID:      &userID,
	}

	if body.Category == "" {
		template.Category = "general"
	}

	if err := db.Create(&template).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to create template"})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"message": "Template created successfully", "data": template})
}

// --- UpdateTemplate ---
type UpdateTemplateBody struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
	Category    *string `json:"category"`
	Instruction *string `json:"instruction"`
	IsActive    *bool   `json:"is_active"`
}

func (handler BotTemplateHandler) UpdateTemplate(c *fiber.Ctx) error {
	id := c.Params("id")
	userID := c.Locals("user_id").(string)

	var body UpdateTemplateBody
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Invalid request body"})
	}

	db, err := dbConnect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Database connection failed"})
	}

	var template model.BotTemplate
	if err := db.Where("id = ? AND user_id = ?", id, userID).First(&template).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"message": "Template not found"})
	}

	// Prevent editing system templates
	if template.IsSystem {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"message": "Cannot edit system templates"})
	}

	// Update fields
	if body.Name != nil {
		template.Name = *body.Name
	}
	if body.Description != nil {
		template.Description = *body.Description
	}
	if body.Category != nil {
		template.Category = *body.Category
	}
	if body.Instruction != nil {
		template.Instruction = *body.Instruction
	}
	if body.IsActive != nil {
		template.IsActive = *body.IsActive
	}

	if err := db.Save(&template).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to update template"})
	}

	return c.JSON(fiber.Map{"message": "Template updated successfully", "data": template})
}

// --- DeleteTemplate ---
func (handler BotTemplateHandler) DeleteTemplate(c *fiber.Ctx) error {
	id := c.Params("id")
	userID := c.Locals("user_id").(string)

	db, err := dbConnect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Database connection failed"})
	}

	var template model.BotTemplate
	if err := db.Where("id = ? AND user_id = ?", id, userID).First(&template).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"message": "Template not found"})
	}

	// Prevent deleting system templates
	if template.IsSystem {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"message": "Cannot delete system templates"})
	}

	result := db.Delete(&template)
	if result.Error != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to delete template"})
	}

	return c.JSON(fiber.Map{"message": "Template deleted successfully"})
}
