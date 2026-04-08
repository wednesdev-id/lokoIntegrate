package middleware

import (
	"fmt"
	"loko/server/env"
	"loko/server/response"
	"loko/server/util"
	"strings"

	"github.com/gofiber/fiber/v2"
)

func UseAuth(c *fiber.Ctx) error {
	authHeader := c.Get("Authorization")

	// Fallback: accept token from query parameter (for EventSource/SSE which can't send headers)
	if authHeader == "" {
		queryToken := c.Query("token")
		fmt.Printf("🔍 UseAuth: No AuthHeader. Found QueryToken='%s'\n", queryToken)
		if queryToken != "" {
			authHeader = "Bearer " + queryToken
		}
	} else {
		fmt.Printf("🔍 UseAuth: Found AuthHeader='%s'\n", authHeader)
	}

	if authHeader == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Bearer token required",
		})
	}

	parts := strings.Split(authHeader, " ")
	if len(parts) != 2 || parts[0] != "Bearer" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Invalid Authorization header format",
		})
	}

	auth_service_url := env.GetAuthServiceURL()

	options := util.RestOptions{
		Method: "GET",
		URL:    auth_service_url + "/api/auth/token-validation",
		Headers: map[string]string{
			"Authorization":  authHeader,
			"X-loko-SERVICE": "CORE",
		},
	}
	resp_auth_token_validation, restErr := util.RestHit[response.ResponseAuthTokenValidation](options)
	if restErr.Message != "" {
		fmt.Println("Error Message:", restErr)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Error communicating with auth service",
		})
	}
	if restErr.Response != "" {
		fmt.Println("Error Response:", restErr)
		errorMsg, err := util.ParseErrorResponse(restErr.Response)
		if err != nil {
			fmt.Println("Error parsing response:", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Error parsing auth service response",
			})
		}
		// Sebaiknya gunakan status code yang lebih spesifik jika memungkinkan,
		// misalnya, jika errorMsg mengandung status code dari layanan auth.
		// Untuk sekarang, kita tetap gunakan 500 jika parsing berhasil tapi ada error dari auth service.
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{ // Mengubah ke 401 jika pesan error dari auth service
			"error": errorMsg.Message,
		})
	}

	// Add to context
	// Pastikan resp_auth_token_validation.UserID adalah field yang benar
	// yang berisi ID pengguna yang sudah divalidasi.
	if resp_auth_token_validation == nil || resp_auth_token_validation.UserID == "" {
		// Ini seharusnya tidak terjadi jika validasi token berhasil,
		// tapi sebagai tindakan pencegahan.
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "User ID not found after token validation",
		})
	}
	// Pastikan juga resp_auth_token_validation.RoleCode adalah field yang benar.
	if resp_auth_token_validation.RoleCode == "" {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "User role not found after token validation",
		})
	}
	c.Locals("user_id", resp_auth_token_validation.UserID)
	c.Locals("role_code", resp_auth_token_validation.RoleCode)
	c.Locals("subscription_package_id", resp_auth_token_validation.SubscriptionPackageID)
	c.Locals("subscription_expired_at", resp_auth_token_validation.SubscriptionExpiredAt)

	return c.Next()
}
