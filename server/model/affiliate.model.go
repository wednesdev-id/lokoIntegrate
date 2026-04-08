package model

import (
	"time"

	"github.com/google/uuid"
)

type AffiliateCode struct {
	ID             uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	UserID         uuid.UUID `gorm:"type:uuid;not null;index" json:"user_id"`
	User           *User     `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Code           string    `gorm:"type:varchar(50);uniqueIndex;not null" json:"code"` // e.g., "AFF10"
	CommissionRate float64   `gorm:"default:0;not null" json:"commission_rate"`           // percentage e.g., 10 for 10%
	IsActive       bool      `gorm:"default:true;not null" json:"is_active"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

func (AffiliateCode) TableName() string {
	return "affiliate_codes"
}

type SubscriptionTransaction struct {
	ID                  uuid.UUID            `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	UserID              uuid.UUID            `gorm:"type:uuid;not null;index" json:"user_id"`
	User                *User                `gorm:"foreignKey:UserID" json:"user,omitempty"`
	PackageID           uuid.UUID            `gorm:"type:uuid;not null;index" json:"package_id"`
	SubscriptionPackage *SubscriptionPackage `gorm:"foreignKey:PackageID" json:"subscription_package,omitempty"`
	OriginalPrice       float64              `gorm:"default:0;not null" json:"original_price"`
	DiscountAmount      float64              `gorm:"default:0" json:"discount_amount"`
	ActualPaid          float64              `gorm:"default:0;not null" json:"actual_paid"` // OriginalPrice - DiscountAmount
	PromoCode           string               `gorm:"type:varchar(50)" json:"promo_code,omitempty"`
	AffiliateID         *uuid.UUID           `gorm:"type:uuid;index" json:"affiliate_id,omitempty"` // UserID of the affiliate
	AffiliateCommission float64              `gorm:"default:0" json:"affiliate_commission"`
	MediaURL            string               `gorm:"type:text" json:"media_url,omitempty"`
	Notes               string               `gorm:"type:text" json:"notes,omitempty"`
	CreatedAt           time.Time            `json:"created_at"`
}

func (SubscriptionTransaction) TableName() string {
	return "subscription_transactions"
}
