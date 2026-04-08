package middleware

import (
	"github.com/gofiber/fiber/v2"
)

func OnlyMicroservice(c *fiber.Ctx) error {
	service_name := c.Get("X-loko-SERVICE")
	if service_name == "" {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "only microservice !!!",
		})
	}
	c.Locals("service_name", service_name)
	// fmt.Printf("service_name: %s\n", service_name)
	return c.Next()
}
