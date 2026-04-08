package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// WhatsAppSessionModel represents WhatsApp session metadata in PostgreSQL
type WhatsAppSessionModel struct {
	ID                uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	SessionCode       string         `gorm:"uniqueIndex;column:session_code;type:varchar(255)" json:"session_code"`
	SessionID         string         `gorm:"uniqueIndex;column:session_id;type:varchar(255)" json:"session_id"`
	UserID            string         `gorm:"index;column:user_id;type:varchar(255)" json:"user_id"`
	SessionName       string         `gorm:"column:session_name;type:varchar(255)" json:"session_name"`
	PhoneNumber       *string        `gorm:"column:phone_number;type:varchar(20)" json:"phone_number,omitempty"`
	Status            string         `gorm:"column:status;type:varchar(50)" json:"status"`
	QRCode            *string        `gorm:"column:qr_code;type:text" json:"qr_code,omitempty"`
	LastConnected     *time.Time     `gorm:"column:last_connected" json:"last_connected,omitempty"`
	QRCodeGeneratedAt *time.Time     `gorm:"column:qr_code_generated_at" json:"qr_code_generated_at,omitempty"`
	AIAutoReply       bool           `gorm:"column:ai_auto_reply;default:false" json:"ai_auto_reply"`
	AIPrompt          string         `gorm:"column:ai_prompt;type:text" json:"ai_prompt"`
	APIKeyID          *uuid.UUID     `gorm:"column:api_key_id;type:uuid" json:"api_key_id,omitempty"`
	APIKey            *ApiKey        `gorm:"foreignKey:APIKeyID" json:"api_key,omitempty"`
	AIModel           string         `gorm:"column:ai_model;type:varchar(50)" json:"ai_model"`
	CreatedAt         time.Time      `gorm:"column:created_at" json:"created_at"`
	UpdatedAt         time.Time      `gorm:"column:updated_at" json:"updated_at"`
	DeletedAt         gorm.DeletedAt `gorm:"index" json:"-"`
}

func (WhatsAppSessionModel) TableName() string {
	return "whatsapp_sessions"
}
