package util

import (
	"bytes"
	"encoding/json"
	"fmt"
	"loko/server/dto"
	"log"
	"math"
	"net/http"
	"time"
)

// WebhookConfig holds webhook configuration
type WebhookConfig struct {
	URL        string            `json:"url"`
	Secret     string            `json:"secret"`
	Headers    map[string]string `json:"headers"`
	Enabled    bool              `json:"enabled"`
	MaxRetries int               `json:"max_retries"`
	RetryDelay time.Duration     `json:"retry_delay"`
}

// RetryableWebhookPayload holds payload with retry information
type RetryableWebhookPayload struct {
	Payload     interface{} `json:"payload"`
	Attempts    int         `json:"attempts"`
	MaxAttempts int         `json:"max_attempts"`
	LastError   string      `json:"last_error,omitempty"`
	NextRetry   time.Time   `json:"next_retry"`
}

// Global webhook configuration
var WhatsAppWebhookConfig *WebhookConfig

// SetWebhookConfig sets the webhook configuration
func SetWebhookConfig(config WebhookConfig) {
	WhatsAppWebhookConfig = &config
}

// SendWebhook sends a webhook payload to the configured URL
func SendWebhook(payload interface{}) error {
	if WhatsAppWebhookConfig == nil || !WhatsAppWebhookConfig.Enabled {
		return nil // Webhook not configured or disabled
	}

	// Convert payload to JSON
	jsonData, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal webhook payload: %v", err)
	}

	// Create HTTP request
	req, err := http.NewRequest("POST", WhatsAppWebhookConfig.URL, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create webhook request: %v", err)
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "Loko-WhatsApp-Webhook/1.0")

	// Add custom headers
	for key, value := range WhatsAppWebhookConfig.Headers {
		req.Header.Set(key, value)
	}

	// Add secret header if configured
	if WhatsAppWebhookConfig.Secret != "" {
		req.Header.Set("X-Webhook-Secret", WhatsAppWebhookConfig.Secret)
	}

	// Send request with timeout
	client := &http.Client{
		Timeout: 30 * time.Second,
	}

	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send webhook: %v", err)
	}
	defer resp.Body.Close()

	// Check response status
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("webhook returned non-2xx status: %d", resp.StatusCode)
	}

	log.Printf("Webhook sent successfully to %s (status: %d)", WhatsAppWebhookConfig.URL, resp.StatusCode)
	return nil
}

// SendWebhookAsync sends a webhook asynchronously
func SendWebhookAsync(payload interface{}) {
	go func() {
		if err := SendWebhook(payload); err != nil {
			log.Printf("Failed to send webhook: %v", err)
		}
	}()
}

// SendWebhookWithRetry sends a webhook with retry mechanism
func SendWebhookWithRetry(payload interface{}) error {
	if WhatsAppWebhookConfig == nil || !WhatsAppWebhookConfig.Enabled {
		return nil
	}

	maxRetries := WhatsAppWebhookConfig.MaxRetries
	if maxRetries <= 0 {
		maxRetries = 3 // Default retry count
	}

	retryDelay := WhatsAppWebhookConfig.RetryDelay
	if retryDelay <= 0 {
		retryDelay = 1 * time.Second // Default retry delay
	}

	var lastErr error
	for attempt := 0; attempt <= maxRetries; attempt++ {
		if attempt > 0 {
			// Exponential backoff: delay = base_delay * 2^(attempt-1)
			delay := time.Duration(float64(retryDelay) * math.Pow(2, float64(attempt-1)))
			log.Printf("Retrying webhook in %v (attempt %d/%d)", delay, attempt+1, maxRetries+1)
			time.Sleep(delay)
		}

		err := SendWebhook(payload)
		if err == nil {
			if attempt > 0 {
				log.Printf("Webhook sent successfully after %d retries", attempt)
			}
			return nil
		}

		lastErr = err
		log.Printf("Webhook attempt %d failed: %v", attempt+1, err)
	}

	return fmt.Errorf("webhook failed after %d attempts, last error: %v", maxRetries+1, lastErr)
}

// SendWebhookAsyncWithRetry sends a webhook asynchronously with retry mechanism
func SendWebhookAsyncWithRetry(payload interface{}) {
	go func() {
		if err := SendWebhookWithRetry(payload); err != nil {
			log.Printf("Failed to send webhook after retries: %v", err)
			// Optionally, store failed webhooks for manual retry or dead letter queue
			StoreFailedWebhook(payload, err.Error())
		}
	}()
}

// StoreFailedWebhook stores failed webhook for later processing
func StoreFailedWebhook(payload interface{}, errorMsg string) {
	// This could be implemented to store in database, file, or queue
	// For now, just log the failure
	log.Printf("Storing failed webhook for later retry: %s", errorMsg)
	// TODO: Implement persistent storage for failed webhooks
}

// CreateDecryptionFailureWebhookPayload creates webhook payload for message decryption failures
func CreateDecryptionFailureWebhookPayload(messageID string, chatJID string, errorMsg string, metadata map[string]interface{}) dto.WebhookPayload {
	return dto.WebhookPayload{
		Event:     "message.decryption_failed",
		Timestamp: time.Now(),
		Data: map[string]interface{}{
			"message_id": messageID,
			"chat_jid":   chatJID,
			"error":      errorMsg,
			"retry_info": map[string]interface{}{
				"can_retry":    true,
				"retry_after":  time.Now().Add(5 * time.Minute),
				"max_retries": 5,
			},
		},
		Metadata: metadata,
	}
}

// CreateMessageWebhookPayload creates a webhook payload for message events
func CreateMessageWebhookPayload(eventType string, message dto.MessageResponse, metadata map[string]interface{}) dto.WebhookPayload {
	return dto.WebhookPayload{
		Event:     eventType,
		Timestamp: time.Now(),
		Data: map[string]interface{}{
			"message": message,
		},
		Metadata: metadata,
	}
}

// CreateGroupWebhookPayload creates a webhook payload for group events
func CreateGroupWebhookPayload(eventType string, groupInfo dto.GroupResponse, metadata map[string]interface{}) dto.WebhookPayload {
	return dto.WebhookPayload{
		Event:     eventType,
		Timestamp: time.Now(),
		Data: map[string]interface{}{
			"group": groupInfo,
		},
		Metadata: metadata,
	}
}

// CreateContactWebhookPayload creates a webhook payload for contact events
func CreateContactWebhookPayload(eventType string, contact dto.ContactResponse, metadata map[string]interface{}) dto.WebhookPayload {
	return dto.WebhookPayload{
		Event:     eventType,
		Timestamp: time.Now(),
		Data: map[string]interface{}{
			"contact": contact,
		},
		Metadata: metadata,
	}
}

// CreatePresenceWebhookPayload creates a webhook payload for presence events
func CreatePresenceWebhookPayload(eventType string, presence map[string]interface{}, metadata map[string]interface{}) dto.WebhookPayload {
	return dto.WebhookPayload{
		Event:     eventType,
		Timestamp: time.Now(),
		Data: map[string]interface{}{
			"presence": presence,
		},
		Metadata: metadata,
	}
}

// CreateReceiptWebhookPayload creates a webhook payload for receipt events
func CreateReceiptWebhookPayload(eventType string, receipt map[string]interface{}, metadata map[string]interface{}) dto.WebhookPayload {
	return dto.WebhookPayload{
		Event:     eventType,
		Timestamp: time.Now(),
		Data: map[string]interface{}{
			"receipt": receipt,
		},
		Metadata: metadata,
	}
}