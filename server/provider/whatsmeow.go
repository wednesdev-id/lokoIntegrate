package provider

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"log"
	"loko/server/cache"
	"loko/server/connection"
	"loko/server/model"
	"loko/server/storage"
	"path/filepath"
	"strings"
	"time"

	"go.mau.fi/whatsmeow"
	waProto "go.mau.fi/whatsmeow/binary/proto"
	"go.mau.fi/whatsmeow/types"
	"google.golang.org/protobuf/proto"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// WhatsmeowProvider implements the Provider interface using whatsmeow library
type WhatsmeowProvider struct {
	DB             *gorm.DB
	SqlDB          *sql.DB
	Cache          cache.ChatCache
	SessionDataDir string
	sessionMgr     *connection.SessionManager
}

// NewWhatsmeowProvider creates a new whatsmeow provider
func NewWhatsmeowProvider(db *gorm.DB, sqlDB *sql.DB, cache cache.ChatCache, sessionDataDir string) *WhatsmeowProvider {
	return &WhatsmeowProvider{
		DB:             db,
		SqlDB:          sqlDB,
		Cache:          cache,
		SessionDataDir: sessionDataDir,
	}
}

// Name returns the provider name
func (p *WhatsmeowProvider) Name() string {
	return "whatsmeow"
}

// getSessionManager returns the session manager (lazy initialization)
func (p *WhatsmeowProvider) getSessionManager() *connection.SessionManager {
	if p.sessionMgr == nil {
		p.sessionMgr = connection.GetSessionManager(p.DB, p.SqlDB)
	}
	return p.sessionMgr
}

// IsConnected checks if the provider is connected for a session
func (p *WhatsmeowProvider) IsConnected(sessionID string) bool {
	sessionMgr := p.getSessionManager()

	session, err := sessionMgr.GetSession(sessionID)
	if err != nil {
		return false
	}

	client, exists := sessionMgr.GetClient(session.ID)
	if !exists {
		return false
	}

	return client.IsLoggedIn()
}

// SendMessage sends a single message via whatsmeow
func (p *WhatsmeowProvider) SendMessage(ctx context.Context, req *SendMessageRequest) (*SendMessageResponse, error) {
	sessionMgr := p.getSessionManager()

	// Get session from database
	session, err := sessionMgr.GetSession(req.SessionID)
	if err != nil {
		return nil, fmt.Errorf("session not found: %w", err)
	}

	// Get WhatsApp client
	client, exists := sessionMgr.GetClient(session.ID)
	if !exists {
		return nil, fmt.Errorf("WhatsApp client not initialized for session %s", req.SessionID)
	}

	if !client.IsLoggedIn() {
		return nil, fmt.Errorf("WhatsApp not connected for session %s", req.SessionID)
	}

	// Parse recipient JID
	recipient, err := types.ParseJID(req.Recipient)
	if err != nil {
		// Try to format as phone number JID
		recipient = types.JID{
			User:   req.Recipient,
			Server: types.DefaultUserServer,
		}
	}

	// Build message based on type
	var waMessage *waProto.Message

	switch req.MessageType {
	case MessageTypeText:
		waMessage = &waProto.Message{
			Conversation: proto.String(req.Content),
		}

	case MessageTypeImage, MessageTypeVideo, MessageTypeAudio, MessageTypeDocument:
		msg, err := p.buildMediaMessage(client, req, session.ID.String())
		if err != nil {
			return nil, fmt.Errorf("failed to build media message: %w", err)
		}
		waMessage = msg

	default:
		return nil, fmt.Errorf("unsupported message type: %s", req.MessageType)
	}

	// Send message
	resp, err := client.SendMessage(ctx, recipient, waMessage)
	if err != nil {
		return nil, fmt.Errorf("failed to send message: %w", err)
	}

	// Save to database
	p.saveMessage(session, req, resp.ID, resp.Timestamp, client)

	// Broadcast to SSE
	p.broadcastMessage(session.ID.String(), req, resp.ID, resp.Timestamp, client)

	log.Printf("✅ [whatsmeow] Message sent to %s via session %s", recipient, session.SessionName)

	return &SendMessageResponse{
		MessageID: resp.ID,
		Status:    MessageStatusSent,
		Timestamp: resp.Timestamp,
		Recipient: req.Recipient,
	}, nil
}

