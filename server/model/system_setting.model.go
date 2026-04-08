package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// SystemSetting represents a global configuration key-value pair in PostgreSQL
type SystemSetting struct {
	ID        uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	Key       string         `gorm:"uniqueIndex;not null;type:varchar(255)" json:"key"`
	Value     string         `gorm:"type:text" json:"value"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

func (s *SystemSetting) BeforeCreate(tx *gorm.DB) (err error) {
	if s.ID == uuid.Nil {
		s.ID, err = uuid.NewV7()
	}
	return
}

func (SystemSetting) TableName() string {
	return "system_settings"
}
