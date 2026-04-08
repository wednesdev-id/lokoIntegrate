package dto

import "time"

// SendMessageRequest represents request to send a message
// @Description Request payload for sending WhatsApp messages
type SendMessageRequest struct {
	SessionID       string  `json:"session_id" validate:"required" example:"019b6954-9536-7d55-a444-45acf931f60f"`           // Session ID
	ChatJID         string  `json:"jid" validate:"required" example:"6281234567890@s.whatsapp.net"`                          // Target chat JID (also accept "jid" from frontend)
	MessageType     string  `json:"message_type" validate:"required" example:"text" enums:"text,image,video,audio,document"` // Message type
	Content         *string `json:"message,omitempty" example:"Hello World"`                                                 // Text content (also accept "message" from frontend)
	MediaURL        *string `json:"media_url,omitempty" example:"https://example.com/image.jpg"`                             // Media URL (for media messages)
	FileName        *string `json:"file_name,omitempty" example:"document.pdf"`                                              // File name (for document messages)
	Caption         *string `json:"caption,omitempty" example:"Check this out"`                                              // Caption for media messages)
	QuotedMessageID *string `json:"quoted_message_id,omitempty" example:"3EB0ABCD1234567890"`                                // Quoted message ID for replies
}

// SendMessageResponse represents response after sending a message
// @Description Response after sending a WhatsApp message
type SendMessageResponse struct {
	MessageID string    `json:"message_id" example:"3EB0ABCD1234567890"`
	Status    string    `json:"status" example:"sent" enums:"sent,failed"` // Message status
	Timestamp time.Time `json:"timestamp"`
	Error     *string   `json:"error,omitempty" example:"Network error"`
}

// GetMessagesRequest represents request to get messages
type GetMessagesRequest struct {
	ChatJID  *string    `json:"chat_jid,omitempty"`   // Filter by chat JID
	FromDate *time.Time `json:"from_date,omitempty"`  // Filter from date
	ToDate   *time.Time `json:"to_date,omitempty"`    // Filter to date
	Limit    *int       `json:"limit,omitempty"`      // Limit results (default: 50)
	Offset   *int       `json:"offset,omitempty"`     // Offset for pagination
	IsFromMe *bool      `json:"is_from_me,omitempty"` // Filter by sender
}

// MessageResponse represents a message in API response
// @Description WhatsApp message details in API response
type MessageResponse struct {
	ID          string    `json:"id" example:"123"`
	JID         string    `json:"jid" example:"6281234567890@s.whatsapp.net"`
	ChatJID     string    `json:"chat_jid" example:"6281234567890@s.whatsapp.net"`
	MessageID   string    `json:"message_id" example:"3EB0ABCD1234567890"`
	MessageType string    `json:"message_type" example:"text" enums:"text,image,video,audio,document"`
	Content     string    `json:"content" example:"Hello World"`
	MediaURL    *string   `json:"media_url,omitempty" example:"https://example.com/image.jpg"`
	MediaType   *string   `json:"media_type,omitempty" example:"image/jpeg"`
	FileName    *string   `json:"file_name,omitempty" example:"photo.jpg"`
	FileSize    *int64    `json:"file_size,omitempty" example:"1024000"`
	Caption     *string   `json:"caption,omitempty" example:"Check this out"`
	IsFromMe    bool      `json:"is_from_me" example:"true"`
	IsRead      bool      `json:"is_read" example:"false"`
	IsGroup     bool      `json:"is_group" example:"false"`
	Timestamp   time.Time `json:"timestamp"`
	Status      string    `json:"status" example:"sent" enums:"pending,sent,delivered,read,failed"`
	// Quoted Message Fields
	QuotedMessageID      string    `json:"quoted_message_id,omitempty" example:"3EB0ABCD9876543210"`
	QuotedMessageContent string    `json:"quoted_message_content,omitempty" example:"Original message text"`
	QuotedMessageSender  string    `json:"quoted_message_sender,omitempty" example:"6281234567890@s.whatsapp.net"`
	CreatedAt            time.Time `json:"created_at"`
}

// CreateGroupRequest represents request to create a group
// @Description Request payload for creating a WhatsApp group
type CreateGroupRequest struct {
	Name         string   `json:"name" validate:"required" example:"My WhatsApp Group"`
	Description  *string  `json:"description,omitempty" example:"A group for team discussions"`
	Participants []string `json:"participants" validate:"required,min=1" example:"6281234567890@s.whatsapp.net,6281987654321@s.whatsapp.net"` // Array of participant JIDs
}

