package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// SubscriptionPackage model for PostgreSQL with GORM
type SubscriptionPackage struct {
	ID               uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	Name             string         `gorm:"not null" json:"name"`
	Description      string         `json:"description"`
	Price            float64        `gorm:"default:0" json:"price"`
	BroadcastLimit    int            `gorm:"default:0" json:"broadcast_limit"`
	AILimit          int            `gorm:"default:0" json:"ai_limit"`
	MaxSessions      int            `gorm:"default:1" json:"max_sessions"`   // Limit number of WhatsApp sessions
	MaxBots          int            `gorm:"default:1" json:"max_bots"`        // Limit number of AI Bots
	DurationDays     int            `gorm:"default:30" json:"duration_days"`
	TrialDays        int            `gorm:"default:7" json:"trial_days"`           // Trial period duration in days (default 7 days)
	IsTrialEnabled   bool           `gorm:"default:true" json:"is_trial_enabled"`   // Whether trial is enabled for this package
	IsActive         bool           `gorm:"default:true" json:"is_active"`
	ActiveModules    string         `gorm:"type:text;default:''" json:"active_modules"` // Comma-separated list of active modules

	// AI Configuration (Admin only - customers use this from their subscription)
	AIProvider       string         `gorm:"default:'openai'" json:"ai_provider"`       // openai, anthropic, etc.
	AIAPIKey         string         `gorm:"type:text" json:"-"`                      // Hidden from JSON for security
	AIModel          string         `gorm:"default:'gpt-4o'" json:"ai_model"`         // Default AI model for this package
	AITemperature     float64        `gorm:"default:0.7" json:"ai_temperature"`        // Default temperature for AI responses
	AIMaxTokens      int            `gorm:"default:2048" json:"ai_max_tokens"`        // Max tokens per response

	CreatedAt        time.Time      `json:"created_at"`
	UpdatedAt        time.Time      `json:"updated_at"`
	DeletedAt        gorm.DeletedAt `gorm:"index" json:"-"`
}

func (s *SubscriptionPackage) BeforeCreate(tx *gorm.DB) (err error) {
	if s.ID == uuid.Nil {
		s.ID, err = uuid.NewV7()
	}
	return
}

func (SubscriptionPackage) TableName() string {
	return "subscription_packages"
}
