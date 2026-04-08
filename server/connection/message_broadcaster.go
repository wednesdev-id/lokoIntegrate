package connection

import (
	"encoding/json"
	"fmt"
	"sync"
	"time"
)

// MessageBroadcaster handles Server-Sent Events for real-time message streaming
type MessageBroadcaster struct {
	clients map[chan string]bool
	mutex   sync.RWMutex
}

// NewMessageBroadcaster creates a new message broadcaster
func NewMessageBroadcaster() *MessageBroadcaster {
	return &MessageBroadcaster{
		clients: make(map[chan string]bool),
	}
}

// Subscribe adds a new SSE client
func (mb *MessageBroadcaster) Subscribe() chan string {
	mb.mutex.Lock()
	defer mb.mutex.Unlock()

	client := make(chan string, 10) // Buffer to prevent blocking
	mb.clients[client] = true

	return client
}

// Unsubscribe removes an SSE client
func (mb *MessageBroadcaster) Unsubscribe(client chan string) {
	mb.mutex.Lock()
	defer mb.mutex.Unlock()

	if _, exists := mb.clients[client]; exists {
		delete(mb.clients, client)
		close(client)
	}
}

// Broadcast sends message event to all connected SSE clients
func (mb *MessageBroadcaster) Broadcast(event MessageEvent) {
	mb.mutex.RLock()
	defer mb.mutex.RUnlock()

	// Convert event to JSON
	data, err := json.Marshal(event)
	if err != nil {
		return
	}

	message := fmt.Sprintf("data: %s\n\n", string(data))

	// Send to all clients
	for client := range mb.clients {
		select {
		case client <- message:
		case <-time.After(time.Second):
			// Skip slow clients to prevent blocking
		}
	}
}

// MessageEvent represents a message event for SSE
type MessageEvent struct {
	Type        string    `json:"type"` // "new_message", "message_update"
	SessionID   string    `json:"session_id"`
	MessageID   string    `json:"message_id"`
	ChatJID     string    `json:"chat_jid"`
	SenderJID   string    `json:"sender_jid"`
	MessageType string    `json:"message_type"`
	Content     string    `json:"content"`
	MediaURL    string    `json:"media_url,omitempty"`
	IsFromMe    bool      `json:"is_from_me"`
	Timestamp   time.Time `json:"timestamp"`
	Status      string    `json:"status"`
}

// Global message broadcaster instance
var globalMessageBroadcaster *MessageBroadcaster
var broadcasterOnce sync.Once

// GetMessageBroadcaster returns the singleton message broadcaster
func GetMessageBroadcaster() *MessageBroadcaster {
	broadcasterOnce.Do(func() {
		globalMessageBroadcaster = NewMessageBroadcaster()
	})
	return globalMessageBroadcaster
}
