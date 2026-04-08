package module

import (
	"fmt"
	"log"
	"loko/server/middleware"
	"loko/server/model"
	"loko/server/variable"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type Subscription struct{}

func (ref Subscription) Route(api fiber.Router) {
	handler := SubscriptionHandler{}

	// Protect with Auth
	sub := api.Group("/subscription-packages", middleware.UseAuth)

	// Admin and Customer can view packages (GET / must come first)
	sub.Get("/", middleware.RoleAccess([]string{variable.SuperAdmin, variable.Customer}), handler.ListPackages)

	// License Management (MUST be registered BEFORE wildcard /:id routes)
	licAdmin := sub.Group("/licenses", middleware.RoleAccess([]string{variable.SuperAdmin}))
	licAdmin.Post("/generate", handler.GenerateLicenses)
	licAdmin.Get("/", handler.ListLicenses)
	licAdmin.Put("/:id/revoke", handler.RevokeLicense)
	licAdmin.Delete("/:id", handler.DeleteLicense)

	// Redeem (Accessible by Customer and Admin)
	sub.Post("/redeem", middleware.RoleAccess([]string{variable.SuperAdmin, variable.Customer}), handler.RedeemLicense)

	// Purchase History (Accessible by Customer)
	sub.Get("/history", middleware.RoleAccess([]string{variable.SuperAdmin, variable.Customer}), handler.GetPurchaseHistory)

	// Get packages with connected devices count (Super Admin only)
	sub.Get("/with-stats", middleware.RoleAccess([]string{variable.SuperAdmin}), handler.ListPackagesWithStats)

	// Only Super Admin can modify packages (wildcard /:id LAST to avoid interception)
	sub.Get("/:id", middleware.RoleAccess([]string{variable.SuperAdmin, variable.Customer}), handler.GetPackage)
	subAdmin := sub.Group("/", middleware.RoleAccess([]string{variable.SuperAdmin}))
	subAdmin.Post("/", handler.CreatePackage)
	subAdmin.Put("/:id", handler.UpdatePackage)
	subAdmin.Delete("/:id", handler.DeletePackage)
}

type SubscriptionHandler struct{}

// --- ListPackages ---
func (handler SubscriptionHandler) ListPackages(c *fiber.Ctx) error {
	db, err := dbConnect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Database connection failed"})
	}

	var packages []model.SubscriptionPackage
	if err := db.Order("created_at DESC").Find(&packages).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to retrieve subscription packages"})
	}

	return c.JSON(fiber.Map{"data": packages})
}

// --- ListPackagesWithStats ---
func (handler SubscriptionHandler) ListPackagesWithStats(c *fiber.Ctx) error {
	db, err := dbConnect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Database connection failed"})
	}

	var packages []model.SubscriptionPackage
	if err := db.Order("created_at DESC").Find(&packages).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to retrieve subscription packages"})
	}

	// For each package, get the count of connected sessions
	type PackageStats struct {
		model.SubscriptionPackage
		ConnectedSessions int `json:"connected_sessions"`
		TotalUsers       int `json:"total_users"`
	}

	var stats []PackageStats
	for _, pkg := range packages {
		var connectedSessions int64
		var totalUsers int64

		// Count connected sessions for users with this package
		db.Model(&model.WhatsAppSessionModel{}).
			Joins("JOIN users ON users.subscription_package_id = ?", pkg.ID).
			Where("users.subscription_package_id = ? AND whatsapp_session_models.status IN (?, ?)", pkg.ID, "connected", "qr_ready").
			Count(&connectedSessions)

		// Count users with this active package
		db.Model(&model.User{}).
			Where("subscription_package_id = ?", pkg.ID).
			Count(&totalUsers)

		stats = append(stats, PackageStats{
			SubscriptionPackage: pkg,
			ConnectedSessions:   int(connectedSessions),
			TotalUsers:         int(totalUsers),
		})
	}

	return c.JSON(fiber.Map{"data": stats})
}

// --- GetPackage ---
func (handler SubscriptionHandler) GetPackage(c *fiber.Ctx) error {
	id := c.Params("id")

	db, err := dbConnect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Database connection failed"})
	}

	var pkg model.SubscriptionPackage
	if err := db.Where("id = ?", id).First(&pkg).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"message": "Subscription package not found"})
	}

	return c.JSON(pkg)
}