// CreateGroupResponse represents response after creating a group
type CreateGroupResponse struct {
	GroupJID   string    `json:"group_jid"`
	Subject    string    `json:"subject"`
	InviteCode string    `json:"invite_code"`
	InviteURL  string    `json:"invite_url"`
	CreatedAt  time.Time `json:"created_at"`
}

// SendMessageBySessionRequest represents request to send message using a specific session
type SendMessageBySessionRequest struct {
	PhoneNumber string `json:"phone_number" validate:"required"` // Recipient phone number or JID
	Message     string `json:"message" validate:"required"`      // Message content
}

// GroupInfoResponse represents group information
type GroupInfoResponse struct {
	JID              string                     `json:"jid"`
	Name             string                     `json:"name"`
	Description      *string                    `json:"description,omitempty"`
	OwnerJID         string                     `json:"owner_jid"`
	Subject          string                     `json:"subject"`
	Participants     []GroupParticipantResponse `json:"participants"`
	InviteCode       *string                    `json:"invite_code,omitempty"`
	ProfilePic       *string                    `json:"profile_pic,omitempty"`
	IsAnnouncement   bool                       `json:"is_announcement"`
	IsLocked         bool                       `json:"is_locked"`
	ParticipantCount int                        `json:"participant_count"`
	CreatedAt        time.Time                  `json:"created_at"`
	UpdatedAt        time.Time                  `json:"updated_at"`
}

// GroupParticipantResponse represents a group participant
type GroupParticipantResponse struct {
	JID      string    `json:"jid"`
	Role     string    `json:"role"`
	JoinedAt time.Time `json:"joined_at"`
}

// AddParticipantsRequest represents request to add participants to group
type AddParticipantsRequest struct {
	GroupJID     string   `json:"group_jid" validate:"required"`
	Participants []string `json:"participants" validate:"required,min=1"`
}

// RemoveParticipantsRequest represents request to remove participants from group
type RemoveParticipantsRequest struct {
	GroupJID     string   `json:"group_jid" validate:"required"`
	Participants []string `json:"participants" validate:"required,min=1"`
}

// UpdateGroupRequest represents request to update group info
type UpdateGroupRequest struct {
	GroupJID    string  `json:"group_jid" validate:"required"`
	Name        *string `json:"name,omitempty"`
	Description *string `json:"description,omitempty"`
}

// JoinGroupRequest represents request to join group via invite
type JoinGroupRequest struct {
	InviteCode string `json:"invite_code" validate:"required"`
}

