package model

import (
	"time"

	"github.com/google/uuid"
	"github.com/markbates/goth"
	"gorm.io/gorm"
)

// User model for PostgreSQL with GORM
type User struct {
	ID         uuid.UUID  `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	Name       string     `gorm:"not null" json:"name"`
	ImageURL   *string    `json:"image_url,omitempty"`
	Email      *string    `gorm:"unique" json:"email,omitempty"`
	Username   string     `gorm:"unique;not null" json:"username"`
	Password   string     `gorm:"not null" json:"password"`
	IsVerify   bool       `gorm:"default:false" json:"is_verify"`
	IsActive   bool       `gorm:"default:true" json:"is_active"`
	RoleID     string     `json:"role_id"`
	Provider   string     `json:"provider,omitempty"`
	ProviderID string     `json:"provider_id,omitempty"`
	AvatarURL  string     `json:"avatar_url,omitempty"`
	Credits    float64    `gorm:"default:0" json:"credits"`
	AIQuota    int        `gorm:"default:0" json:"ai_quota"`
	TeamID     *uuid.UUID `gorm:"type:uuid" json:"team_id,omitempty"`

	BusinessAddress string `gorm:"type:text" json:"business_address,omitempty"`
	BusinessSector  string `gorm:"type:varchar(100)" json:"business_sector,omitempty"`

	ProjectCount int `gorm:"default:0" json:"project_count"`
	MaxProjects  int `gorm:"default:5" json:"max_projects"`

	SubscriptionPackageID *uuid.UUID           `gorm:"type:uuid" json:"subscription_package_id,omitempty"`
	SubscriptionPackage   *SubscriptionPackage `gorm:"foreignKey:SubscriptionPackageID" json:"subscription_package,omitempty"`
	SubscriptionExpiredAt *time.Time           `json:"subscription_expired_at,omitempty"`
	BroadcastQuota        int                  `gorm:"default:0" json:"broadcast_quota"`

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

func (u *User) BeforeCreate(tx *gorm.DB) (err error) {
	if u.ID == uuid.Nil {
		u.ID, err = uuid.NewV7()
	}
	return
}

func (User) TableName() string {
	return "users"
}

// DTOs and request bodies
type UserRegisterBody struct {
	Name            string `json:"name"`
	Username        string `json:"username"`
	Password        string `json:"password"`
	BusinessAddress string `json:"business_address"`
	BusinessSector  string `json:"business_sector"`
	PromoCode       string `json:"promo_code,omitempty"`
	AffiliateCode  string `json:"affiliate_code,omitempty"`
}

type UserLoginBody struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type UserResponse struct {
	ID                    uuid.UUID            `json:"id"`
	Name                  string               `json:"name"`
	Email                 *string              `json:"email,omitempty"`
	Username              string               `json:"username"`
	IsVerify              bool                 `json:"is_verify"`
	IsActive              bool                 `json:"is_active"`
	RoleID                string               `json:"role_id"`
	Credits               float64              `json:"credits"`
	AIQuota               int                  `json:"ai_quota"`
	ProjectCount          int                  `json:"project_count"`
	MaxProjects           int                  `json:"max_projects"`
	BroadcastQuota        int                  `json:"broadcast_quota"`
	SubscriptionPackageID *uuid.UUID           `json:"subscription_package_id,omitempty"`
	SubscriptionPackage   *SubscriptionPackage `json:"subscription_package,omitempty"`
	SubscriptionExpiredAt *time.Time           `json:"subscription_expired_at,omitempty"`
	BusinessAddress       string               `json:"business_address,omitempty"`
	BusinessSector        string               `json:"business_sector,omitempty"`
	CreatedAt             time.Time            `json:"created_at"`
}

type GothUser struct {
	goth.User
}
