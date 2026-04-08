package provider

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/go-resty/resty/v2"
)

// OfficialProvider implements Provider interface using WhatsApp Official Cloud API
// This is a placeholder for future implementation
type OfficialProvider struct {
	config        Config
	httpClient    *resty.Client
	accessToken   string
	phoneNumberID string
	apiVersion    string
	baseURL       string
}

// NewOfficialProvider creates a new WhatsApp Official API provider
func NewOfficialProvider(config Config) *OfficialProvider {
	baseURL := "https://graph.facebook.com"
	if config.APIVersion == "" {
		config.APIVersion = "v18.0"
	}

	return &OfficialProvider{
		config:        config,
		httpClient:    resty.New(),
		accessToken:   config.AccessToken,
		phoneNumberID: config.PhoneNumberID,
		apiVersion:    config.APIVersion,
		baseURL:       baseURL,
	}
}

// Name returns the provider name
func (p *OfficialProvider) Name() string {
	return "official"
}

// IsConnected checks if the provider is connected for a session
// For Official API, we just check if access token is configured
func (p *OfficialProvider) IsConnected(sessionID string) bool {
	return p.accessToken != "" && p.phoneNumberID != ""
}

// SendMessage sends a single message via WhatsApp Official API
func (p *OfficialProvider) SendMessage(ctx context.Context, req *SendMessageRequest) (*SendMessageResponse, error) {
	if !p.IsConnected(req.SessionID) {
		return nil, fmt.Errorf("WhatsApp Official API not configured")
	}

	// Build API URL
	url := fmt.Sprintf("%s/%s/%s/messages", p.baseURL, p.apiVersion, p.phoneNumberID)

	// Build request body based on message type
	var requestBody map[string]interface{}

	switch req.MessageType {
	case MessageTypeText:
		requestBody = map[string]interface{}{
			"messaging_product": "whatsapp",
			"recipient_type":    "individual",
			"to":                req.Recipient,
			"type":              "text",
			"text": map[string]string{
				"body": req.Content,
			},
		}

	case MessageTypeImage:
		requestBody = map[string]interface{}{
			"messaging_product": "whatsapp",
			"recipient_type":    "individual",
			"to":                req.Recipient,
			"type":              "image",
			"image": map[string]interface{}{
				"id":       req.MediaURL,
				"caption":  req.Caption,
			},
		}

	case MessageTypeVideo:
		requestBody = map[string]interface{}{
			"messaging_product": "whatsapp",
			"recipient_type":    "individual",
			"to":                req.Recipient,
			"type":              "video",
			"video": map[string]interface{}{
				"id":       req.MediaURL,
				"caption":  req.Caption,
			},
		}

	case MessageTypeDocument:
		requestBody = map[string]interface{}{
			"messaging_product": "whatsapp",
			"recipient_type":    "individual",
			"to":                req.Recipient,
			"type":              "document",
			"document": map[string]interface{}{
				"id":       req.MediaURL,
				"filename": req.FileName,
				"caption":  req.Caption,
			},
		}

	case MessageTypeAudio:
		requestBody = map[string]interface{}{
			"messaging_product": "whatsapp",
			"recipient_type":    "individual",
			"to":                req.Recipient,
			"type":              "audio",
			"audio": map[string]interface{}{
				"id": req.MediaURL,
			},
		}

	default:
		return nil, fmt.Errorf("unsupported message type: %s", req.MessageType)
	}

	// Send request
	var response officialAPIResponse
	resp, err := p.httpClient.R().
		SetContext(ctx).
		SetAuthToken(p.accessToken).
		SetHeader("Content-Type", "application/json").
		SetBody(requestBody).
		SetResult(&response).
		Post(url)

	if err != nil {
		return nil, fmt.Errorf("failed to send message: %w", err)
	}

	if resp.StatusCode() != http.StatusOK {
		return nil, fmt.Errorf("API error: %s", resp.String())
	}

	// Parse response
	if len(response.Messages) == 0 {
		return nil, fmt.Errorf("no message ID in response")
	}

	messageID := response.Messages[0].ID
	timestamp := time.Now()
	if response.Messages[0].Timestamp != "" {
		if ts, err := time.Parse(time.RFC3339, response.Messages[0].Timestamp); err == nil {
			timestamp = ts
		}
	}

	log.Printf("✅ [official] Message sent to %s, ID: %s", req.Recipient, messageID)

	return &SendMessageResponse{
		MessageID: messageID,
		Status:    MessageStatusSent,
		Timestamp: timestamp,
		Recipient: req.Recipient,
	}, nil
}

