package message

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"log"
	"loko/server/cache"
	"loko/server/connection"
	"loko/server/dto"
	"loko/server/model"
	"loko/server/response"
	"loko/server/storage"
	"path/filepath"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"go.mau.fi/whatsmeow"
	waProto "go.mau.fi/whatsmeow/binary/proto"
	"go.mau.fi/whatsmeow/types"
	"google.golang.org/protobuf/proto"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// Handler handles message-related HTTP requests
type Handler struct {
	DB         *gorm.DB
	SqlDB      *sql.DB
	Cache      cache.ChatCache
	RedisCache *cache.RedisCache
}

// NewHandler creates a new message handler
func NewHandler(db *gorm.DB, sqlDB *sql.DB, cache cache.ChatCache, redisCache *cache.RedisCache) *Handler {
	return &Handler{
		DB:         db,
		SqlDB:      sqlDB,
		Cache:      cache,
		RedisCache: redisCache,
	}
}

// SendMessage sends a message to a chat
// @Summary Send WhatsApp message
// @Description Send text, image, document, or other media messages via WhatsApp
// @Tags WhatsApp
// @Accept json
// @Produce json
// @Param message body dto.SendMessageRequest true "Message data"
// @Success 200 {object} response.WhatsAppBaseResponse
// @Failure 400 {object} response.ErrorResponse
// @Failure 503 {object} response.ErrorResponse
// @Router /whatsapp/send [post]
func (h *Handler) SendMessage(c *fiber.Ctx) error {
	var req dto.SendMessageRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(response.ErrorResponse{
			Success: false,
			Message: "Invalid request body",
			Error:   err.Error(),
		})
	}

	// Validate required fields
	if req.ChatJID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(response.ErrorResponse{
			Success: false,
			Message: "Chat JID is required",
		})
	}

	// Get session_id from request or use default
	sessionIDStr := req.SessionID
	if sessionIDStr == "" {
		sessionIDStr = "default-session-id"
	}

	log.Printf("🔍 SendMessage: Received session_id=%s", sessionIDStr)

	// Get session manager
	sessionManager := connection.GetSessionManager(h.DB, h.SqlDB)

	// Get session from database to get UUID
	session, err := sessionManager.GetSession(sessionIDStr)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(response.ErrorResponse{
			Success: false,
			Message: "Session not found",
			Error:   err.Error(),
		})
	}

	log.Printf("🔍 SendMessage: Found session in DB, looking up client by session.ID=%s", session.ID.String())

	// Get WhatsApp client for this session using UUID
	client, exists := sessionManager.GetClient(session.ID)
	if !exists {
		log.Printf("❌ SendMessage: Client not found for session.ID=%s", session.ID.String())
		return c.Status(fiber.StatusServiceUnavailable).JSON(response.ErrorResponse{
			Success: false,
			Message: "WhatsApp client not initialized for this session",
			Error:   "Please connect the session first",
		})
	}

	log.Printf("🔍 SendMessage: Found session in DB, looking up client by session.ID=%s - available=%v", session.ID.String(), exists)

	if !client.IsLoggedIn() {
		return c.Status(fiber.StatusServiceUnavailable).JSON(response.ErrorResponse{
			Success: false,
			Message: "WhatsApp not connected",
			Error:   "Please scan QR code first",
		})
	}

	// Parse recipient JID
	recipient, err := types.ParseJID(req.ChatJID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(response.ErrorResponse{
			Success: false,
			Message: "Invalid chat JID format",
			Error:   err.Error(),
		})
	}

	// Create message based on type
	var waMessage *waProto.Message

	if req.MessageType != "text" && req.MediaURL != nil && *req.MediaURL != "" {
		// Handle media message
		waMessage, err = h.handleMediaUpload(req, client, session.ID.String())
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(response.ErrorResponse{
				Success: false,
				Message: "Failed to prepare media message",
				Error:   err.Error(),
			})
		}
	} else {
		// Simple text message
		content := ""
		if req.Content != nil {
			content = *req.Content
		}
		waMessage = &waProto.Message{
			Conversation: proto.String(content),
		}
	}

	// Send message using session client
	resp, err := client.SendMessage(context.Background(), recipient, waMessage)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(response.ErrorResponse{
			Success: false,
			Message: "Failed to send message",
			Error:   err.Error(),
		})
	}

	// Update message status to sent
	log.Printf("✅ Message sent to WhatsApp: %s", resp.ID)
	log.Printf("⏳ Saving and broadcasting outbound message...")

	sendResponse := dto.SendMessageResponse{
		MessageID: resp.ID,
		Status:    "sent",
		Timestamp: resp.Timestamp,
	}

	// === SAVE OUTBOUND MESSAGE TO DATABASE ===
	// We save it here because WhatsApp doesn't reliably echo outgoing API messages
	// via the *events.Message hook
	
	// Create proper DB model based on message
	content := ""
	if req.Content != nil {
		content = *req.Content
	}
	
	var mediaURLPtr *string
	if waMessage.GetImageMessage() != nil {
		url := waMessage.GetImageMessage().GetURL()
		mediaURLPtr = &url
	} else if waMessage.GetVideoMessage() != nil {
		url := waMessage.GetVideoMessage().GetURL()
		mediaURLPtr = &url
	}

	outboundMessage := model.WhatsAppMessage{
		SessionID:   session.ID.String(),
		UserID:      session.UserID,
		MessageID:   resp.ID,
		ChatJID:     req.ChatJID,
		SenderJID:   client.Store.ID.String(), // Current Session's JID
		MessageType: req.MessageType,
		Content:     content,
		MediaURL:    mediaURLPtr,
		IsFromMe:    true,
		Timestamp:   resp.Timestamp,
		Status:      "sent",
	}

	// Use UPSERT so that if WhatsApp *does* happen to echo it back, it just replaces/does nothing
	if err := h.DB.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "message_id"}},
		DoUpdates: clause.AssignmentColumns([]string{"status"}),
	}).Create(&outboundMessage).Error; err != nil {
		log.Printf("⚠️ Failed to explicitly save newly sent message to DB: %v", err)
	} else {
		log.Printf("💾 Outbound message saved to DB: %s", resp.ID)
	}

	// === BROADCAST TO SSE FRONTEND ===
	// Ensure the frontend UI listeners (other devices/tabs) also receive this outbound update
	broadcaster := connection.GetMessageBroadcaster()
	broadcaster.Broadcast(connection.MessageEvent{
		Type:        "new_message",
		SessionID:   session.ID.String(),
		MessageID:   resp.ID,
		ChatJID:     req.ChatJID,
		SenderJID:   client.Store.ID.String(),
		MessageType: req.MessageType,
		Content:     content,
		IsFromMe:    true,
		Timestamp:   resp.Timestamp,
		Status:      "sent",
	})

	// === REDIS CHAT LIST UPDATE ===
	// Ensure the recent chats list jumps to the top
	if h.RedisCache != nil && h.RedisCache.IsAvailable() {
		ctx := context.Background()
		timestamp := float64(resp.Timestamp.Unix())
		chatKey := fmt.Sprintf("chats:data:%s:%s", session.ID, req.ChatJID)
		listKey := fmt.Sprintf("chats:list:%s", session.ID)

		h.RedisCache.ZAdd(ctx, listKey, timestamp, req.ChatJID)
		h.RedisCache.Expire(ctx, listKey, 30*24*time.Hour)

		h.RedisCache.HSet(ctx, chatKey,
			"id", req.ChatJID,
			"jid", req.ChatJID,
			"last_message", content,
			"last_timestamp", resp.Timestamp.Unix(),
		)
		h.RedisCache.Expire(ctx, chatKey, 30*24*time.Hour)
	}

	log.Printf("✅ Sent message to %s via session %s", recipient, session.SessionName)
	return c.Status(fiber.StatusOK).JSON(response.NewSuccessResponse("Message sent successfully", sendResponse))
}

