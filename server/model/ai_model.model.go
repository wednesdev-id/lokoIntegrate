package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// AiModel represents an AI Model Managed by Super Admin
type AiModel struct {
	ID        uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	Provider  string         `gorm:"type:varchar(50);not null" json:"provider"` // openrouter, openai, gemini
	Name      string         `gorm:"type:varchar(100);not null" json:"name"`    // name for display (e.g. Gemini 2.5 Flash)
	ModelCode string         `gorm:"type:varchar(150);not null;uniqueIndex" json:"model_code"` // actual value (google/gemini-2.5-flash)
	IsActive  bool           `gorm:"default:true" json:"is_active"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

func (m *AiModel) BeforeCreate(tx *gorm.DB) (err error) {
	if m.ID == uuid.Nil {
		m.ID, err = uuid.NewV7()
	}
	return
}

func (AiModel) TableName() string {
	return "ai_models"
}