// --- CreatePackage ---
type CreatePackageBody struct {
	Name           string  `json:"name"`
	Description    string  `json:"description"`
	Price          float64 `json:"price"`
	BroadcastLimit int     `json:"broadcast_limit"`
	AILimit        int     `json:"ai_limit"`
	MaxSessions    int     `json:"max_sessions"`
	MaxBots        int     `json:"max_bots"`
	DurationDays   int     `json:"duration_days"`
	TrialDays      int     `json:"trial_days"`
	IsTrialEnabled *bool   `json:"is_trial_enabled"`
	IsActive       bool    `json:"is_active"`
	ActiveModules  string  `json:"active_modules"`
}

func (handler SubscriptionHandler) CreatePackage(c *fiber.Ctx) error {
	var body CreatePackageBody
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Invalid request body"})
	}

	if body.Name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Name is required"})
	}

	db, err := dbConnect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Database connection failed"})
	}

	if body.DurationDays <= 0 {
		body.DurationDays = 30 // Default 30 days
	}

	// Allow -1 for unlimited, otherwise default to 1 if <= 0
	if body.MaxSessions == 0 {
		body.MaxSessions = 1 // Default 1 session
	}

	if body.MaxBots == 0 {
		body.MaxBots = 1 // Default 1 bot
	}

	if body.TrialDays <= 0 {
		body.TrialDays = 7 // Default 7 days trial
	}

	isTrialEnabled := true
	if body.IsTrialEnabled != nil {
		isTrialEnabled = *body.IsTrialEnabled
	}

	pkg := model.SubscriptionPackage{
		Name:           body.Name,
		Description:    body.Description,
		Price:          body.Price,
		BroadcastLimit: body.BroadcastLimit,
		AILimit:        body.AILimit,
		MaxSessions:    body.MaxSessions,
		MaxBots:        body.MaxBots,
		DurationDays:   body.DurationDays,
		TrialDays:      body.TrialDays,
		IsTrialEnabled: isTrialEnabled,
		IsActive:       body.IsActive,
		ActiveModules:  body.ActiveModules,
	}

	if err := db.Create(&pkg).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to create subscription package"})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message": "Subscription package created successfully",
		"data":    pkg,
	})
}

// --- GetPurchaseHistory ---
func (handler SubscriptionHandler) GetPurchaseHistory(c *fiber.Ctx) error {
	userID, _ := c.Locals("user_id").(string)
	uid, err := uuid.Parse(userID)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"message": "Invalid user token"})
	}

	db, err := dbConnect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Database connection failed"})
	}

	var history []model.SubscriptionLicense
	// We only show licenses that have been activated by this user
	if err := db.Preload("SubscriptionPackage").
		Where("used_by_user_id = ?", uid).
		Order("activated_at DESC").
		Find(&history).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to retrieve purchase history"})
	}

	return c.JSON(fiber.Map{"data": history})
}

// --- UpdatePackage ---
type UpdatePackageBody struct {
	Name           string  `json:"name"`
	Description    string  `json:"description"`
	Price          float64 `json:"price"`
	BroadcastLimit int     `json:"broadcast_limit"`
	AILimit        int     `json:"ai_limit"`
	MaxSessions    int     `json:"max_sessions"`
	MaxBots        int     `json:"max_bots"`
	DurationDays   int     `json:"duration_days"`
	TrialDays      int     `json:"trial_days"`
	IsTrialEnabled *bool   `json:"is_trial_enabled"`
	IsActive       *bool   `json:"is_active"`
	ActiveModules  *string `json:"active_modules"`
}

