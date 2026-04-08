package model

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
)

// StringSlice is a JSON-serializable string slice for use with GORM
type StringSlice []string

func (s StringSlice) Value() (driver.Value, error) {
	b, err := json.Marshal(s)
	if err != nil {
		return nil, err
	}
	return string(b), nil
}

func (s *StringSlice) Scan(val interface{}) error {
	var b []byte
	switch v := val.(type) {
	case []byte:
		b = v
	case string:
		b = []byte(v)
	default:
		return errors.New("unsupported type for StringSlice")
	}
	return json.Unmarshal(b, s)
}

// BroadcastSchedule represents a scheduled broadcast message
type BroadcastSchedule struct {
	ID            uuid.UUID   `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	SessionID     string      `gorm:"index;column:session_id;type:varchar(255)" json:"session_id"`
	SessionCode   string      `gorm:"column:session_code;type:varchar(255)" json:"session_code"` // extra validation for session isolation
	UserID        string      `gorm:"index;column:user_id;type:varchar(255)" json:"user_id"`
	BroadcastType string      `gorm:"column:broadcast_type;type:varchar(50)" json:"broadcast_type"` // "individual" | "group"
	Recipients    StringSlice `gorm:"column:recipients;type:text" json:"recipients"`
	Message       string      `gorm:"column:message;type:text" json:"message"`
	Caption       string      `gorm:"column:caption;type:text" json:"caption"`
	MediaURL      *string     `gorm:"column:media_url;type:text" json:"media_url,omitempty"`
	MessageType   string      `gorm:"column:message_type;type:varchar(50);default:'text'" json:"message_type"` // text/image/video
	DelayMs       int         `gorm:"column:delay_ms;default:1000" json:"delay_ms"`
	UseUniqueCode bool        `gorm:"column:use_unique_code;default:false" json:"use_unique_code"`
	ScheduledAt   time.Time   `gorm:"column:scheduled_at" json:"scheduled_at"`
	Status        string      `gorm:"column:status;type:varchar(50);default:'pending'" json:"status"` // pending | processing | completed | failed | cancelled
	SentCount     int         `gorm:"column:sent_count;default:0" json:"sent_count"`
	FailedCount   int         `gorm:"column:failed_count;default:0" json:"failed_count"`
	ErrorMessage  *string     `gorm:"column:error_message;type:text" json:"error_message,omitempty"`
	CreatedAt     time.Time   `gorm:"column:created_at" json:"created_at"`
	UpdatedAt     time.Time   `gorm:"column:updated_at" json:"updated_at"`
}

func (BroadcastSchedule) TableName() string {
	return "broadcast_schedules"
}

// BroadcastRecipientStatus stores delivery status per recipient for each broadcast schedule.
type BroadcastRecipientStatus struct {
	ID             uint       `gorm:"primarykey" json:"id"`
	BroadcastID    uuid.UUID  `gorm:"type:uuid;index;not null" json:"broadcast_id"`
	SessionID      string     `gorm:"index;column:session_id;type:varchar(255)" json:"session_id"`
	RecipientInput string     `gorm:"column:recipient_input;type:varchar(255);index" json:"recipient_input"`
	ResolvedJID    string     `gorm:"column:resolved_jid;type:varchar(255);index" json:"resolved_jid"`
	MessageID      *string    `gorm:"column:message_id;type:varchar(255)" json:"message_id,omitempty"`
	RenderedBody   string     `gorm:"column:rendered_body;type:text" json:"rendered_body"`
	Status         string     `gorm:"column:status;type:varchar(50);index;default:'pending'" json:"status"` // pending|sent|failed
	ErrorMessage   *string    `gorm:"column:error_message;type:text" json:"error_message,omitempty"`
	SentAt         *time.Time `gorm:"column:sent_at" json:"sent_at,omitempty"`
	CreatedAt      time.Time  `gorm:"column:created_at" json:"created_at"`
	UpdatedAt      time.Time  `gorm:"column:updated_at" json:"updated_at"`
}

func (BroadcastRecipientStatus) TableName() string {
	return "broadcast_recipient_statuses"
}
