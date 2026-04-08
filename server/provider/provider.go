package provider

import (
	"context"
	"time"
)

// MessageType represents the type of WhatsApp message
type MessageType string

const (
	MessageTypeText     MessageType = "text"
	MessageTypeImage    MessageType = "image"
	MessageTypeVideo    MessageType = "video"
	MessageTypeAudio    MessageType = "audio"
	MessageTypeDocument MessageType = "document"
	MessageTypeLocation MessageType = "location"
	MessageTypeContact  MessageType = "contact"
)

// MessageStatus represents the status of a message
type MessageStatus string

const (
	MessageStatusPending   MessageStatus = "pending"
	MessageStatusSent      MessageStatus = "sent"
	MessageStatusDelivered MessageStatus = "delivered"
	MessageStatusRead      MessageStatus = "read"
	MessageStatusFailed    MessageStatus = "failed"
)

// SendMessageRequest represents a message to be sent
type SendMessageRequest struct {
	SessionID   string       // Session identifier
	Recipient   string       // Phone number or JID
	MessageType MessageType  // Type of message
	Content     string       // Text content (for text messages)
	MediaURL    string       // URL or base64 data for media
	MediaData   []byte       // Raw media bytes
	FileName    string       // Filename for documents
	Caption     string       // Caption for media
	MimeType    string       // MIME type for media
	QuotedID    string       // Message ID to quote/reply to
}

// SendMessageResponse represents the response after sending a message
type SendMessageResponse struct {
	MessageID string        // WhatsApp message ID
	Status    MessageStatus // Message status
	Timestamp time.Time     // When the message was sent
	Recipient string        // Recipient identifier
}

// SendBulkMessageRequest represents a bulk message request
type SendBulkMessageRequest struct {
	SessionID   string       // Session identifier
	Recipients  []string     // List of phone numbers or JIDs
	MessageType MessageType  // Type of message
	Content     string       // Text content
	MediaURL    string       // URL or base64 data for media
	MediaData   []byte       // Raw media bytes
	FileName    string       // Filename for documents
	Caption     string       // Caption for media
}

// SendBulkMessageResponse represents the response after sending bulk messages
type SendBulkMessageResponse struct {
	TotalRecipients int                       // Total number of recipients
	SuccessCount    int                       // Successfully sent
	FailedCount     int                       // Failed to send
	Results         []BulkMessageItemResponse // Individual results
}

// BulkMessageItemResponse represents individual result in bulk send
type BulkMessageItemResponse struct {
	Recipient string        // Recipient phone/JID
	MessageID string        // Message ID if successful
	Status    MessageStatus // Status
	Error     string        // Error message if failed
}

// Provider defines the interface for WhatsApp message providers
// This abstraction allows switching between whatsmeow and Official API
type Provider interface {
	// Name returns the provider name (e.g., "whatsmeow", "official")
	Name() string

	// IsConnected checks if the provider is connected and ready
	IsConnected(sessionID string) bool

	// SendMessage sends a single message
	SendMessage(ctx context.Context, req *SendMessageRequest) (*SendMessageResponse, error)

	// SendBulkMessage sends messages to multiple recipients
	SendBulkMessage(ctx context.Context, req *SendBulkMessageRequest) (*SendBulkMessageResponse, error)

	// MarkAsRead marks a message as read
	MarkAsRead(ctx context.Context, sessionID, messageID, chatJID string) error

	// GetSessionStatus returns the current session status
	GetSessionStatus(sessionID string) (string, error)

	// Disconnect disconnects a session
	Disconnect(sessionID string) error
}

// ProviderType defines the type of WhatsApp provider
type ProviderType string

const (
	ProviderTypeWhatsmeow ProviderType = "whatsmeow"
	ProviderTypeOfficial  ProviderType = "official"
)

// Config holds provider configuration
type Config struct {
	Type ProviderType // Provider type

	// whatsmeow specific
	SessionDataPath string // Path to store session data

	// Official API specific
	AccessToken    string // Meta API access token
	PhoneNumberID  string // WhatsApp Business Phone Number ID
	BusinessID     string // WhatsApp Business Account ID
	WebhookSecret  string // Webhook verification secret
	APIVersion     string // Meta API version (e.g., "v18.0")
}

// MessageEvent represents a message event for callbacks
type MessageEvent struct {
	Type        string      // Event type: "sent", "delivered", "read", "failed"
	SessionID   string      // Session identifier
	MessageID   string      // Message ID
	ChatJID     string      // Chat JID
	Recipient   string      // Recipient phone/JID
	Timestamp   time.Time   // Event timestamp
	Status      string      // Message status
	Error       string      // Error message if failed
}