func (handler SubscriptionHandler) UpdatePackage(c *fiber.Ctx) error {
	id := c.Params("id")

	var body UpdatePackageBody
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Invalid request body"})
	}

	db, err := dbConnect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Database connection failed"})
	}

	uid, err := uuid.Parse(id)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Invalid package ID"})
	}

	var pkg model.SubscriptionPackage
	if err := db.Where("id = ?", uid).First(&pkg).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"message": "Subscription package not found"})
	}

	if body.Name != "" {
		pkg.Name = body.Name
	}
	if body.Description != "" {
		pkg.Description = body.Description
	}
	pkg.Price = body.Price
	pkg.BroadcastLimit = body.BroadcastLimit
	pkg.AILimit = body.AILimit
	// Allow -1 for unlimited
	if body.MaxSessions != 0 {
		pkg.MaxSessions = body.MaxSessions
	}
	if body.MaxBots != 0 {
		pkg.MaxBots = body.MaxBots
	}
	if body.DurationDays > 0 {
		pkg.DurationDays = body.DurationDays
	}
	if body.TrialDays > 0 {
		pkg.TrialDays = body.TrialDays
	}
	if body.IsTrialEnabled != nil {
		pkg.IsTrialEnabled = *body.IsTrialEnabled
	}
	if body.IsActive != nil {
		pkg.IsActive = *body.IsActive
	}
	if body.ActiveModules != nil {
		pkg.ActiveModules = *body.ActiveModules
	}

	if err := db.Save(&pkg).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to update subscription package"})
	}

	// Synchronize new quotas with users currently subscribed to this package
	if err := db.Model(&model.User{}).
		Where("subscription_package_id = ?", pkg.ID).
		Updates(map[string]interface{}{
			"ai_quota":        pkg.AILimit,
			"broadcast_quota": pkg.BroadcastLimit,
		}).Error; err != nil {
		log.Printf("Failed to sync updated quotas to users for package %s: %v", pkg.ID, err)
	}

	return c.JSON(fiber.Map{
		"message": "Subscription package updated successfully",
		"data":    pkg,
	})
}

// --- DeletePackage ---
func (handler SubscriptionHandler) DeletePackage(c *fiber.Ctx) error {
	id := c.Params("id")

	db, err := dbConnect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Database connection failed"})
	}

	result := db.Where("id = ?", id).Delete(&model.SubscriptionPackage{})
	if result.Error != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to delete subscription package"})
	}
	if result.RowsAffected == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"message": "Subscription package not found"})
	}

	// Related licenses will be cascade deleted if constraint is set, otherwise might need manual delete if we care.
	// Since we set OnDelete:CASCADE on the model, it should be fine.

	return c.JSON(fiber.Map{"message": "Subscription package deleted successfully"})
}

// ==========================================
// License Handlers
// ==========================================

// --- GenerateLicenses ---
type GenerateLicenseBody struct {
	PackageID string `json:"package_id"`
	Quantity  int    `json:"quantity"`
}

func (handler SubscriptionHandler) GenerateLicenses(c *fiber.Ctx) error {
	var body GenerateLicenseBody
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Invalid request body"})
	}

	if body.Quantity <= 0 || body.Quantity > 100 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Quantity must be between 1 and 100"})
	}

	pkgID, err := uuid.Parse(body.PackageID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Invalid package ID"})
	}

	db, err := dbConnect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Database connection failed"})
	}

	var pkg model.SubscriptionPackage
	if err := db.Where("id = ?", pkgID).First(&pkg).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"message": "Subscription package not found"})
	}

	var generatedLicenses []model.SubscriptionLicense

	for i := 0; i < body.Quantity; i++ {
		// Generate random string (e.g., LOKO-XXXX-YYYY)
		randomPart1 := strings.ToUpper(uuid.New().String()[0:4])
		randomPart2 := strings.ToUpper(uuid.New().String()[9:13])
		key := fmt.Sprintf("LOKO-%s-%s", randomPart1, randomPart2)

		lic := model.SubscriptionLicense{
			Key:                   key,
			SubscriptionPackageID: pkg.ID,
			Status:                model.LicenseStatusAvailable,
		}
		generatedLicenses = append(generatedLicenses, lic)
	}

	if err := db.Create(&generatedLicenses).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to generate licenses"})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message": fmt.Sprintf("%d licenses generated successfully", body.Quantity),
		"data":    generatedLicenses,
	})
}

// --- ListLicenses ---
func (handler SubscriptionHandler) ListLicenses(c *fiber.Ctx) error {
	db, err := dbConnect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Database connection failed"})
	}

	var licenses []model.SubscriptionLicense
	if err := db.Preload("SubscriptionPackage").Preload("UsedByUser").Order("created_at DESC").Find(&licenses).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to retrieve licenses"})
	}

	return c.JSON(fiber.Map{"data": licenses})
}

