package module

import (
	"loko/server/connection"
	"loko/server/middleware"
	"loko/server/model"
	"loko/server/util"
	"time"

	"github.com/gofiber/fiber/v2"
)

type Profile struct{}

func (ref Profile) Route(api fiber.Router) {
	handler := ProfileHandler{}

	profile := api.Group("/profile", middleware.UseAuth)
	profile.Get("/", handler.GetProfile)
	profile.Put("/", handler.UpdateProfile)
	profile.Put("/password", handler.UpdatePassword)
}

type ProfileHandler struct{}

func (handler ProfileHandler) GetProfile(c *fiber.Ctx) error {
	userID, _ := c.Locals("user_id").(string)

	sql := connection.SQL{}
	db, err := sql.Connect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Database connection failed"})
	}

	var user model.User
	if err := db.Preload("SubscriptionPackage").Where("id = ?", userID).First(&user).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"message": "User not found"})
	}

	return c.JSON(model.UserResponse{
		ID:                    user.ID,
		Name:                  user.Name,
		Email:                 user.Email,
		Username:              user.Username,
		IsVerify:              user.IsVerify,
		IsActive:              user.IsActive,
		RoleID:                user.RoleID,
		Credits:               user.Credits,
		AIQuota:               user.AIQuota,
		ProjectCount:          user.ProjectCount,
		MaxProjects:           user.MaxProjects,
		BroadcastQuota:        user.BroadcastQuota,
		SubscriptionPackageID: user.SubscriptionPackageID,
		SubscriptionPackage:   user.SubscriptionPackage,
		SubscriptionExpiredAt: user.SubscriptionExpiredAt,
		BusinessAddress:       user.BusinessAddress,
		BusinessSector:        user.BusinessSector,
		CreatedAt:             user.CreatedAt,
	})
}

type UpdateProfileBody struct {
	Name            string `json:"name"`
	BusinessAddress string `json:"business_address"`
	BusinessSector  string `json:"business_sector"`
}

func (handler ProfileHandler) UpdateProfile(c *fiber.Ctx) error {
	userID, _ := c.Locals("user_id").(string)

	var body UpdateProfileBody
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Invalid request body"})
	}

	sql := connection.SQL{}
	db, err := sql.Connect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Database connection failed"})
	}

	if err := db.Model(&model.User{}).Where("id = ?", userID).Updates(map[string]interface{}{
		"name":             body.Name,
		"business_address": body.BusinessAddress,
		"business_sector":  body.BusinessSector,
		"updated_at":       time.Now(),
	}).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to update profile"})
	}

	return c.JSON(fiber.Map{"message": "Profile updated successfully"})
}

type UpdatePasswordBody struct {
	CurrentPassword string `json:"current_password"`
	NewPassword     string `json:"new_password"`
}

func (handler ProfileHandler) UpdatePassword(c *fiber.Ctx) error {
	userID, _ := c.Locals("user_id").(string)

	var body UpdatePasswordBody
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Invalid request body"})
	}

	sql := connection.SQL{}
	db, err := sql.Connect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Database connection failed"})
	}

	var user model.User
	if err := db.Where("id = ?", userID).First(&user).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"message": "User not found"})
	}

	// Verify current password
	if !util.CheckPasswordHash(body.CurrentPassword, user.Password) {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"message": "Current password incorrect"})
	}

	// Hash new password
	hashed, err := util.HashPassword(body.NewPassword)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to hash new password"})
	}

	if err := db.Model(&user).Update("password", hashed).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to update password"})
	}

	return c.JSON(fiber.Map{"message": "Password updated successfully"})
}
