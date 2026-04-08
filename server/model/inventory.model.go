package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// InventoryMovement model
type InventoryMovement struct {
	ID            uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	ProductID     uuid.UUID      `gorm:"type:uuid;not null;index" json:"product_id"`
	MovementType  string         `gorm:"not null" json:"movement_type"` // stock_in, stock_out, adjustment, sale
	Quantity      int            `gorm:"not null" json:"quantity"`      // Positive for in, negative for out
	ReferenceType string         `json:"reference_type"`                // order, manual, return
	ReferenceID   *uuid.UUID     `gorm:"type:uuid" json:"reference_id"` // OrderID or other ref
	Notes         string         `gorm:"type:text" json:"notes"`
	CreatedBy     *uuid.UUID     `gorm:"type:uuid" json:"created_by"` // User ID of admin who made the adjustment
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
}

func (im *InventoryMovement) BeforeCreate(tx *gorm.DB) (err error) {
	if im.ID == uuid.Nil {
		im.ID, err = uuid.NewV7()
	}
	return
}

func (InventoryMovement) TableName() string {
	return "inventory_movements"
}