// --- RevokeLicense ---
func (handler SubscriptionHandler) RevokeLicense(c *fiber.Ctx) error {
	id := c.Params("id")

	db, err := dbConnect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Database connection failed"})
	}

	var lic model.SubscriptionLicense
	if err := db.Where("id = ?", id).First(&lic).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"message": "License not found"})
	}

	lic.Status = model.LicenseStatusRevoked
	if err := db.Save(&lic).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to revoke license"})
	}

	return c.JSON(fiber.Map{"message": "License revoked successfully"})
}

// --- DeleteLicense ---
func (handler SubscriptionHandler) DeleteLicense(c *fiber.Ctx) error {
	id := c.Params("id")

	db, err := dbConnect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Database connection failed"})
	}

	result := db.Where("id = ?", id).Delete(&model.SubscriptionLicense{})
	if result.Error != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to delete license"})
	}
	if result.RowsAffected == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"message": "License not found"})
	}

	return c.JSON(fiber.Map{"message": "License deleted successfully"})
}

// --- RedeemLicense ---
type RedeemLicenseBody struct {
	Key string `json:"key"`
}

func (handler SubscriptionHandler) RedeemLicense(c *fiber.Ctx) error {
	var body RedeemLicenseBody
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Invalid request body"})
	}

	if body.Key == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "License key is required"})
	}

	userID, _ := c.Locals("user_id").(string)
	uid, err := uuid.Parse(userID)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"message": "Invalid user token"})
	}

	db, err := dbConnect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Database connection failed"})
	}

	// Begin transaction
	tx := db.Begin()

	var lic model.SubscriptionLicense
	if err := tx.Preload("SubscriptionPackage").Where("key = ?", body.Key).First(&lic).Error; err != nil {
		tx.Rollback()
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"message": "Invalid license key"})
	}

	if lic.Status != model.LicenseStatusAvailable {
		tx.Rollback()
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "License key is no longer available or already used"})
	}

	var user model.User
	if err := tx.Where("id = ?", uid).First(&user).Error; err != nil {
		tx.Rollback()
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "User not found"})
	}

	pkg := lic.SubscriptionPackage
	if pkg == nil {
		tx.Rollback()
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Associated subscription package not found"})
	}

	// Update License Status
	now := time.Now()
	expiresAt := now.Add(time.Duration(pkg.DurationDays) * 24 * time.Hour)

	lic.Status = model.LicenseStatusActive
	lic.UsedByUserID = &uid
	lic.ActivatedAt = &now
	lic.ExpiresAt = &expiresAt

	if err := tx.Save(&lic).Error; err != nil {
		tx.Rollback()
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to update license status"})
	}

	// Update User Quotas and Sub package
	user.SubscriptionPackageID = &pkg.ID
	user.SubscriptionExpiredAt = &expiresAt
	user.BroadcastQuota += pkg.BroadcastLimit // Append or replace? Append is usually better to not lose existing if upgrading, but let's replace as per assign
	user.BroadcastQuota = pkg.BroadcastLimit
	user.AIQuota = pkg.AILimit

	if err := tx.Save(&user).Error; err != nil {
		tx.Rollback()
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to update user quotas"})
	}

	// Log SubscriptionTransaction
	transaction := model.SubscriptionTransaction{
		UserID:        uid,
		PackageID:     pkg.ID,
		OriginalPrice: pkg.Price,
		DiscountAmount: 0, // No discount for standard license key redeem
		ActualPaid:    pkg.Price, // Assume paid original price
		CreatedAt:     now,
	}

	if err := tx.Create(&transaction).Error; err != nil {
		tx.Rollback()
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to log subscription transaction"})
	}

	tx.Commit()

	return c.JSON(fiber.Map{
		"message": "License redeemed successfully",
		"data": map[string]interface{}{
			"package_name": pkg.Name,
			"expires_at":   expiresAt,
			"ai_quota":     user.AIQuota,
			"bc_quota":     user.BroadcastQuota,
		},
	})
}