// handleMediaUpload handles media file upload for messages
func (h *Handler) handleMediaUpload(req dto.SendMessageRequest, client *whatsmeow.Client, sessionID string) (*waProto.Message, error) {
	var waMessage *waProto.Message

	// Get media URL from pointer
	if req.MediaURL == nil || *req.MediaURL == "" {
		return nil, fmt.Errorf("media URL is required")
	}
	mediaURL := *req.MediaURL

	// If MediaURL is base64-encoded data
	var imageData []byte
	var err error
	var fileName string

	if strings.HasPrefix(mediaURL, "data:") {
		// Parse base64 data URL
		parts := strings.SplitN(mediaURL, ",", 2)
		if len(parts) != 2 {
			return nil, fmt.Errorf("invalid base64 data URL format")
		}

		// Decode base64 data
		imageData, err = base64.StdEncoding.DecodeString(parts[1])
		if err != nil {
			return nil, fmt.Errorf("failed to decode base64 data: %w", err)
		}

		fileName = fmt.Sprintf("upload_%s.bin", time.Now().Format("20060102150405"))
		if req.FileName != nil && *req.FileName != "" {
			fileName = *req.FileName
		}
	} else if strings.HasPrefix(mediaURL, "http") {
		// Fetch from URL directly (Optional fallback if they provided a URL instead of B64)
		return nil, fmt.Errorf("direct HTTP URL sending not fully implemented, use base64 data URI")
	} else {
		return nil, fmt.Errorf("unsupported media format, must be base64 data URI")
	}

	// 1. WhatsApp CDN Upload
	var mediaType whatsmeow.MediaType
	switch req.MessageType {
	case "image":
		mediaType = whatsmeow.MediaImage
	case "video":
		mediaType = whatsmeow.MediaVideo
	case "audio":
		mediaType = whatsmeow.MediaAudio
	case "document":
		mediaType = whatsmeow.MediaDocument
	default:
		return nil, fmt.Errorf("unsupported media type for upload: %s", req.MessageType)
	}

	log.Printf("📤 Uploading %d bytes to WhatsApp CDN as %s...", len(imageData), req.MessageType)
	resp, err := client.Upload(context.Background(), imageData, mediaType)
	if err != nil {
		return nil, fmt.Errorf("failed to upload media to WhatsApp: %w", err)
	}

	// 2. S3 Backup (Asynchronous)
	go func() {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("⚠️ S3 backup panic: %v", r)
			}
		}()

		s3c, err := storage.NewS3Client()
		if err == nil && s3c != nil {
			ext := filepath.Ext(fileName)
			if ext == "" {
				ext = ".bin"
			}
			hash := sha256.Sum256(imageData)
			hashStr := hex.EncodeToString(hash[:])
			s3Key := fmt.Sprintf("whatsapp/media/%s/%s%s", sessionID, hashStr, ext)

			// Try to guess content type or use default
			contentType := "application/octet-stream"
			if strings.HasPrefix(mediaURL, "data:") {
				// extract mime type from data:image/png;base64,...
				parts := strings.SplitN(mediaURL, ";", 2)
				if len(parts) == 2 {
					contentType = strings.TrimPrefix(parts[0], "data:")
				}
			}

			url, err := s3c.Upload(context.Background(), s3Key, imageData, contentType)
			if err != nil {
				log.Printf("⚠️ Failed to backup outgoing media to S3: %v", err)
			} else {
				log.Printf("💾 Outgoing media backed up to S3: %s", url)
			}
		}
	}()

	// Get caption from request
	caption := ""
	if req.Caption != nil {
		caption = *req.Caption
	}

	// 3. Construct waProto.Message
	switch req.MessageType {
	case "image":
		waMessage = &waProto.Message{
			ImageMessage: &waProto.ImageMessage{
				Caption:       proto.String(caption),
				URL:           proto.String(resp.URL),
				DirectPath:    proto.String(resp.DirectPath),
				MediaKey:      resp.MediaKey,
				Mimetype:      proto.String("image/jpeg"), // default for WA
				FileEncSHA256: resp.FileEncSHA256,
				FileSHA256:    resp.FileSHA256,
				FileLength:    proto.Uint64(uint64(len(imageData))),
			},
		}

	case "document":
		waMessage = &waProto.Message{
			DocumentMessage: &waProto.DocumentMessage{
				Caption:       proto.String(caption),
				FileName:      proto.String(fileName),
				URL:           proto.String(resp.URL),
				DirectPath:    proto.String(resp.DirectPath),
				MediaKey:      resp.MediaKey,
				Mimetype:      proto.String("application/octet-stream"),
				FileEncSHA256: resp.FileEncSHA256,
				FileSHA256:    resp.FileSHA256,
				FileLength:    proto.Uint64(uint64(len(imageData))),
			},
		}

	case "video":
		waMessage = &waProto.Message{
			VideoMessage: &waProto.VideoMessage{
				Caption:       proto.String(caption),
				URL:           proto.String(resp.URL),
				DirectPath:    proto.String(resp.DirectPath),
				MediaKey:      resp.MediaKey,
				Mimetype:      proto.String("video/mp4"),
				FileEncSHA256: resp.FileEncSHA256,
				FileSHA256:    resp.FileSHA256,
				FileLength:    proto.Uint64(uint64(len(imageData))),
			},
		}

	case "audio":
		waMessage = &waProto.Message{
			AudioMessage: &waProto.AudioMessage{
				URL:           proto.String(resp.URL),
				DirectPath:    proto.String(resp.DirectPath),
				MediaKey:      resp.MediaKey,
				Mimetype:      proto.String("audio/ogg; codecs=opus"),
				FileEncSHA256: resp.FileEncSHA256,
				FileSHA256:    resp.FileSHA256,
				FileLength:    proto.Uint64(uint64(len(imageData))),
			},
		}

	default:
		return nil, fmt.Errorf("unsupported message type: %s", req.MessageType)
	}

	return waMessage, nil
}
