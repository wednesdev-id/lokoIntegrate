package model

import (
	"time"

	"github.com/google/uuid"
)

type PromoCode struct {
	ID            uuid.UUID  `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	Code          string     `gorm:"type:varchar(50);uniqueIndex;not null" json:"code"` // e.g., "PROMO50"
	PackageID     *uuid.UUID `gorm:"type:uuid;index" json:"package_id,omitempty"`     // Optional: restrict to a specific package
	DiscountType  string     `gorm:"type:varchar(20);default:'percent';not null" json:"discount_type"` // "percent" or "amount"
	DiscountValue float64    `gorm:"default:0;not null" json:"discount_value"`
	MaxUses       int        `gorm:"default:0;not null" json:"max_uses"` // 0 for unlimited
	UsedCount     int        `gorm:"default:0;not null" json:"used_count"`
	StartDate     time.Time  `json:"start_date"`
	EndDate       time.Time  `json:"end_date"`
	IsActive      bool       `gorm:"default:true;not null" json:"is_active"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

func (PromoCode) TableName() string {
	return "promo_codes"
}
