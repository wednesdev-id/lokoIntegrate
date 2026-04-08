package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type SubscriptionLicenseStatus string

const (
	LicenseStatusAvailable SubscriptionLicenseStatus = "available"
	LicenseStatusActive    SubscriptionLicenseStatus = "active"
	LicenseStatusExpired   SubscriptionLicenseStatus = "expired"
	LicenseStatusRevoked   SubscriptionLicenseStatus = "revoked"
)

type SubscriptionLicense struct {
	ID                    uuid.UUID                 `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Key                   string                    `gorm:"type:varchar(50);uniqueIndex;not null" json:"key"` // e.g. LOKO-XXXX-YYYY
	SubscriptionPackageID uuid.UUID                 `gorm:"type:uuid;not null;index" json:"subscription_package_id"`
	SubscriptionPackage   *SubscriptionPackage      `gorm:"foreignKey:SubscriptionPackageID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;" json:"subscription_package,omitempty"`
	Status                SubscriptionLicenseStatus `gorm:"type:varchar(20);default:'available';not null;index" json:"status"`
	UsedByUserID          *uuid.UUID                `gorm:"type:uuid;index" json:"used_by_user_id,omitempty"`
	UsedByUser            *User                     `gorm:"foreignKey:UsedByUserID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;" json:"used_by_user,omitempty"`
	ActivatedAt           *time.Time                `json:"activated_at,omitempty"`
	ExpiresAt             *time.Time                `json:"expires_at,omitempty"`
	CreatedAt             time.Time                 `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt             time.Time                 `gorm:"autoUpdateTime" json:"updated_at"`
}

// BeforeCreate will set a UUID rather than numeric ID.
func (base *SubscriptionLicense) BeforeCreate(tx *gorm.DB) error {
	base.ID = uuid.New()
	return nil
}
