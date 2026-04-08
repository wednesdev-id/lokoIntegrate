package middleware

import (
	"fmt"

	"github.com/gofiber/fiber/v2"
)

func RoleAccess(allowedRoles []string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		roleCode, ok := c.Locals("role_code").(string)
		if !ok || roleCode == "" {
			// Ini terjadi jika UseAuth tidak berhasil menyetel role_code
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "User role not found in context",
			})
		}

		allowed := false
		for _, role := range allowedRoles {
			if role == roleCode {
				allowed = true
				break
			}
		}

		if allowed {
			return c.Next()
		}
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": fmt.Sprintf("Role '%s' is not authorized to access this resource", roleCode),
		})
	}
}
