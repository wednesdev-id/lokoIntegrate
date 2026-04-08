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

type AiModel struct{}

func (ref AiModel) Route(api fiber.Router) {
	handler := AiModelHandler{}

	// Public endpoint for dropdown selection (e.g. Session AI Config)
	api.Get("/whatsapp/sessions/ai-models", middleware.UseAuth, handler.GetPublicAiModels)

	// Admin endpoints
	aiModel := api.Group("/settings/ai-models", middleware.UseAuth)

	aiModel.Get("/", handler.GetAiModels)
	aiModel.Post("/", handler.CreateAiModel)
	aiModel.Delete("/:id", handler.DeleteAiModel)
}

type AiModelHandler struct{}

type AiModelResponse struct {
	ID        uuid.UUID `json:"id"`
	Provider  string    `json:"provider"`
	Name      string    `json:"name"`
	ModelCode string    `json:"model_code"`
	IsActive  bool      `json:"is_active"`
}

// GetAiModels retrieves all AI models for Super Admin
func (handler AiModelHandler) GetAiModels(c *fiber.Ctx) error {
	roleCode := c.Locals("role_code")
	if roleCode != variable.SuperAdmin {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "Only super admins can view AI models",
		})
	}

	sql := connection.SQL{}
	db, err := sql.Connect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Database connection failed"})
	}

	var models []model.AiModel
	if err := db.Order("created_at DESC").Find(&models).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to retrieve models"})
	}

	return c.JSON(fiber.Map{
		"ai_models": models,
	})
}

// GetPublicAiModels retrieves active models for selection list
func (handler AiModelHandler) GetPublicAiModels(c *fiber.Ctx) error {
	sql := connection.SQL{}
	db, err := sql.Connect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Database connection failed"})
	}

	var models []model.AiModel
	if err := db.Where("is_active = ?", true).Order("name ASC").Find(&models).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to retrieve models"})
	}

	var response []AiModelResponse
	for _, m := range models {
		response = append(response, AiModelResponse{
			ID:        m.ID,
			Provider:  m.Provider,
			Name:      m.Name,
			ModelCode: m.ModelCode,
			IsActive:  m.IsActive,
		})
	}

	return c.JSON(fiber.Map{
		"ai_models": response,
	})
}

type CreateAiModelRequest struct {
	Provider  string `json:"provider"`
	Name      string `json:"name"`
	ModelCode string `json:"model_code"`
}

// CreateAiModel creates a new AI model entry
func (handler AiModelHandler) CreateAiModel(c *fiber.Ctx) error {
	roleCode := c.Locals("role_code")
	if roleCode != variable.SuperAdmin {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"message": "Unauthorized admin action"})
	}

	var req CreateAiModelRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Invalid request payload"})
	}

	if req.Provider == "" || req.Name == "" || req.ModelCode == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Provider, Name, and ModelCode are required"})
	}

	sql := connection.SQL{}
	db, err := sql.Connect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Database connection failed"})
	}

	aiModel := model.AiModel{
		Provider:  req.Provider,
		Name:      req.Name,
		ModelCode: req.ModelCode,
		IsActive:  true,
	}

	if err := db.Create(&aiModel).Error; err != nil {
		log.Printf("Failed to create ai_model: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to create model", "error": err.Error()})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message": "AI model created successfully",
		"id":      aiModel.ID,
	})
}

// DeleteAiModel removes a model entry from Super Admin view
func (handler AiModelHandler) DeleteAiModel(c *fiber.Ctx) error {
	roleCode := c.Locals("role_code")
	if roleCode != variable.SuperAdmin {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"message": "Unauthorized"})
	}

	idStr := c.Params("id")
	uid, err := uuid.Parse(idStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Invalid ID format"})
	}

	sql := connection.SQL{}
	db, err := sql.Connect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "DB connection failed"})
	}

	if err := db.Delete(&model.AiModel{}, "id = ?", uid).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Delete failed"})
	}

	return c.JSON(fiber.Map{"message": "AI model deleted successfully"})
}
