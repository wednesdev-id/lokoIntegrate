package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// MatchType defines how keywords are matched
type MatchType string

const (
	MatchTypeExact    MatchType = "exact"    // Exact string match (case-insensitive)
	MatchTypeContains MatchType = "contains" // Contains substring (case-insensitive)
	MatchTypeRegex    MatchType = "regex"    // Regular expression match
	MatchTypeAI       MatchType = "ai"       // AI-powered intent matching
)

// ResponseType defines how the response is generated
type ResponseType string

const (
	ResponseTypeStatic ResponseType = "static" // Predefined static response
	ResponseTypeAI     ResponseType = "ai"     // AI-generated response using instruction
)

// AIConfigSource defines where AI configuration comes from
type AIConfigSource string

const (
	AIConfigInherit AIConfigSource = "inherit" // From session/bot
	AIConfigBasic   AIConfigSource = "basic"   // Temperature + model
	AIConfigFull    AIConfigSource = "full"    // All AI settings
)

// AutoReplyRule represents a single auto-reply rule
type AutoReplyRule struct {
	ID        uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	WhatsAppSessionID uuid.UUID      `gorm:"type:uuid;not null;index" json:"whatsapp_session_id"`
	UserID            string         `gorm:"not null;index" json:"user_id"`

	// Rule identification
	Name        string `gorm:"not null" json:"name"`
	Description string `json:"description,omitempty"`

	// Matching configuration
	MatchType MatchType `gorm:"type:varchar(20);not null;default:'contains'" json:"match_type"`
	Pattern   string    `gorm:"type:text;not null" json:"pattern"` // Keyword, phrase, or regex pattern

	// Response configuration
	ResponseType ResponseType `gorm:"type:varchar(20);not null;default:'static'" json:"response_type"`
	Response     string       `gorm:"type:text" json:"response,omitempty"`          // Static response text
	Instruction  string       `gorm:"type:text" json:"instruction,omitempty"`       // AI instruction/prompt

	// AI Configuration (when ResponseType = ai)
	AIConfigSource AIConfigSource `gorm:"type:varchar(20);default:'inherit'" json:"ai_config_source"`
	AIModel        string         `gorm:"type:varchar(100)" json:"ai_model,omitempty"`
	AITemperature  float64        `gorm:"type:decimal(3,2);default:0.7" json:"ai_temperature"`
	AIMaxTokens    int            `gorm:"default:2048" json:"ai_max_tokens"`

	// Priority and behavior
	Priority    int  `gorm:"default:100" json:"priority"` // Lower = higher priority
	IsActive    bool `gorm:"default:true" json:"is_active"`
	StopOnMatch bool `gorm:"default:true" json:"stop_on_match"` // Stop processing after this match

	// Tracking
	MatchCount  int        `gorm:"default:0" json:"match_count"`
	LastMatched *time.Time `json:"last_matched,omitempty"`

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// Relations
	Session *WhatsAppSessionModel `gorm:"foreignKey:WhatsAppSessionID" json:"session,omitempty"`
}

// BeforeCreate hook for UUID generation
func (r *AutoReplyRule) BeforeCreate(tx *gorm.DB) error {
	if r.ID == uuid.Nil {
		newID, err := uuid.NewV7()
		if err != nil {
			return err
		}
		r.ID = newID
	}
	return nil
}

// TableName specifies the table name
func (AutoReplyRule) TableName() string {
	return "auto_reply_rules"
}

// AutoReplyRuleStats represents statistics for an auto-reply rule
type AutoReplyRuleStats struct {
	TotalRules   int64 `json:"total_rules"`
	ActiveRules  int64 `json:"active_rules"`
	TotalMatches int64 `json:"total_matches"`
	TodayMatches int64 `json:"today_matches"`
	WeekMatches  int64 `json:"week_matches"`
	MonthMatches int64 `json:"month_matches"`
}
