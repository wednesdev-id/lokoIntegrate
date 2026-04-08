package middleware

import (
	"loko/server/env"
	"loko/server/util"
	"fmt"
	"runtime/debug"

	"github.com/gofiber/fiber/v2"
)

// Error handling middleware
func ErrorHandler() fiber.Handler {
	return func(c *fiber.Ctx) error {
		defer func() {
			if r := recover(); r != nil {
				error_message := fmt.Sprintf("FROM: %s\nRecovered from panic: %v\nStack Trace: %s", env.GetServerName(), r, debug.Stack())
				// fmt.Println(error_message)
				if len(error_message) > 1000 {
					error_message = error_message[:1000] // Potong ke 1000 karakter
				}
				options := util.RestOptions{
					Method: "POST",
					URL:    "https://remoteworker.id/api/bot/discord/v1/send-message/channel/loko-server-error",
					Body: map[string]any{
						"message": error_message,
					},
				}
				_, restErr := util.RestHit[any](options)
				if restErr.Message != "" {
					fmt.Println("Error Message:", restErr)
				}
				if restErr.Response != "" {
					fmt.Println("Error Response:", restErr)
				}
				// Kirimkan respon error ke client
				c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
					"error": "Internal Server Error",
				})
				return
			}
		}()
		return c.Next()
	}
}
