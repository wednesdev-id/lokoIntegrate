package module

import (
	"loko/server/model"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/google/uuid"
)

// PublicSubscription module for public-facing subscription package endpoints
// These endpoints do not require authentication and are designed for landing pages
type PublicSubscription struct{}

func (ref PublicSubscription) Route(api fiber.Router) {
	handler := PublicSubscriptionHandler{}

	// Public routes - allow all origins for landing page consumption
	public := api.Group("/public/subscription-packages", cors.New(cors.Config{
		AllowOrigins: "*",
		AllowMethods: "GET,OPTIONS",
		AllowHeaders: "Origin,Content-Type,Accept",
	}))

	public.Get("/", handler.ListPackages)
	public.Get("/:id", handler.GetPackage)
}

type PublicSubscriptionHandler struct{}

// PublicPackageResponse represents a subscription package for public display
// Only includes safe fields suitable for landing pages
type PublicPackageResponse struct {
	ID             uuid.UUID `json:"id"`
	Name           string    `json:"name"`
	Description    string    `json:"description"`
	Price          float64   `json:"price"`
	BroadcastLimit int       `json:"broadcast_limit"`
	AILimit        int       `json:"ai_limit"`
	MaxSessions    int       `json:"max_sessions"`
	MaxBots        int       `json:"max_bots"`
	DurationDays   int       `json:"duration_days"`
	TrialDays      int       `json:"trial_days"`
	IsTrialEnabled bool      `json:"is_trial_enabled"`
	ActiveModules  string    `json:"active_modules"`
}

// --- ListPackages ---
// @Summary List active subscription packages (Public)
// @Description Get all active subscription packages for landing page display
// @Tags Public - Subscription
// @Accept json
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /api/public/subscription-packages/ [get]
func (handler PublicSubscriptionHandler) ListPackages(c *fiber.Ctx) error {
	db, err := dbConnect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Database connection failed"})
	}

	var packages []model.SubscriptionPackage
	// Only return active packages, ordered by price ascending (cheapest first for landing page)
	if err := db.Where("is_active = ?", true).Order("price ASC").Find(&packages).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to retrieve subscription packages"})
	}

	// Convert to public response format (exclude sensitive fields)
	publicPackages := []PublicPackageResponse{}
	for _, pkg := range packages {
		publicPackages = append(publicPackages, PublicPackageResponse{
			ID:             pkg.ID,
			Name:           pkg.Name,
			Description:    pkg.Description,
			Price:          pkg.Price,
			BroadcastLimit: pkg.BroadcastLimit,
			AILimit:        pkg.AILimit,
			MaxSessions:    pkg.MaxSessions,
			MaxBots:        pkg.MaxBots,
			DurationDays:   pkg.DurationDays,
			TrialDays:      pkg.TrialDays,
			IsTrialEnabled: pkg.IsTrialEnabled,
			ActiveModules:  pkg.ActiveModules,
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    publicPackages,
	})
}

// --- GetPackage ---
// @Summary Get a single subscription package (Public)
// @Description Get details of a specific active subscription package by ID
// @Tags Public - Subscription
// @Accept json
// @Produce json
// @Param id path string true "Package ID"
// @Success 200 {object} map[string]interface{}
// @Failure 404 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /api/public/subscription-packages/{id} [get]
func (handler PublicSubscriptionHandler) GetPackage(c *fiber.Ctx) error {
	id := c.Params("id")

	db, err := dbConnect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Database connection failed"})
	}

	uid, err := uuid.Parse(id)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Invalid package ID",
		})
	}

	var pkg model.SubscriptionPackage
	// Only return if package is active
	if err := db.Where("id = ? AND is_active = ?", uid, true).First(&pkg).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"message": "Subscription package not found",
		})
	}

	// Convert to public response format
	publicPackage := PublicPackageResponse{
		ID:             pkg.ID,
		Name:           pkg.Name,
		Description:    pkg.Description,
		Price:          pkg.Price,
		BroadcastLimit: pkg.BroadcastLimit,
		AILimit:        pkg.AILimit,
		MaxSessions:    pkg.MaxSessions,
		MaxBots:        pkg.MaxBots,
		DurationDays:   pkg.DurationDays,
		TrialDays:      pkg.TrialDays,
		IsTrialEnabled: pkg.IsTrialEnabled,
		ActiveModules:  pkg.ActiveModules,
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    publicPackage,
	})
}
