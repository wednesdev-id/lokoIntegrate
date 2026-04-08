package response

import (
	"loko/server/dto"
	"time"
)

// WhatsAppBaseResponse represents base response structure
type WhatsAppBaseResponse struct {
	Success bool        `json:"success"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
	Error   *string     `json:"error,omitempty"`
}

// WhatsAppPaginatedResponse represents paginated response
type WhatsAppPaginatedResponse struct {
	Success    bool        `json:"success"`
	Message    string      `json:"message"`
	Data       interface{} `json:"data"`
	Pagination Pagination  `json:"pagination"`
	Error      *string     `json:"error,omitempty"`
}

// Pagination represents pagination info
type Pagination struct {
	CurrentPage int   `json:"current_page"`
	PerPage     int   `json:"per_page"`
	Total       int64 `json:"total"`
	TotalPages  int   `json:"total_pages"`
	HasNext     bool  `json:"has_next"`
	HasPrev     bool  `json:"has_prev"`
}

// SendMessageSuccessResponse represents successful send message response
type SendMessageSuccessResponse struct {
	Success bool                    `json:"success"`
	Message string                  `json:"message"`
	Data    dto.SendMessageResponse `json:"data"`
}

// GetMessagesSuccessResponse represents successful get messages response
type GetMessagesSuccessResponse struct {
	Success    bool                  `json:"success"`
	Message    string                `json:"message"`
	Data       []dto.MessageResponse `json:"data"`
	Pagination Pagination            `json:"pagination"`
}

// CreateGroupSuccessResponse represents successful create group response
type CreateGroupSuccessResponse struct {
	Success bool                    `json:"success"`
	Message string                  `json:"message"`
	Data    dto.CreateGroupResponse `json:"data"`
}

// GetGroupInfoSuccessResponse represents successful get group info response
type GetGroupInfoSuccessResponse struct {
	Success bool                  `json:"success"`
	Message string                `json:"message"`
	Data    dto.GroupInfoResponse `json:"data"`
}

// GetGroupsSuccessResponse represents successful get groups response
type GetGroupsSuccessResponse struct {
	Success    bool                    `json:"success"`
	Message    string                  `json:"message"`
	Data       []dto.GroupInfoResponse `json:"data"`
	Pagination Pagination              `json:"pagination"`
}

// GetContactsSuccessResponse represents successful get contacts response
type GetContactsSuccessResponse struct {
	Success    bool                  `json:"success"`
	Message    string                `json:"message"`
	Data       []dto.ContactResponse `json:"data"`
	Pagination Pagination            `json:"pagination"`
}

// GetChatsSuccessResponse represents successful get chats response
type GetChatsSuccessResponse struct {
	Success    bool               `json:"success"`
	Message    string             `json:"message"`
	Data       []dto.ChatResponse `json:"data"`
	Pagination Pagination         `json:"pagination"`
}

// DeviceStatusSuccessResponse represents successful device status response
type DeviceStatusSuccessResponse struct {
	Success bool                     `json:"success"`
	Message string                   `json:"message"`
	Data    dto.DeviceStatusResponse `json:"data"`
}

// GetStatusSuccessResponse represents successful get status response
type GetStatusSuccessResponse struct {
	Success    bool                 `json:"success"`
	Message    string               `json:"message"`
	Data       []dto.StatusResponse `json:"data"`
	Pagination Pagination           `json:"pagination"`
}

// ErrorResponse moved to common.response.go

// ValidationErrorResponse represents validation error response
type ValidationErrorResponse struct {
	Success bool                   `json:"success"`
	Message string                 `json:"message"`
	Errors  map[string]interface{} `json:"errors"`
}

// WebhookResponse represents webhook delivery response
type WebhookResponse struct {
	Success   bool      `json:"success"`
	Message   string    `json:"message"`
	EventType string    `json:"event_type"`
	Timestamp time.Time `json:"timestamp"`
}

// Helper functions to create responses

// NewSuccessResponse creates a new success response
func NewSuccessResponse(message string, data interface{}) WhatsAppBaseResponse {
	return WhatsAppBaseResponse{
		Success: true,
		Message: message,
		Data:    data,
	}
}

// NewErrorResponse creates a new error response
func NewErrorResponse(message string, err error) WhatsAppBaseResponse {
	errorMsg := err.Error()
	return WhatsAppBaseResponse{
		Success: false,
		Message: message,
		Error:   &errorMsg,
	}
}

// NewPaginatedResponse creates a new paginated response
func NewPaginatedResponse(message string, data interface{}, pagination Pagination) WhatsAppPaginatedResponse {
	return WhatsAppPaginatedResponse{
		Success:    true,
		Message:    message,
		Data:       data,
		Pagination: pagination,
	}
}

// NewValidationErrorResponse creates a new validation error response
func NewValidationErrorResponse(errors map[string]interface{}) ValidationErrorResponse {
	return ValidationErrorResponse{
		Success: false,
		Message: "Validation failed",
		Errors:  errors,
	}
}

// CalculatePagination calculates pagination info
func CalculatePagination(page, limit int, total int64) Pagination {
	if page <= 0 {
		page = 1
	}
	if limit <= 0 {
		limit = 50
	}

	totalPages := int((total + int64(limit) - 1) / int64(limit))
	hasNext := page < totalPages
	hasPrev := page > 1

	return Pagination{
		CurrentPage: page,
		PerPage:     limit,
		Total:       total,
		TotalPages:  totalPages,
		HasNext:     hasNext,
		HasPrev:     hasPrev,
	}
}