// SendBulkMessage sends messages to multiple recipients via whatsmeow
func (p *WhatsmeowProvider) SendBulkMessage(ctx context.Context, req *SendBulkMessageRequest) (*SendBulkMessageResponse, error) {
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

// MarkAsRead marks a message as read
func (p *WhatsmeowProvider) MarkAsRead(ctx context.Context, sessionID, messageID, chatJID string) error {
	sessionMgr := p.getSessionManager()

	session, err := sessionMgr.GetSession(sessionID)
	if err != nil {
		return fmt.Errorf("session not found: %w", err)
	}

	client, exists := sessionMgr.GetClient(session.ID)
	if !exists || !client.IsLoggedIn() {
		return fmt.Errorf("client not connected")
	}

	chatJid, err := types.ParseJID(chatJID)
	if err != nil {
		return fmt.Errorf("invalid chat JID: %w", err)
	}

	msgIDs := []types.MessageID{types.MessageID(messageID)}
	return client.MarkRead(ctx, msgIDs, time.Now(), chatJid, *client.Store.ID, types.ReceiptTypeRead)
}

// GetSessionStatus returns the current session status
func (p *WhatsmeowProvider) GetSessionStatus(sessionID string) (string, error) {
	if p.IsConnected(sessionID) {
		return "connected", nil
	}
	return "disconnected", nil
}

// Disconnect disconnects a session
func (p *WhatsmeowProvider) Disconnect(sessionID string) error {
	sessionMgr := p.getSessionManager()

	session, err := sessionMgr.GetSession(sessionID)
	if err != nil {
		return fmt.Errorf("session not found: %w", err)
	}

	client, exists := sessionMgr.GetClient(session.ID)
	if !exists {
		return nil // Already disconnected
	}

	client.Disconnect()
	return nil
}

// buildMediaMessage builds a media message for whatsmeow
func (p *WhatsmeowProvider) buildMediaMessage(client *whatsmeow.Client, req *SendMessageRequest, sessionID string) (*waProto.Message, error) {
	var mediaData []byte

	if len(req.MediaData) > 0 {
		mediaData = req.MediaData
	} else if req.MediaURL != "" {
		// For now, we expect base64 data URL
		// TODO: Add support for HTTP URLs
		return nil, fmt.Errorf("media URL not supported, use MediaData")
	} else {
		return nil, fmt.Errorf("no media data provided")
	}

	// Determine media type
	var mediaType whatsmeow.MediaType
	switch req.MessageType {
	case MessageTypeImage:
		mediaType = whatsmeow.MediaImage
	case MessageTypeVideo:
		mediaType = whatsmeow.MediaVideo
	case MessageTypeAudio:
		mediaType = whatsmeow.MediaAudio
	case MessageTypeDocument:
		mediaType = whatsmeow.MediaDocument
	default:
		return nil, fmt.Errorf("unsupported media type: %s", req.MessageType)
	}

	// Upload to WhatsApp CDN
	log.Printf("📤 [whatsmeow] Uploading %d bytes to WhatsApp CDN...", len(mediaData))
	uploadResp, err := client.Upload(context.Background(), mediaData, mediaType)
	if err != nil {
		return nil, fmt.Errorf("failed to upload media: %w", err)
	}

	// Backup to S3 asynchronously
	go p.backupMediaToS3(mediaData, req.FileName, sessionID)

	// Build message based on type
	switch req.MessageType {
	case MessageTypeImage:
		return &waProto.Message{
			ImageMessage: &waProto.ImageMessage{
				Caption:       proto.String(req.Caption),
				URL:           proto.String(uploadResp.URL),
				DirectPath:    proto.String(uploadResp.DirectPath),
				MediaKey:      uploadResp.MediaKey,
				Mimetype:      proto.String(p.getMimeType(req.MimeType, "image/jpeg")),
				FileEncSHA256: uploadResp.FileEncSHA256,
				FileSHA256:    uploadResp.FileSHA256,
				FileLength:    proto.Uint64(uint64(len(mediaData))),
			},
		}, nil

	case MessageTypeVideo:
		return &waProto.Message{
			VideoMessage: &waProto.VideoMessage{
				Caption:       proto.String(req.Caption),
				URL:           proto.String(uploadResp.URL),
				DirectPath:    proto.String(uploadResp.DirectPath),
				MediaKey:      uploadResp.MediaKey,
				Mimetype:      proto.String(p.getMimeType(req.MimeType, "video/mp4")),
				FileEncSHA256: uploadResp.FileEncSHA256,
				FileSHA256:    uploadResp.FileSHA256,
				FileLength:    proto.Uint64(uint64(len(mediaData))),
			},
		}, nil

	case MessageTypeAudio:
		return &waProto.Message{
			AudioMessage: &waProto.AudioMessage{
				URL:           proto.String(uploadResp.URL),
				DirectPath:    proto.String(uploadResp.DirectPath),
				MediaKey:      uploadResp.MediaKey,
				Mimetype:      proto.String(p.getMimeType(req.MimeType, "audio/ogg; codecs=opus")),
				FileEncSHA256: uploadResp.FileEncSHA256,
				FileSHA256:    uploadResp.FileSHA256,
				FileLength:    proto.Uint64(uint64(len(mediaData))),
			},
		}, nil

	case MessageTypeDocument:
		return &waProto.Message{
			DocumentMessage: &waProto.DocumentMessage{
				Caption:       proto.String(req.Caption),
				FileName:      proto.String(req.FileName),
				URL:           proto.String(uploadResp.URL),
				DirectPath:    proto.String(uploadResp.DirectPath),
				MediaKey:      uploadResp.MediaKey,
				Mimetype:      proto.String(p.getMimeType(req.MimeType, "application/octet-stream")),
				FileEncSHA256: uploadResp.FileEncSHA256,
				FileSHA256:    uploadResp.FileSHA256,
				FileLength:    proto.Uint64(uint64(len(mediaData))),
			},
		}, nil

	default:
		return nil, fmt.Errorf("unsupported message type: %s", req.MessageType)
	}
}

// getMimeType returns the mime type or default
func (p *WhatsmeowProvider) getMimeType(mimeType, defaultType string) string {
	if mimeType != "" {
		return mimeType
	}
	return defaultType
}

// backupMediaToS3 backs up media to S3 storage
func (p *WhatsmeowProvider) backupMediaToS3(mediaData []byte, fileName string, sessionID string) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("⚠️ [whatsmeow] S3 backup panic: %v", r)
		}
	}()

	s3c, err := storage.NewS3Client()
	if err != nil || s3c == nil {
		return
	}

	ext := filepath.Ext(fileName)
	if ext == "" {
		ext = ".bin"
	}

	hash := sha256.Sum256(mediaData)
	hashStr := hex.EncodeToString(hash[:])
	s3Key := fmt.Sprintf("whatsapp/media/%s/%s%s", sessionID, hashStr, ext)

	contentType := "application/octet-stream"
	if ext != "" {
		switch strings.ToLower(ext) {
		case ".jpg", ".jpeg":
			contentType = "image/jpeg"
		case ".png":
			contentType = "image/png"
		case ".gif":
			contentType = "image/gif"
		case ".mp4":
			contentType = "video/mp4"
		case ".mp3":
			contentType = "audio/mpeg"
		case ".ogg":
			contentType = "audio/ogg"
		case ".pdf":
			contentType = "application/pdf"
		}
	}

	url, err := s3c.Upload(context.Background(), s3Key, mediaData, contentType)
	if err != nil {
		log.Printf("⚠️ [whatsmeow] Failed to backup media to S3: %v", err)
		return
	}

	log.Printf("💾 [whatsmeow] Media backed up to S3: %s", url)
}

