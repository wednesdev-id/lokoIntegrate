package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// PaymentMethod model
type PaymentMethod struct {
	ID              uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	UserID          uuid.UUID      `gorm:"type:uuid;index" json:"user_id"` // Merchant/Admin ID
	PaymentName     string         `gorm:"not null" json:"payment_name"`
	PaymentType     string         `gorm:"not null" json:"payment_type"` // bank_transfer, qris, e-wallet
	Provider        string         `json:"provider"`                     // BCA, GoPay, etc
	AccountName     string         `json:"account_name"`
	AccountNumber   string         `json:"account_number"`
	PaymentImageURL string         `json:"payment_image_url"`
	Instructions    string         `gorm:"type:text" json:"instructions"`
	Status          string         `gorm:"default:'active'" json:"status"`
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
	DeletedAt       gorm.DeletedAt `gorm:"index" json:"-"`
}

func (p *PaymentMethod) BeforeCreate(tx *gorm.DB) (err error) {
	if p.ID == uuid.Nil {
		p.ID, err = uuid.NewV7()
	}
	return
}

func (PaymentMethod) TableName() string {
	return "payments"
}

// PaymentProof model
type PaymentProof struct {
	ID                 uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	OrderID            uuid.UUID      `gorm:"type:uuid;not null;index" json:"order_id"`
	PhoneNumber        string         `gorm:"not null" json:"phone_number"` // Sender phone
	MediaURL           string         `gorm:"not null" json:"media_url"`
	Notes              string         `gorm:"type:text" json:"notes"`
	VerificationStatus string         `gorm:"default:'pending'" json:"verification_status"` // pending, verified, rejected
	VerifiedBy         *uuid.UUID     `gorm:"type:uuid" json:"verified_by"`                 // User ID of admin
	VerifiedAt         *time.Time     `json:"verified_at"`
	CreatedAt          time.Time      `json:"created_at"`
	UpdatedAt          time.Time      `json:"updated_at"`
	DeletedAt          gorm.DeletedAt `gorm:"index" json:"-"`
}

func (pp *PaymentProof) BeforeCreate(tx *gorm.DB) (err error) {
	if pp.ID == uuid.Nil {
		pp.ID, err = uuid.NewV7()
	}
	return
}

func (PaymentProof) TableName() string {
	return "payment_proofs"
}