// SendBulkMessage sends messages to multiple recipients via Official API
func (p *OfficialProvider) SendBulkMessage(ctx context.Context, req *SendBulkMessageRequest) (*SendBulkMessageResponse, error) {
	response := &SendBulkMessageResponse{
		TotalRecipients: len(req.Recipients),
		Results:         make([]BulkMessageItemResponse, 0, len(req.Recipients)),
	}

	for _, recipient := range req.Recipients {
		singleReq := &SendMessageRequest{
			SessionID:   req.SessionID,
			Recipient:   recipient,
			MessageType: req.MessageType,
			Content:     req.Content,
			MediaURL:    req.MediaURL,
			MediaData:   req.MediaData,
			FileName:    req.FileName,
			Caption:     req.Caption,
		}

		result := BulkMessageItemResponse{
			Recipient: recipient,
		}

		resp, err := p.SendMessage(ctx, singleReq)
		if err != nil {
			result.Status = MessageStatusFailed
			result.Error = err.Error()
			response.FailedCount++
		} else {
			result.MessageID = resp.MessageID
			result.Status = resp.Status
			response.SuccessCount++
		}

		response.Results = append(response.Results, result)
	}

	return response, nil
}

// MarkAsRead marks a message as read via Official API
func (p *OfficialProvider) MarkAsRead(ctx context.Context, sessionID, messageID, chatJID string) error {
	if !p.IsConnected(sessionID) {
		return fmt.Errorf("WhatsApp Official API not configured")
	}

	url := fmt.Sprintf("%s/%s/%s/messages", p.baseURL, p.apiVersion, p.phoneNumberID)

	requestBody := map[string]interface{}{
		"messaging_product": "whatsapp",
		"status":            "read",
		"message_id":        messageID,
	}

	resp, err := p.httpClient.R().
		SetContext(ctx).
		SetAuthToken(p.accessToken).
		SetHeader("Content-Type", "application/json").
		SetBody(requestBody).
		Post(url)

	if err != nil {
		return fmt.Errorf("failed to mark as read: %w", err)
	}

	if resp.StatusCode() != http.StatusOK {
		return fmt.Errorf("API error: %s", resp.String())
	}

	return nil
}

// GetSessionStatus returns the current session status
func (p *OfficialProvider) GetSessionStatus(sessionID string) (string, error) {
	if p.IsConnected(sessionID) {
		return "connected", nil
	}
	return "not_configured", nil
}

// Disconnect disconnects a session (no-op for Official API)
func (p *OfficialProvider) Disconnect(sessionID string) error {
	// Official API is stateless, no disconnect needed
	return nil
}

// UploadMedia uploads media to WhatsApp servers and returns media ID
func (p *OfficialProvider) UploadMedia(ctx context.Context, mediaData []byte, mimeType string) (string, error) {
	if p.accessToken == "" {
		return "", fmt.Errorf("WhatsApp Official API not configured")
	}

	url := fmt.Sprintf("%s/%s/%s/media", p.baseURL, p.apiVersion, p.phoneNumberID)

	var response struct {
		ID string `json:"id"`
	}

	resp, err := p.httpClient.R().
		SetContext(ctx).
		SetAuthToken(p.accessToken).
		SetHeader("Content-Type", mimeType).
		SetBody(mediaData).
		SetResult(&response).
		Post(url)

	if err != nil {
		return "", fmt.Errorf("failed to upload media: %w", err)
	}

	if resp.StatusCode() != http.StatusOK {
		return "", fmt.Errorf("API error: %s", resp.String())
	}

	return response.ID, nil
}

// officialAPIResponse represents the response from WhatsApp Official API
type officialAPIResponse struct {
	Messages []struct {
		ID        string `json:"id"`
		Timestamp string `json:"timestamp"`
	} `json:"messages"`
	Error *struct {
		Message string `json:"message"`
		Type    string `json:"type"`
		Code    int    `json:"code"`
	} `json:"error,omitempty"`
}