// saveMessage saves the message to database
func (p *WhatsmeowProvider) saveMessage(session *model.WhatsAppSessionModel, req *SendMessageRequest, messageID string, timestamp time.Time, client *whatsmeow.Client) {
	var content string
	if req.Content != "" {
		content = req.Content
	}

	outboundMessage := model.WhatsAppMessage{
		SessionID:   session.ID.String(),
		UserID:      session.UserID,
		MessageID:   messageID,
		ChatJID:     req.Recipient,
		SenderJID:   client.Store.ID.String(),
		MessageType: string(req.MessageType),
		Content:     content,
		IsFromMe:    true,
		Timestamp:   timestamp,
		Status:      "sent",
	}

	if err := p.DB.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "message_id"}},
		DoUpdates: clause.AssignmentColumns([]string{"status"}),
	}).Create(&outboundMessage).Error; err != nil {
		log.Printf("⚠️ [whatsmeow] Failed to save message to DB: %v", err)
		return
	}

	log.Printf("💾 [whatsmeow] Message saved to DB: %s", messageID)
}

// broadcastMessage broadcasts the message to SSE listeners
func (p *WhatsmeowProvider) broadcastMessage(sessionID string, req *SendMessageRequest, messageID string, timestamp time.Time, client *whatsmeow.Client) {
	broadcaster := connection.GetMessageBroadcaster()
	if broadcaster == nil {
		return
	}

	var content string
	if req.Content != "" {
		content = req.Content
	}

	broadcaster.Broadcast(connection.MessageEvent{
		Type:        "new_message",
		SessionID:   sessionID,
		MessageID:   messageID,
		ChatJID:     req.Recipient,
		SenderJID:   client.Store.ID.String(),
		MessageType: string(req.MessageType),
		Content:     content,
		IsFromMe:    true,
		Timestamp:   timestamp,
		Status:      "sent",
	})
}
