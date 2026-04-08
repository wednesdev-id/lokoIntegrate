package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// CustomerSession model (tracks conversation state)
type CustomerSession struct {
	ID                uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	SessionCode       string         `gorm:"index;not null" json:"session_code"` // Link to WhatsAppSession
	PhoneNumber       string         `gorm:"index;not null" json:"phone_number"` // Customer phone
	ConversationState string         `json:"conversation_state"`                 // e.g., "menu", "cart", "checkout"
	CartData          string         `gorm:"type:text" json:"cart_data"`         // JSON string or reference
	LastMessage       string         `gorm:"type:text" json:"last_message"`
	LastInteractionAt time.Time      `json:"last_interaction_at"`
	CreatedAt         time.Time      `json:"created_at"`
	UpdatedAt         time.Time      `json:"updated_at"`
	DeletedAt         gorm.DeletedAt `gorm:"index" json:"-"`
}

func (cs *CustomerSession) BeforeCreate(tx *gorm.DB) (err error) {
	if cs.ID == uuid.Nil {
		cs.ID, err = uuid.NewV7()
	}
	return
}

func (CustomerSession) TableName() string {
	return "customer_sessions"
}
