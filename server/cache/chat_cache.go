package cache

import (
	"encoding/json"
	"fmt"
	"strconv"
	"sync"
	"time"
)

// ChatCache defines the interface for chat caching operations
type ChatCache interface {
	// GetChatList retrieves cached chat list for a session
	GetChatList(sessionID string) ([]byte, bool)
	// SetChatList caches chat list for a session with TTL
	SetChatList(sessionID string, data []byte, ttl time.Duration)
	// GetMessages retrieves cached messages for a chat
	GetMessages(sessionID, chatJID string, page int) ([]byte, bool)
	// SetMessages caches messages for a chat with TTL
	SetMessages(sessionID, chatJID string, page int, data []byte, ttl time.Duration)
	// InvalidateChatList removes chat list from cache
	InvalidateChatList(sessionID string)
	// InvalidateMessages removes messages from cache
	InvalidateMessages(sessionID, chatJID string)
	// InvalidateAll removes all cache entries
	InvalidateAll()
}

// cacheEntry represents a single cache entry with expiration
type cacheEntry struct {
	Data      []byte
	ExpiresAt time.Time
}

// InMemoryCache implements ChatCache using sync.Map
type InMemoryCache struct {
	store sync.Map
}

// NewInMemoryCache creates a new in-memory cache instance
func NewInMemoryCache() *InMemoryCache {
	cache := &InMemoryCache{}
	// Start background cleanup goroutine
	go cache.cleanupExpired()
	return cache
}

// GetChatList retrieves cached chat list
func (c *InMemoryCache) GetChatList(sessionID string) ([]byte, bool) {
	key := "chat_list:" + sessionID
	return c.get(key)
}

// SetChatList caches chat list with TTL
func (c *InMemoryCache) SetChatList(sessionID string, data []byte, ttl time.Duration) {
	key := "chat_list:" + sessionID
	c.set(key, data, ttl)
}

// GetMessages retrieves cached messages
func (c *InMemoryCache) GetMessages(sessionID, chatJID string, page int) ([]byte, bool) {
	key := buildMessageKey(sessionID, chatJID, page)
	return c.get(key)
}

// SetMessages caches messages with TTL
func (c *InMemoryCache) SetMessages(sessionID, chatJID string, page int, data []byte, ttl time.Duration) {
	key := buildMessageKey(sessionID, chatJID, page)
	c.set(key, data, ttl)
}

// InvalidateChatList removes chat list from cache
func (c *InMemoryCache) InvalidateChatList(sessionID string) {
	key := "chat_list:" + sessionID
	c.store.Delete(key)
}

// InvalidateMessages removes all cached messages for a chat
func (c *InMemoryCache) InvalidateMessages(sessionID, chatJID string) {
	// Delete all pages for this chat
	prefix := "messages:" + sessionID + ":" + chatJID
	c.deleteByPrefix(prefix)
}

// InvalidateAll clears entire cache
func (c *InMemoryCache) InvalidateAll() {
	c.store = sync.Map{}
}

// Internal helper methods

func (c *InMemoryCache) get(key string) ([]byte, bool) {
	value, exists := c.store.Load(key)
	if !exists {
		return nil, false
	}

	entry := value.(cacheEntry)

	// Check if expired
	if time.Now().After(entry.ExpiresAt) {
		c.store.Delete(key)
		return nil, false
	}

	return entry.Data, true
}

func (c *InMemoryCache) set(key string, data []byte, ttl time.Duration) {
	entry := cacheEntry{
		Data:      data,
		ExpiresAt: time.Now().Add(ttl),
	}
	c.store.Store(key, entry)
}

func (c *InMemoryCache) deleteByPrefix(prefix string) {
	c.store.Range(func(key, value interface{}) bool {
		keyStr := key.(string)
		if len(keyStr) >= len(prefix) && keyStr[:len(prefix)] == prefix {
			c.store.Delete(key)
		}
		return true
	})
}

func (c *InMemoryCache) cleanupExpired() {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		now := time.Now()
		c.store.Range(func(key, value interface{}) bool {
			entry := value.(cacheEntry)
			if now.After(entry.ExpiresAt) {
				c.store.Delete(key)
			}
			return true
		})
	}
}

func buildMessageKey(sessionID, chatJID string, page int) string {
	return fmt.Sprintf("messages:%s:%s:%s", sessionID, chatJID, strconv.Itoa(page))
}

// Helper to marshal data to JSON for caching
func MarshalToCache(data interface{}) ([]byte, error) {
	return json.Marshal(data)
}

// Helper to unmarshal cached JSON data
func UnmarshalFromCache(cachedData []byte, target interface{}) error {
	return json.Unmarshal(cachedData, target)
}
