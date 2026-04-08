package module

import (
	"fmt"
	"loko/server/connection"
	"loko/server/middleware"
	"loko/server/model"
	"loko/server/variable"

	"github.com/gofiber/fiber/v2"
)

type CsNumber struct{}

func (ref CsNumber) Route(api fiber.Router) {
	handler := CsNumberHandler{}

	// Public endpoint for floating widget
	api.Get("/public/cs-numbers", handler.GetPublicCsNumbers)

	// Admin endpoints
	csGroup := api.Group("/settings/cs-numbers", middleware.UseAuth)

	csGroup.Get("/", handler.GetCsNumbers)
	csGroup.Post("/", handler.CreateCsNumber)
	csGroup.Put("/:id", handler.UpdateCsNumber)
	csGroup.Delete("/:id", handler.DeleteCsNumber)
}

type CsNumberHandler struct{}

// GetCsNumbers retrieves all CS numbers for Super Admin
func (handler CsNumberHandler) GetCsNumbers(c *fiber.Ctx) error {
	roleCode := c.Locals("role_code")
	if roleCode != variable.SuperAdmin {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"message": "Only super admins can view cs numbers"})
	}

	sql := connection.SQL{}
	db, err := sql.Connect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Database connection failed"})
	}

	var numbers []model.CsNumber
	if err := db.Order("created_at DESC").Find(&numbers).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to retrieve numbers"})
	}

	return c.JSON(fiber.Map{"cs_numbers": numbers})
}

// GetPublicCsNumbers retrieves active CS numbers for floating widget
func (handler CsNumberHandler) GetPublicCsNumbers(c *fiber.Ctx) error {
	sql := connection.SQL{}
	db, err := sql.Connect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Database connection failed"})
	}

	var numbers []model.CsNumber
	if err := db.Where("is_active = ?", true).Order("name ASC").Find(&numbers).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to retrieve numbers"})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"success": true,
		"data":    numbers,
	})
}

type CreateCsNumberRequest struct {
	Name   string `json:"name"`
	Number string `json:"number"`
}

func (handler CsNumberHandler) CreateCsNumber(c *fiber.Ctx) error {
	roleCode := c.Locals("role_code")
	if roleCode != variable.SuperAdmin {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"message": "Unauthorized admin action"})
	}

	var req CreateCsNumberRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Invalid request payload"})
	}

	if req.Name == "" || req.Number == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Name and Number are required"})
	}

	sql := connection.SQL{}
	db, err := sql.Connect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Database connection failed"})
	}

	number := model.CsNumber{
		Name:     req.Name,
		Number:   req.Number,
		IsActive: true,
	}

	if err := db.Create(&number).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to create number", "error": err.Error()})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message": "CS Number created successfully",
		"id":      number.ID,
	})
}

type UpdateCsNumberRequest struct {
	Name     *string `json:"name,omitempty"`
	Number   *string `json:"number,omitempty"`
	IsActive *bool   `json:"is_active,omitempty"`
}

func (handler CsNumberHandler) UpdateCsNumber(c *fiber.Ctx) error {
	roleCode := c.Locals("role_code")
	if roleCode != variable.SuperAdmin {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"message": "Unauthorized admin action"})
	}

	idStr := c.Params("id")
	var id uint
	if _, err := fmt.Sscanf(idStr, "%d", &id); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Invalid ID format"})
	}

	var req UpdateCsNumberRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Invalid request payload"})
	}

	sql := connection.SQL{}
	db, err := sql.Connect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Database connection failed"})
	}

	var number model.CsNumber
	if err := db.First(&number, id).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"message": "Number not found"})
	}

	if req.Name != nil {
		number.Name = *req.Name
	}
	if req.Number != nil {
		number.Number = *req.Number
	}
	if req.IsActive != nil {
		number.IsActive = *req.IsActive
	}

	if err := db.Save(&number).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Update failed", "error": err.Error()})
	}

	return c.JSON(fiber.Map{"message": "CS Number updated successfully"})
}

func (handler CsNumberHandler) DeleteCsNumber(c *fiber.Ctx) error {
	roleCode := c.Locals("role_code")
	if roleCode != variable.SuperAdmin {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"message": "Unauthorized"})
	}

	idStr := c.Params("id")
	var id uint
	if _, err := fmt.Sscanf(idStr, "%d", &id); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Invalid ID format"})
	}

	sql := connection.SQL{}
	db, err := sql.Connect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "DB connection failed"})
	}

	if err := db.Delete(&model.CsNumber{}, id).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Delete failed"})
	}

	return c.JSON(fiber.Map{"message": "CS Number deleted successfully"})
}
