package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Cart model
type Cart struct {
	ID          uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	PhoneNumber string         `gorm:"uniqueIndex;not null" json:"phone_number"` // Customer phone
	SessionID   *string        `gorm:"index" json:"session_id"`                  // WhatsApp Session ID (optional link)
	Status      string         `gorm:"default:'active'" json:"status"`           // active, converted_to_order, abandoned
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`

	// Relationships
	Items []CartItem `gorm:"foreignKey:CartID" json:"items,omitempty"`
}

func (c *Cart) BeforeCreate(tx *gorm.DB) (err error) {
	if c.ID == uuid.Nil {
		c.ID, err = uuid.NewV7()
	}
	return
}

func (Cart) TableName() string {
	return "carts"
}

// CartItem model
type CartItem struct {
	ID          uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	CartID      uuid.UUID      `gorm:"type:uuid;not null;index" json:"cart_id"`
	ProductID   uuid.UUID      `gorm:"type:uuid;not null;index" json:"product_id"`
	ProductName string         `json:"product_name"`
	ProductType string         `json:"product_type"`
	Price       float64        `gorm:"not null" json:"price"`
	Quantity    int            `gorm:"not null;default:1" json:"quantity"`
	Subtotal    float64        `gorm:"not null" json:"subtotal"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

func (ci *CartItem) BeforeCreate(tx *gorm.DB) (err error) {
	if ci.ID == uuid.Nil {
		ci.ID, err = uuid.NewV7()
	}
	return
}

func (CartItem) TableName() string {
	return "cart_items"
}
