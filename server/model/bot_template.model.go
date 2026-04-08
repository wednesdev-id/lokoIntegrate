package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// BotTemplate represents predefined bot templates that customers can use
type BotTemplate struct {
	ID          uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	Name        string         `gorm:"not null" json:"name"`
	Description string         `json:"description"`
	Category    string         `gorm:"default:'general'" json:"category"` // sales, support, general, etc.
	Instruction string         `gorm:"type:text;not null" json:"instruction"` // The prompt/brief for the bot
	IsActive    bool           `gorm:"default:true" json:"is_active"`
	IsSystem    bool           `gorm:"default:false" json:"is_system"` // System templates vs user-created templates
	UserID      *string        `gorm:"index" json:"user_id,omitempty"` // Optional: if user-created
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

func (b *BotTemplate) BeforeCreate(tx *gorm.DB) (err error) {
	if b.ID == uuid.Nil {
		b.ID, err = uuid.NewV7()
	}
	return
}

func (BotTemplate) TableName() string {
	return "bot_templates"
}
