package middleware

import (
	"loko/server/variable"
	"time"

	"github.com/gofiber/fiber/v2"
)

// CheckLicense middleware checks if the user has a valid subscription license
func CheckLicense(c *fiber.Ctx) error {
	roleCode, _ := c.Locals("role_code").(string)

	// Super Admin bypass
	if roleCode == variable.SuperAdmin {
		return c.Next()
	}

	// Get subscription expiration from context (set by UseAuth)
	expiredAt, ok := c.Locals("subscription_expired_at").(*time.Time)

	// If no expiration date is set (nil), or if it's in the past
	if !ok || expiredAt == nil || expiredAt.Before(time.Now()) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"code":    "SUBSCRIPTION_EXPIRED",
			"message": "Your subscription has expired or is invalid. Please renew your license.",
		})
	}

	return c.Next()
}
