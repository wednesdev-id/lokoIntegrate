package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Bot model for WhatsApp AI Bots
type Bot struct {
	ID            uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	UserID        string         `gorm:"not null;index" json:"user_id"`
	Name          string         `gorm:"not null" json:"name"`
	Description   string         `json:"description"`
	Instruction   string         `gorm:"type:text" json:"instruction"` // The brief/prompt for the AI (training)
	BotCode       string         `gorm:"type:uuid;uniqueIndex;not null" json:"bot_code"`
	Trigger       string         `json:"trigger"` // Optional: keywords to trigger this specific bot if needed
	IsActive      bool           `gorm:"default:true" json:"is_active"`

	// Template reference (optional)
	TemplateID    *uuid.UUID     `gorm:"type:uuid" json:"template_id,omitempty"` // If created from a template

	// AI Settings (inherited from subscription package, can be customized per bot if needed)
	Temperature   *float64      `json:"temperature,omitempty"`   // Optional override from subscription
	MaxTokens    *int          `json:"max_tokens,omitempty"`    // Optional override from subscription

	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
}

func (b *Bot) BeforeCreate(tx *gorm.DB) (err error) {
	if b.ID == uuid.Nil {
		b.ID, err = uuid.NewV7()
	}
	if b.BotCode == "" {
		// Ensure BotCode is a valid UUIDv7
		var code uuid.UUID
		code, err = uuid.NewV7()
		if err == nil {
			b.BotCode = code.String()
		}
	}
	return
}

func (Bot) TableName() string {
	return "bots"
}
