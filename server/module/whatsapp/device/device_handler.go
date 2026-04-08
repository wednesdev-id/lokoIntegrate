package device

import (
	"database/sql"
	"loko/server/cache"
	"loko/server/connection"
	"loko/server/dto"
	"loko/server/response"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

// Handler handles device-related HTTP requests
type Handler struct {
	DB    *gorm.DB
	SqlDB *sql.DB
	Cache cache.ChatCache
}

// NewHandler creates a new device handler
func NewHandler(db *gorm.DB, sqlDB *sql.DB, cache cache.ChatCache) *Handler {
	return &Handler{
		DB:    db,
		SqlDB: sqlDB,
		Cache: cache,
	}
}

// GetDevices returns list of connected WhatsApp devices
// @Summary Get list of WhatsApp devices
// @Description Get list of all connected WhatsApp devices
// @Tags WhatsApp Device
// @Accept json
// @Produce json
// @Success 200 {object} response.WhatsAppPaginatedResponse
// @Failure 503 {object} response.ErrorResponse
// @Router /whatsapp/devices [get]
func (h *Handler) GetDevices(c *fiber.Ctx) error {
	var devices []dto.DeviceStatusResponse

	// For now, we only support single device connection
	// In the future, this can be extended to support multiple devices
	if connection.WhatsAppClient != nil {
		deviceStatus := dto.DeviceStatusResponse{
			IsConnected: connection.WhatsAppClient.IsConnected(),
			IsLoggedIn:  connection.WhatsAppClient.IsLoggedIn(),
		}

		if connection.WhatsAppClient.IsLoggedIn() {
			deviceStatus.JID = connection.WhatsAppClient.Store.ID.String()
			deviceStatus.PushName = connection.WhatsAppClient.Store.PushName
			deviceStatus.PhoneNumber = connection.WhatsAppClient.Store.ID.User
		}

		if connection.WhatsAppQrCode != "" {
			deviceStatus.QRCode = &connection.WhatsAppQrCode
		}

		devices = append(devices, deviceStatus)
	}

	return c.Status(fiber.StatusOK).JSON(response.WhatsAppPaginatedResponse{
		Success: true,
		Message: "Devices retrieved successfully",
		Data:    devices,
		Pagination: response.Pagination{
			CurrentPage: 1,
			PerPage:     10,
			Total:       int64(len(devices)),
			TotalPages:  1,
			HasNext:     false,
			HasPrev:     false,
		},
	})
}

// GetDeviceStatus returns the current device connection status
// @Summary Get WhatsApp device status
// @Description Get the current connection and login status of WhatsApp device
// @Tags WhatsApp
// @Accept json
// @Produce json
// @Success 200 {object} dto.DeviceStatusResponse
// @Failure 503 {object} response.ErrorResponse
// @Router /whatsapp/device/status [get]
func (h *Handler) GetDeviceStatus(c *fiber.Ctx) error {
	if connection.WhatsAppClient == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(response.ErrorResponse{
			Success: false,
			Message: "WhatsApp client not initialized",
			Error:   "Client not available",
		})
	}

	deviceStatus := dto.DeviceStatusResponse{
		IsConnected: connection.WhatsAppClient.IsConnected(),
		IsLoggedIn:  connection.WhatsAppClient.IsLoggedIn(),
	}

	if connection.WhatsAppClient.IsLoggedIn() {
		deviceStatus.JID = connection.WhatsAppClient.Store.ID.String()
		deviceStatus.PushName = connection.WhatsAppClient.Store.PushName
		deviceStatus.PhoneNumber = connection.WhatsAppClient.Store.ID.User
	}

	if connection.WhatsAppQrCode != "" {
		deviceStatus.QRCode = &connection.WhatsAppQrCode
	}

	return c.Status(fiber.StatusOK).JSON(response.NewSuccessResponse("Device status retrieved", deviceStatus))
}

// DisconnectDevice disconnects the WhatsApp client
// @Summary Disconnect WhatsApp device
// @Description Disconnect the WhatsApp client
// @Tags WhatsApp Device
// @Accept json
// @Produce json
// @Success 200 {object} response.WhatsAppBaseResponse
// @Failure 503 {object} response.ErrorResponse
// @Router /whatsapp/device/disconnect [post]
func (h *Handler) DisconnectDevice(c *fiber.Ctx) error {
	if connection.WhatsAppClient == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(response.ErrorResponse{
			Success: false,
			Message: "WhatsApp client not initialized",
			Error:   "Client not available",
		})
	}

	whatsapp := connection.WhatsApp{}
	whatsapp.Disconnect()

	return c.Status(fiber.StatusOK).JSON(response.NewSuccessResponse("Device disconnected successfully", nil))
}
