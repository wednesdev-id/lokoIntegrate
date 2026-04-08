package model

import (
	"time"

	"gorm.io/gorm"
)

// WhatsAppMessage represents a WhatsApp message in PostgreSQL
type WhatsAppMessage struct {
	ID          uint      `gorm:"primarykey" json:"id"`
	SessionID   string    `gorm:"index;not null" json:"session_id"`
	UserID      string    `gorm:"index" json:"user_id"`
	MessageID   string    `gorm:"uniqueIndex:idx_user_session_msg;not null" json:"message_id"`
	ChatJID     string    `gorm:"index;not null" json:"chat_jid"`
	SenderJID   string    `gorm:"index;not null" json:"sender_jid"`
	MessageType string    `gorm:"not null" json:"message_type"`
	Content     string    `gorm:"type:text" json:"content"`
	MediaURL    *string   `gorm:"type:text" json:"media_url,omitempty"`
	MediaType   *string   `json:"media_type,omitempty"`
	IsFromMe    bool      `gorm:"default:false;index" json:"is_from_me"`
	IsRead      bool      `gorm:"default:false" json:"is_read"`
	Timestamp   time.Time `gorm:"index;not null" json:"timestamp"`
	Status      string    `gorm:"default:'pending'" json:"status"`
	// Media Decryption Fields
	MediaKey      []byte `gorm:"type:bytea" json:"media_key,omitempty"`
	DirectPath    string `gorm:"type:text" json:"direct_path,omitempty"`
	FileEncSHA256 []byte `gorm:"type:bytea" json:"file_enc_sha256,omitempty"`
	FileSHA256    []byte `gorm:"type:bytea" json:"file_sha256,omitempty"`
	// Quoted Message Fields
	QuotedMessageID      *string        `gorm:"type:text" json:"quoted_message_id,omitempty"`
	QuotedMessageContent *string        `gorm:"type:text" json:"quoted_message_content,omitempty"`
	QuotedMessageSender  *string        `gorm:"type:text" json:"quoted_message_sender,omitempty"`
	CreatedAt            time.Time      `json:"created_at"`
	UpdatedAt            time.Time      `json:"updated_at"`
	DeletedAt            gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName specifies the table name for WhatsAppMessage
func (WhatsAppMessage) TableName() string {
	return "whatsapp_messages"
}

// WhatsAppContact represents a WhatsApp contact in PostgreSQL
type WhatsAppContact struct {
	ID          uint           `gorm:"primarykey" json:"id"`
	SessionID   string         `gorm:"index;uniqueIndex:idx_user_session_jid;not null" json:"session_id"`
	UserID      string         `gorm:"index;uniqueIndex:idx_user_session_jid" json:"user_id"`
	JID         string         `gorm:"column:jid;index;uniqueIndex:idx_user_session_jid;not null" json:"jid"`
	Name        string         `json:"name"`
	PushName    *string        `gorm:"column:push_name;type:varchar(255)" json:"push_name,omitempty"`
	PhoneNumber string         `gorm:"index" json:"phone_number"`
	AvatarURL   *string        `gorm:"type:text" json:"avatar_url,omitempty"`
	IsBlocked   bool           `gorm:"default:false" json:"is_blocked"`
	LastSeen    *time.Time     `json:"last_seen,omitempty"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName specifies the table name for WhatsAppContact
func (WhatsAppContact) TableName() string {
	return "whatsapp_contacts"
}

// WhatsAppGroup represents a WhatsApp group in PostgreSQL
type WhatsAppGroup struct {
	ID          uint           `gorm:"primarykey" json:"id"`
	SessionID   string         `gorm:"index;not null" json:"session_id"`
	UserID      string         `gorm:"index" json:"user_id"`
	JID         string         `gorm:"uniqueIndex:idx_user_session_group;not null" json:"jid"`
	Name        string         `gorm:"not null" json:"name"`
	Description *string        `gorm:"type:text" json:"description,omitempty"`
	AvatarURL   *string        `gorm:"type:text" json:"avatar_url,omitempty"`
	OwnerJID    string         `gorm:"index" json:"owner_jid"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`

	// Relationships
	Participants []GroupParticipant `gorm:"foreignKey:GroupJID;references:JID" json:"participants,omitempty"`
}

// TableName specifies the table name for WhatsAppGroup
func (WhatsAppGroup) TableName() string {
	return "whatsapp_groups"
}

// GroupParticipant represents a participant in a WhatsApp group
type GroupParticipant struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	GroupJID  string         `gorm:"index;not null" json:"group_jid"`
	UserJID   string         `gorm:"index;not null" json:"user_jid"`
	Role      string         `gorm:"default:'member'" json:"role"` // admin, member
	JoinedAt  time.Time      `json:"joined_at"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// Relationship
	Group WhatsAppGroup `gorm:"foreignKey:GroupJID;references:JID" json:"group,omitempty"`
}

// TableName specifies the table name for GroupParticipant
func (GroupParticipant) TableName() string {
	return "whatsapp_group_participants"
}

// WhatsAppChat represents a chat session in PostgreSQL
type WhatsAppChat struct {
	ID           uint           `gorm:"primarykey" json:"id"`
	SessionID    string         `gorm:"index;not null" json:"session_id"`
	UserID       string         `gorm:"index" json:"user_id"`
	JID          string         `gorm:"uniqueIndex:idx_user_session_chat;not null" json:"jid"`
	Name         string         `json:"name"`
	ChatType     string         `gorm:"default:'individual'" json:"chat_type"` // individual, group
	LastMessage  *string        `gorm:"type:text" json:"last_message,omitempty"`
	LastActivity time.Time      `gorm:"index" json:"last_activity"`
	UnreadCount  int            `gorm:"default:0" json:"unread_count"`
	IsPinned     bool           `gorm:"default:false" json:"is_pinned"`
	IsMuted      bool           `gorm:"default:false" json:"is_muted"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName specifies the table name for WhatsAppChat
func (WhatsAppChat) TableName() string {
	return "whatsapp_chats"
}

// WhatsAppReceipt represents message receipt status in PostgreSQL
type WhatsAppReceipt struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	MessageID string         `gorm:"index;not null" json:"message_id"`
	UserJID   string         `gorm:"index;not null" json:"user_jid"`
	Status    string         `gorm:"not null" json:"status"` // sent, delivered, read
	Timestamp time.Time      `gorm:"not null" json:"timestamp"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName specifies the table name for WhatsAppReceipt
func (WhatsAppReceipt) TableName() string {
	return "whatsapp_receipts"
}

// WhatsAppPresence represents user presence status in PostgreSQL
type WhatsAppPresence struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	SessionID string         `gorm:"index;not null" json:"session_id"`
	UserID    string         `gorm:"index" json:"user_id"`
	UserJID   string         `gorm:"uniqueIndex:idx_user_session_presence;not null" json:"user_jid"`
	Status    string         `gorm:"not null" json:"status"` // online, offline, typing, recording
	LastSeen  time.Time      `gorm:"not null" json:"last_seen"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName specifies the table name for WhatsAppPresence
func (WhatsAppPresence) TableName() string {
	return "whatsapp_presence"
}

// WhatsAppStatus represents WhatsApp status updates in PostgreSQL
type WhatsAppStatus struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	SessionID string         `gorm:"index;not null" json:"session_id"`
	StatusID  string         `gorm:"uniqueIndex;not null" json:"status_id"`
	UserJID   string         `gorm:"index;not null" json:"user_jid"`
	Content   string         `gorm:"type:text" json:"content"`
	MediaURL  *string        `gorm:"type:text" json:"media_url,omitempty"`
	MediaType *string        `json:"media_type,omitempty"`
	Timestamp time.Time      `gorm:"not null" json:"timestamp"`
	ExpiresAt time.Time      `gorm:"index;not null" json:"expires_at"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName specifies the table name for WhatsAppStatus
func (WhatsAppStatus) TableName() string {
	return "whatsapp_status"
}

// WhatsAppDevice represents device information in PostgreSQL
type WhatsAppDevice struct {
	ID            uint           `gorm:"primarykey" json:"id"`
	SessionID     string         `gorm:"index;not null" json:"session_id"`
	DeviceID      string         `gorm:"uniqueIndex;not null" json:"device_id"`
	PhoneNumber   string         `gorm:"index" json:"phone_number"`
	DeviceName    string         `json:"device_name"`
	Platform      string         `json:"platform"`
	AppVersion    string         `json:"app_version"`
	IsConnected   bool           `gorm:"default:false" json:"is_connected"`
	LastConnected *time.Time     `json:"last_connected,omitempty"`
	QRCode        *string        `gorm:"type:text" json:"qr_code,omitempty"`
	SessionData   *string        `gorm:"type:text" json:"session_data,omitempty"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName specifies the table name for WhatsAppDevice
func (WhatsAppDevice) TableName() string {
	return "whatsapp_devices"
}
