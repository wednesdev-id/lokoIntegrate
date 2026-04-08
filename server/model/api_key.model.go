package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ApiKey represents an AI API Key managed by Super Admin
type ApiKey struct {
	ID        uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	Code      string         `gorm:"type:varchar(50);uniqueIndex;not null" json:"code"` // e.g., "OPENAI_SUPPORT"
	Provider  string         `gorm:"type:varchar(50);not null" json:"provider"`        // openrouter, openai, gemini
	Name      string         `gorm:"type:varchar(100);not null" json:"name"`           // e.g., "OpenAI Main"
	Key       string         `gorm:"type:text;not null" json:"-"`                      // Secret Key (hidden from JSON)
	Models    string         `gorm:"type:text" json:"models"`                          // Comma-separated models
	WebhookURL string         `gorm:"type:varchar(255)" json:"webhook_url"`
	IsActive  bool           `gorm:"default:true" json:"is_active"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

func (a *ApiKey) BeforeCreate(tx *gorm.DB) (err error) {
	if a.ID == uuid.Nil {
		a.ID, err = uuid.NewV7()
	}
	return
}

func (ApiKey) TableName() string {
	return "api_keys"
}
