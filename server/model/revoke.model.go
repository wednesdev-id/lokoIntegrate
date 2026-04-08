package model

import (
	"time"

	"github.com/google/uuid"
)

// Revoke model for PostgreSQL - token revocation
type Revoke struct {
	ID        uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	Email     string    `gorm:"index;not null" json:"email"`
	JWTID     string    `gorm:"column:jwt_id;index;not null" json:"jwt_id"`
	ExpiredAt time.Time `json:"expired_at"`
	LoginAt   time.Time `json:"login_at"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (Revoke) TableName() string {
	return "revokes"
}