// ContactResponse represents a contact in API response
type ContactResponse struct {
	ID           string    `json:"id"`
	JID          string    `json:"jid"`
	PhoneNumber  string    `json:"phone_number"`
	Name         string    `json:"name"`
	PushName     *string   `json:"push_name,omitempty"`
	BusinessName *string   `json:"business_name,omitempty"`
	IsBlocked    bool      `json:"is_blocked"`
	IsBusiness   bool      `json:"is_business"`
	ProfilePic   *string   `json:"profile_pic,omitempty"`
	Status       *string   `json:"status,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// ChatResponse represents a chat in API response
type ChatResponse struct {
	ID            string     `json:"id"`
	JID           string     `json:"jid"`
	Name          string     `json:"name"`
	IsGroup       bool       `json:"is_group"`
	IsPinned      bool       `json:"is_pinned"`
	IsMuted       bool       `json:"is_muted"`
	MuteUntil     *time.Time `json:"mute_until,omitempty"`
	UnreadCount   int        `json:"unread_count"`
	LastMessage   *string    `json:"last_message,omitempty"`
	LastMessageAt *time.Time `json:"last_message_at,omitempty"`
	ProfilePic    *string    `json:"profile_pic,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

// UpdateChatRequest represents request to update chat settings
type UpdateChatRequest struct {
	ChatJID   string     `json:"chat_jid" validate:"required"`
	IsPinned  *bool      `json:"is_pinned,omitempty"`
	IsMuted   *bool      `json:"is_muted,omitempty"`
	MuteUntil *time.Time `json:"mute_until,omitempty"`
}

// SendTypingRequest represents request to send typing notification
type SendTypingRequest struct {
	ChatJID  string `json:"chat_jid" validate:"required"`
	IsTyping bool   `json:"is_typing"`
}

// MarkReadRequest represents request to mark messages as read
type MarkReadRequest struct {
	ChatJID    string   `json:"chat_jid" validate:"required"`
	MessageIDs []string `json:"message_ids" validate:"required,min=1"`
}

// DeviceStatusResponse represents device connection status
type DeviceStatusResponse struct {
	JID         string     `json:"jid"`
	PushName    string     `json:"push_name"`
	PhoneNumber string     `json:"phone_number"`
	IsConnected bool       `json:"is_connected"`
	IsLoggedIn  bool       `json:"is_logged_in"`
	LastSeen    *time.Time `json:"last_seen,omitempty"`
	QRCode      *string    `json:"qr_code,omitempty"`
}

// SendStatusRequest represents request to send status message
type SendStatusRequest struct {
	Type     string  `json:"type" validate:"required"` // text, image, video
	Content  *string `json:"content,omitempty"`        // Text content
	MediaURL *string `json:"media_url,omitempty"`      // Media URL
	Caption  *string `json:"caption,omitempty"`        // Caption for media
}

// StatusResponse represents a status message
type StatusResponse struct {
	ID        string    `json:"id"`
	JID       string    `json:"jid"`
	StatusID  string    `json:"status_id"`
	Type      string    `json:"type"`
	Content   *string   `json:"content,omitempty"`
	MediaURL  *string   `json:"media_url,omitempty"`
	Caption   *string   `json:"caption,omitempty"`
	Timestamp time.Time `json:"timestamp"`
	ExpiresAt time.Time `json:"expires_at"`
	CreatedAt time.Time `json:"created_at"`
}

// WebhookMessagePayload represents webhook payload for incoming messages
type WebhookMessagePayload struct {
	Event   string          `json:"event"` // message_received, message_sent, etc
	Message MessageResponse `json:"message"`
}

// WebhookReceiptPayload represents webhook payload for receipts
type WebhookReceiptPayload struct {
	Event     string    `json:"event"` // message_delivered, message_read
	MessageID string    `json:"message_id"`
	ChatJID   string    `json:"chat_jid"`
	FromJID   string    `json:"from_jid"`
	Type      string    `json:"type"`
	Timestamp time.Time `json:"timestamp"`
}

// WebhookPresencePayload represents webhook payload for presence updates
type WebhookPresencePayload struct {
	Event     string    `json:"event"` // typing_start, typing_stop, online, offline
	JID       string    `json:"jid"`
	ChatJID   string    `json:"chat_jid"`
	Type      string    `json:"type"`
	Timestamp time.Time `json:"timestamp"`
}

// WebhookGroupPayload represents webhook payload for group events
type WebhookGroupPayload struct {
	Event       string                    `json:"event"` // group_created, participant_added, participant_removed, etc
	GroupJID    string                    `json:"group_jid"`
	GroupInfo   *GroupInfoResponse        `json:"group_info,omitempty"`
	Participant *GroupParticipantResponse `json:"participant,omitempty"`
	Timestamp   time.Time                 `json:"timestamp"`
}

// WebhookPayload represents the payload sent to webhook endpoints
type WebhookPayload struct {
	Event     string                 `json:"event"`
	Timestamp time.Time              `json:"timestamp"`
	Data      map[string]interface{} `json:"data"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
}

// GroupResponse represents group information in API responses
type GroupResponse struct {
	JID          string    `json:"jid"`
	Name         string    `json:"name"`
	Description  string    `json:"description,omitempty"`
	Owner        string    `json:"owner,omitempty"`
	Participants []string  `json:"participants"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// WebhookConfigRequest represents request to configure webhook
type WebhookConfigRequest struct {
	URL               string            `json:"url" validate:"required,url"`
	Secret            string            `json:"secret,omitempty"`
	Headers           map[string]string `json:"headers,omitempty"`
	Enabled           bool              `json:"enabled"`
	MaxRetries        int               `json:"max_retries" validate:"min=0,max=10"`
	RetryDelaySeconds int               `json:"retry_delay_seconds" validate:"min=1,max=300"`
}

// --- Session Management DTOs ---

// CreateSessionRequest represents request to create a new WhatsApp session
type CreateSessionRequest struct {
	SessionName string `json:"session_name" validate:"required,min=3,max=50"`
}

// SessionResponse represents a WhatsApp session in API response
type SessionResponse struct {
	SessionID     string     `json:"session_id"`
	SessionCode   string     `json:"session_code"`
	SessionName   string     `json:"session_name"`
	PhoneNumber   *string    `json:"phone_number,omitempty"`
	Status        string     `json:"status"` // connecting, connected, disconnected
	QRCode        *string    `json:"qr_code,omitempty"`
	QRCodeString  *string    `json:"qr_code_string,omitempty"`
	LastConnected *time.Time `json:"last_connected,omitempty"`
	AIAutoReply   bool       `json:"ai_auto_reply"`
	AIPrompt      string     `json:"ai_prompt"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

// ListSessionsResponse represents response with multiple sessions
type ListSessionsResponse struct {
	Sessions []SessionResponse `json:"sessions"`
	Total    int               `json:"total"`
}
