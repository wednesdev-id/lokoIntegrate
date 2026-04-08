package middleware

import (
	"fmt"
	"loko/server/connection"
	"loko/server/model"
	"loko/server/util"
	"strings"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

// Secured middleware for authentication using PostgreSQL
func Secured(c *fiber.Ctx) error {
	authHeader := c.Get("Authorization")
	if authHeader == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"message": "Bearer token is required",
		})
	}

	parts := strings.Split(authHeader, " ")
	if len(parts) != 2 || parts[0] != "Bearer" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"message": "Invalid Authorization header format",
		})
	}

	tokenString := parts[1]

	JWT := util.JWT{}
	claims, err := JWT.Validate(tokenString)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"message": "Invalid token",
		})
	}

	email := claims["email"].(string)
	jti := claims["jti"].(string)

	// Connect to PostgreSQL via GORM
	sql := connection.SQL{}
	db, err := sql.Connect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": fmt.Sprintf("connect database %s", err.Error()),
		})
	}

	// Check if token is revoked
	var revokeCount int64
	err = db.Table("revokes").Where("email = ? AND jwt_id = ?", email, jti).Count(&revokeCount).Error
	if err != nil || revokeCount > 0 {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"message": "token cannot be used",
		})
	}

	// Add claims to context
	c.Locals("claims", claims)

	// Get user from PostgreSQL
	var user model.User
	err = db.Where("email = ?", email).First(&user).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"message": "User not found",
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Database error",
		})
	}

	// Use user.RoleID directly as role_code
	fmt.Printf("Using user.RoleID directly as role_code: %s\n", user.RoleID)

	// Add role_code to context
	c.Locals("role_code", user.RoleID)

	return c.Next()
}
