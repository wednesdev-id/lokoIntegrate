package device

import (
	"encoding/base64"
	"loko/server/connection"
	"loko/server/response"
	"time"

	"github.com/gofiber/fiber/v2"
)

// GetQRCode returns the current QR code for authentication
// @Summary Get WhatsApp QR code
// @Description Get the QR code for WhatsApp authentication
// @Tags WhatsApp
// @Accept json
// @Produce json
// @Success 200 {object} response.WhatsAppBaseResponse
// @Failure 404 {object} response.ErrorResponse
// @Router /whatsapp/qr [get]
func (h *Handler) GetQRCode(c *fiber.Ctx) error {
	if connection.WhatsAppQrCode == "" {
		return c.Status(fiber.StatusNotFound).JSON(response.ErrorResponse{
			Success: false,
			Message: "QR code not available",
			Error:   "No QR code generated or device already connected",
		})
	}

	return c.Status(fiber.StatusOK).JSON(response.NewSuccessResponse("QR code retrieved", fiber.Map{
		"qr_code": connection.WhatsAppQrCode,
	}))
}

// GetQRImage returns QR code as PNG image for direct display in web
// @Summary Get WhatsApp QR code as PNG image
// @Description Get the QR code as PNG image for WhatsApp authentication (can be directly used in <img> tags)
// @Tags WhatsApp Device
// @Accept json
// @Produce png
// @Success 200 {file} binary "QR Code PNG image"
// @Failure 404 {object} response.ErrorResponse
// @Failure 503 {object} response.ErrorResponse
// @Router /whatsapp/device/qr-image [get]
func (h *Handler) GetQRImage(c *fiber.Ctx) error {
	// Check if already connected and logged in
	if connection.WhatsAppClient != nil && connection.WhatsAppClient.IsLoggedIn() {
		return c.Status(fiber.StatusFound).JSON(response.NewSuccessResponse("WhatsApp already connected", fiber.Map{
			"status":       "connected",
			"phone_number": connection.WhatsAppClient.Store.ID.User,
			"jid":          connection.WhatsAppClient.Store.ID.String(),
			"push_name":    connection.WhatsAppClient.Store.PushName,
			"message":      "Device is already connected. No QR code needed.",
		}))
	}

	// Check if QR code is available
	if connection.WhatsAppQrCode != "" {
		// Decode base64 to get image bytes
		qrBytes, err := base64.StdEncoding.DecodeString(connection.WhatsAppQrCode)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(response.ErrorResponse{
				Success: false,
				Message: "Failed to decode QR code",
				Error:   err.Error(),
			})
		}

		// Set appropriate headers for PNG image
		c.Set("Content-Type", "image/png")
		c.Set("Cache-Control", "no-cache, no-store, must-revalidate")
		c.Set("Pragma", "no-cache")
		c.Set("Expires", "0")

		return c.Status(fiber.StatusOK).Send(qrBytes)
	}

	// Initialize WhatsApp connection if not already done
	if connection.WhatsAppClient == nil || connection.IsConnecting() {
		whatsapp := connection.WhatsApp{}
		whatsapp.Connect()

		// Wait a moment for QR code generation
		time.Sleep(2 * time.Second)

		// Check again if QR code is available now
		if connection.WhatsAppQrCode != "" {
			// Decode base64 to get image bytes
			qrBytes, err := base64.StdEncoding.DecodeString(connection.WhatsAppQrCode)
			if err != nil {
				return c.Status(fiber.StatusInternalServerError).JSON(response.ErrorResponse{
					Success: false,
					Message: "Failed to decode QR code",
					Error:   err.Error(),
				})
			}

			// Set appropriate headers for PNG image
			c.Set("Content-Type", "image/png")
			c.Set("Cache-Control", "no-cache, no-store, must-revalidate")
			c.Set("Pragma", "no-cache")
			c.Set("Expires", "0")

			return c.Status(fiber.StatusOK).Send(qrBytes)
		}
	}

	// QR code not available yet - return JSON with instructions
	return c.Status(fiber.StatusAccepted).JSON(response.NewSuccessResponse("Generating QR code", fiber.Map{
		"status":      "generating",
		"message":     "QR code is being generated. Please wait a moment and try again.",
		"retry_after": 2, // seconds
	}))
}
