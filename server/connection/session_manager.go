package connection

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"loko/server/cache"
	"loko/server/model"
	"loko/server/storage"
	"loko/server/util"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"go.mau.fi/whatsmeow"
	waProto "go.mau.fi/whatsmeow/binary/proto"
	"go.mau.fi/whatsmeow/store"
	"go.mau.fi/whatsmeow/store/sqlstore"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
	waLog "go.mau.fi/whatsmeow/util/log"
	"google.golang.org/protobuf/proto"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type SessionManager struct {
	clients    map[uuid.UUID]*whatsmeow.Client
	qrCodes    map[uuid.UUID]string // Store latest QR code
	container  *sqlstore.Container
	db         *gorm.DB
	mu         sync.RWMutex
	redisCache *cache.RedisCache
	s3Client   *storage.S3Client
}

var (
	globalSessionManager *SessionManager
	once                 sync.Once
)

// GetSessionManager returns singleton with PostgreSQL storage for whatsmeow
func GetSessionManager(gormDB *gorm.DB, sqlDB *sql.DB) *SessionManager {
	once.Do(func() {
		// Use PostgreSQL for whatsmeow storage
		dbLog := waLog.Stdout("WhatsApp-DB", "INFO", true)
		container := sqlstore.NewWithDB(sqlDB, "postgres", dbLog)

		// Ensure tables exist
		if err := container.Upgrade(context.Background()); err != nil {
			log.Printf("⚠️  Failed to upgrade whatsmeow schema: %v", err)
		}

		globalSessionManager = &SessionManager{
			clients:   make(map[uuid.UUID]*whatsmeow.Client),
			qrCodes:   make(map[uuid.UUID]string),
			container: container,
			db:        gormDB,
		}

		log.Println("✅ WhatsApp SessionManager initialized with PostgreSQL")

		// Auto-restore existing paired sessions
		go func() {
			time.Sleep(2 * time.Second) // Wait for DB to be ready
			if err := globalSessionManager.RestoreExistingSessions(); err != nil {
				log.Printf("⚠️  Failed to restore existing sessions: %v", err)
			}
		}()
	})
	return globalSessionManager
}

// SetRedisCache injects Redis cache into the singleton
func (sm *SessionManager) SetRedisCache(rc *cache.RedisCache) {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	sm.redisCache = rc
	log.Println("✅ Redis Cache injected into SessionManager")
}

// SetS3Client injects S3 client into the singleton
func (sm *SessionManager) SetS3Client(s3c *storage.S3Client) {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	sm.s3Client = s3c
	log.Println("✅ S3 Client injected into SessionManager")
}

// CreateSession creates new WhatsApp session in PostgreSQL
func (sm *SessionManager) CreateSession(userID, sessionName string) (*model.WhatsAppSessionModel, error) {
	// Check session limit based on subscription
	var user model.User
	if err := sm.db.Preload("SubscriptionPackage").Where("id = ?", userID).First(&user).Error; err != nil {
		return nil, fmt.Errorf("user not found: %w", err)
	}

	var maxSessions int
	if user.SubscriptionPackage != nil {
		maxSessions = user.SubscriptionPackage.MaxSessions
	} else {
		maxSessions = 1 // Default limit if no package
	}

	var currentSessions int64
	if err := sm.db.Model(&model.WhatsAppSessionModel{}).Where("user_id = ?", userID).Count(&currentSessions).Error; err != nil {
		return nil, fmt.Errorf("failed to count sessions: %w", err)
	}

	// Check limit only if not unlimited (-1)
	if maxSessions != -1 && int(currentSessions) >= maxSessions {
		return nil, fmt.Errorf("session limit reached (%d/%d). Please upgrade your plan", currentSessions, maxSessions)
	}

	session := &model.WhatsAppSessionModel{
		SessionID:   util.GenerateUUIDv7().String(), // UUIDv7 for sortability
		SessionCode: util.GenerateUUIDv7().String(), // UUIDv7 for session code identifier
		UserID:      userID,
		SessionName: sessionName,
		Status:      "created",
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	if err := sm.db.Create(session).Error; err != nil {
		return nil, fmt.Errorf("failed to create session: %w", err)
	}

	log.Printf("✅ Created session %s for user %s", session.ID, userID)
	return session, nil
}

// GetUserSessions returns all sessions for a user
func (sm *SessionManager) GetUserSessions(userID string) ([]model.WhatsAppSessionModel, error) {
	var sessions []model.WhatsAppSessionModel
	err := sm.db.Where("user_id = ?", userID).Find(&sessions).Error
	return sessions, err
}

// GetSession returns a specific session
func (sm *SessionManager) GetSession(sessionID string) (*model.WhatsAppSessionModel, error) {
	// Parse UUID from string
	sessionUUID, err := uuid.Parse(sessionID)
	if err != nil {
		return nil, fmt.Errorf("invalid session ID format: %w", err)
	}

	var session model.WhatsAppSessionModel
	// Query by ID (UUID primary key, not deprecated session_id string)
	err = sm.db.Where("id = ?", sessionUUID).First(&session).Error
	if err != nil {
		return nil, err
	}
	return &session, nil
}

// ValidateSession validates if the session exists and the code matches
func (sm *SessionManager) ValidateSession(sessionID, sessionCode string) error {
	session, err := sm.GetSession(sessionID)
	if err != nil {
		return err
	}
	if session.SessionCode != sessionCode {
		return fmt.Errorf("invalid session code")
	}
	return nil
}

// ConnectSession connects a WhatsApp session
func (sm *SessionManager) ConnectSession(session *model.WhatsAppSessionModel) error {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	// Check if already connected
	if client, exists := sm.clients[session.ID]; exists {
		if client.IsConnected() {
			log.Printf("Session %s: Already connected", session.ID)
			return nil
		}
	}

	// Try to find the exact device if the session is already paired
	var deviceStore *store.Device
	if session.PhoneNumber != nil && *session.PhoneNumber != "" {
		devices, err := sm.container.GetAllDevices(context.Background())
		if err == nil {
			log.Printf("Session %s: Searching for device with phone %s among %d devices", session.ID, *session.PhoneNumber, len(devices))
			for _, device := range devices {
				if device.ID != nil && device.ID.User == *session.PhoneNumber {
					deviceStore = device
					log.Printf("Session %s: Matched device %s for phone %s", session.ID, device.ID.String(), *session.PhoneNumber)
					break
				}
			}
			if deviceStore == nil {
				log.Printf("Session %s: No device matched phone %s", session.ID, *session.PhoneNumber)
			}
		} else {
			log.Printf("Session %s: Failed to get devices from container: %v", session.ID, err)
		}
	}

	// If no existing matched device is found, explicitly create a new one for QR pairing
	if deviceStore == nil || deviceStore.ID == nil {
		log.Printf("Session %s: No existing device found for pairing, creating new device", session.ID)
		deviceStore = sm.container.NewDevice()
	} else {
		log.Printf("Session %s: Found existing device %s, will attempt reconnect", session.ID, deviceStore.ID.String())
	}

	// Create WhatsApp client
	clientLog := waLog.Stdout(fmt.Sprintf("Client-%s", session.ID), "INFO", true)
	client := whatsmeow.NewClient(deviceStore, clientLog)

	// Add event handler
	client.AddEventHandler(func(evt interface{}) {
		sm.handleEvent(session.ID, evt)
	})

	// Connect based on device state
	if client.Store.ID == nil {
		// New device - need QR pairing
		log.Printf("Session %s: New device, starting QR generation", session.ID)

		// Get QR channel
		qrChan, err := client.GetQRChannel(context.Background())
		if err != nil {
			return fmt.Errorf("failed to get QR channel: %w", err)
		}

		// Connect to trigger QR generation
		err = client.Connect()
		if err != nil {
			return fmt.Errorf("failed to connect: %w", err)
		}

		// Listen for QR codes in background
		go func() {
			// Set 3-minute timeout for QR code scanning
			timeout := time.After(3 * time.Minute)
			qrReceived := false

			for {
				select {
				case evt, ok := <-qrChan:
					if !ok {
						// Channel closed
						return
					}

					switch evt.Event {
					case "code":
						qrReceived = true
						now := time.Now()

						// Save QR code to database with timestamp
						err := sm.db.Model(&model.WhatsAppSessionModel{}).
							Where("id = ?", session.ID).
							Updates(map[string]interface{}{
								"qr_code":              evt.Code,
								"qr_code_generated_at": now,
								"status":               "qr_ready",
								"updated_at":           now,
							}).Error

						if err != nil {
							log.Printf("Failed to save QR code to database: %v", err)
						} else {
							log.Printf("Session %s: QR code saved to database", session.ID)
						}
					case "success":
						log.Printf("Session %s: QR pair successful", session.ID)
						sm.updateSessionStatus(session.ID, "connected")

						// Save phone number if available
						if client.Store.ID != nil {
							phoneNumber := client.Store.ID.User
							sm.db.Model(&model.WhatsAppSessionModel{}).
								Where("id = ?", session.ID).
								Update("phone_number", phoneNumber)
						}
					}

				case <-timeout:
					// QR code expired after 3 minutes
					if !qrReceived {
						log.Printf("Session %s: QR code timeout - no QR generated", session.ID)
					} else {
						log.Printf("Session %s: QR code expired without being scanned", session.ID)
					}

					// Clear QR code and mark as expired
					sm.db.Model(&model.WhatsAppSessionModel{}).
						Where("id = ?", session.ID).
						Updates(map[string]interface{}{
							"qr_code":              nil,
							"qr_code_generated_at": nil,
							"status":               "qr_expired",
							"updated_at":           time.Now(),
						})

					// Disconnect client
					if client.IsConnected() {
						client.Disconnect()
					}
					return
				}
			}
		}()
	} else {
		// Existing device - just reconnect
		log.Printf("Session %s: Existing device, attempting reconnect", session.ID)
		err := client.Connect()
		if err != nil {
			log.Printf("Session %s: Reconnect failed: %v", session.ID, err)
			sm.updateSessionStatus(session.ID, "disconnected")
			return fmt.Errorf("failed to reconnect: %w", err)
		}
		log.Printf("Session %s: Reconnected successfully", session.ID)
		sm.updateSessionStatus(session.ID, "connected")

		// Update phone number
		if client.Store.ID != nil {
			phoneNumber := client.Store.ID.User
			sm.db.Model(&model.WhatsAppSessionModel{}).
				Where("id = ?", session.ID).
				Update("phone_number", phoneNumber)
		}
	}

	sm.clients[session.ID] = client
	return nil
}

// DisconnectSession disconnects a session
func (sm *SessionManager) DisconnectSession(sessionID string) error {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	// Parse UUID from string (frontend sends UUID string)
	sessionUUID, err := uuid.Parse(sessionID)
	if err != nil {
		return fmt.Errorf("invalid session ID format: %w", err)
	}

	// Find session by ID (UUID primary key)
	var session model.WhatsAppSessionModel
	err = sm.db.Where("id = ?", sessionUUID).First(&session).Error
	if err != nil {
		// Session not found in database - return specific error
		if err == gorm.ErrRecordNotFound {
			return fmt.Errorf("session %s not found in database", sessionID)
		}
		return fmt.Errorf("database error: %w", err)
	}

	// Check if client exists in map
	client, exists := sm.clients[session.ID]
	if exists {
		// Client exists - disconnect it
		client.Disconnect()
		delete(sm.clients, session.ID)
		delete(sm.qrCodes, session.ID)
		log.Printf("Session %s: Client disconnected", sessionID)
	} else {
		// Client not in map - just update status
		log.Printf("Session %s: No active client found, updating status only", sessionID)
	}

	// Always update status in database
	sm.updateSessionStatus(session.ID, "disconnected")

	log.Printf("Session %s: Marked as disconnected", sessionID)
	return nil
}

// DeleteSession deletes a session from DB and disconnects
func (sm *SessionManager) DeleteSession(sessionID string) error {
	// Parse UUID from string (frontend sends UUID as string)
	sessionUUID, err := uuid.Parse(sessionID)
	if err != nil {
		return fmt.Errorf("invalid session ID format: %w", err)
	}

	// Find session by ID (UUID primary key, not deprecated session_id string)
	var session model.WhatsAppSessionModel
	err = sm.db.Where("id = ?", sessionUUID).First(&session).Error
	if err != nil {
		// If session not found, consider it already deleted (idempotent)
		if err == gorm.ErrRecordNotFound {
			log.Printf("Session %s: Already deleted or not found", sessionID)
			return nil // Success - session doesn't exist anyway
		}
		return fmt.Errorf("database error: %w", err)
	}

	// Disconnect and logout if connected
	if client, exists := sm.GetClient(session.ID); exists {
		// Log out to delete the whatsmeow device store completely
		err := client.Logout(context.Background())
		if err != nil {
			log.Printf("Session %s: Failed to logout client before deletion: %v", sessionID, err)
		} else {
			log.Printf("Session %s: Successfully logged out client before deletion", sessionID)
		}
		sm.DisconnectSession(sessionID)
	}

	// Delete from database
	err = sm.db.Delete(&model.WhatsAppSessionModel{}, "id = ?", session.ID).Error
	if err != nil {
		return fmt.Errorf("failed to delete session: %w", err)
	}

	log.Printf("✅ Session %s (%s): Deleted successfully", session.SessionName, sessionID)
	return nil
}

// GetSessionQRCode retrieves QR code from database
func (sm *SessionManager) GetSessionQRCode(sessionID string) (string, error) {
	// Parse UUID from string
	sessionUUID, err := uuid.Parse(sessionID)
	if err != nil {
		return "", fmt.Errorf("invalid session ID format: %w", err)
	}

	var session model.WhatsAppSessionModel
	// Query by ID (UUID primary key, not deprecated session_id string)
	err = sm.db.Where("id = ?", sessionUUID).First(&session).Error
	if err != nil {
		return "", fmt.Errorf("session not found: %w", err)
	}

	if session.QRCode == nil || *session.QRCode == "" {
		return "", fmt.Errorf("QR code not available - session may be already paired or not connected yet")
	}

	return *session.QRCode, nil
}

// GetClient returns WhatsApp client for session (internal use with UUID)
func (sm *SessionManager) GetClient(sessionID uuid.UUID) (*whatsmeow.Client, bool) {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	client, exists := sm.clients[sessionID]
	return client, exists
}

// GetSessionClient returns the whatsmeow client for a given session ID string (public API)
func (sm *SessionManager) GetSessionClient(sessionID string) (*whatsmeow.Client, error) {
	uid, err := uuid.Parse(sessionID)
	if err != nil {
		return nil, fmt.Errorf("invalid session ID format: %w", err)
	}

	client, exists := sm.GetClient(uid)
	if !exists {
		return nil, fmt.Errorf("session not connected or client not found")
	}

	if !client.IsConnected() {
		return nil, fmt.Errorf("client is not connected")
	}

	return client, nil
}

// SendMessage sends a message via WhatsApp
func (sm *SessionManager) SendMessage(sessionID uuid.UUID, to string, message string) error {
	client, exists := sm.GetClient(sessionID)
	if !exists {
		return fmt.Errorf("session not found")
	}

	if !client.IsConnected() {
		return fmt.Errorf("session not connected")
	}

	jid, err := types.ParseJID(to)
	if err != nil {
		return fmt.Errorf("invalid JID: %w", err)
	}

	msg := &waProto.Message{
		Conversation: proto.String(message),
	}

	_, err = client.SendMessage(context.Background(), jid, msg)
	return err
}

// SendMediaMessageFromURL downloads an image from a URL and sends it as a MediaMessage
func (sm *SessionManager) SendMediaMessageFromURL(sessionID uuid.UUID, to string, imageURL string, caption string) (whatsmeow.SendResponse, error) {
	client, exists := sm.GetClient(sessionID)
	if !exists {
		return whatsmeow.SendResponse{}, fmt.Errorf("session not found")
	}

	if !client.IsConnected() {
		return whatsmeow.SendResponse{}, fmt.Errorf("session not connected")
	}

	jid, err := types.ParseJID(to)
	if err != nil {
		return whatsmeow.SendResponse{}, fmt.Errorf("invalid JID: %w", err)
	}

	// Download image
	var data []byte

	// 1. Handle relative local paths (e.g., /uploads/...)
	if strings.HasPrefix(imageURL, "/uploads/") {
		localPath := "." + imageURL // converts to ./uploads/...
		log.Printf("💿 [MEDIA MESSAGE] Reading from Local Disk: %s", localPath)
		var errRead error
		data, errRead = os.ReadFile(localPath)
		if errRead != nil {
			return whatsmeow.SendResponse{}, fmt.Errorf("failed to read local image %s: %w", localPath, errRead)
		}
	} else {
		// 2. Handle direct S3 Download for absolute URLs
		s3c := storage.GetS3Client()
		s3Endpoint := os.Getenv("S3_ENDPOINT")
		s3Bucket := os.Getenv("S3_BUCKET")

		if s3Endpoint != "" && s3Bucket != "" && strings.HasPrefix(imageURL, s3Endpoint+"/"+s3Bucket+"/") && s3c != nil && s3c.IsAvailable() {
			key := strings.TrimPrefix(imageURL, s3Endpoint+"/"+s3Bucket+"/")
			log.Printf("☁️  [MEDIA MESSAGE] Downloading from S3 directly: %s", key)
			var errDownload error
			data, errDownload = s3c.Download(context.Background(), key)
			if errDownload != nil {
				return whatsmeow.SendResponse{}, fmt.Errorf("failed to download from S3 (%s): %w", key, errDownload)
			}
		} else {
			// 3. Fallback: Download via standard HTTP (for external URLs)
			log.Printf("🌐 [MEDIA MESSAGE] Downloading via HTTP: %s", imageURL)
			req, err := http.NewRequest("GET", imageURL, nil)
			if err != nil {
				return whatsmeow.SendResponse{}, fmt.Errorf("failed to create request for image: %w", err)
			}
			httpClient := &http.Client{Timeout: 15 * time.Second}
			resp, err := httpClient.Do(req)
			if err != nil {
				return whatsmeow.SendResponse{}, fmt.Errorf("failed to download image over HTTP: %w", err)
			}
			defer resp.Body.Close()

			if resp.StatusCode != http.StatusOK {
				return whatsmeow.SendResponse{}, fmt.Errorf("failed to download image over HTTP, status: %d", resp.StatusCode)
			}

			data, err = io.ReadAll(resp.Body)
			if err != nil {
				return whatsmeow.SendResponse{}, fmt.Errorf("failed to read image data: %w", err)
			}
		}
	}

	// Upload to WhatsApp
	uploaded, err := client.Upload(context.Background(), data, whatsmeow.MediaImage)
	if err != nil {
		return whatsmeow.SendResponse{}, fmt.Errorf("failed to upload image to WhatsApp: %w", err)
	}

	// Create message
	msg := &waProto.Message{
		ImageMessage: &waProto.ImageMessage{
			Caption:       proto.String(caption),
			URL:           proto.String(uploaded.URL),
			DirectPath:    proto.String(uploaded.DirectPath),
			MediaKey:      uploaded.MediaKey,
			Mimetype:      proto.String(http.DetectContentType(data)),
			FileEncSHA256: uploaded.FileEncSHA256,
			FileSHA256:    uploaded.FileSHA256,
			FileLength:    proto.Uint64(uint64(len(data))),
		},
	}

	return client.SendMessage(context.Background(), jid, msg)
}

// Event handlers
func (sm *SessionManager) handleEvent(sessionID uuid.UUID, rawEvt interface{}) {
	switch evt := rawEvt.(type) {
	case *events.Message:
		log.Printf("Session %s: Received message from %s", sessionID, evt.Info.Sender)

		// Get session to get session_id string
		var session model.WhatsAppSessionModel
		if err := sm.db.Where("id = ?", sessionID).First(&session).Error; err != nil {
			log.Printf("Failed to get session for UUID %s: %v", sessionID, err)
			return
		}

		// Parse message using modular parser
		parsed := ParseMessage(evt)

		content := parsed.Content
		messageType := parsed.MessageType
		mediaURL := parsed.MediaURL

		// Quoted Message Storage
		quotedMsgID := parsed.QuotedMessageID
		quotedMsgSender := parsed.QuotedMessageSender
		quotedMsgContent := parsed.QuotedMessageContent

		// Save message to database with UPSERT (ignore duplicates)
		var mediaURLPtr *string
		if mediaURL != "" {
			mediaURLPtr = &mediaURL
		}

		message := model.WhatsAppMessage{
			SessionID:   session.ID.String(), // Use UUID, not deprecated SessionID string
			UserID:      session.UserID,
			MessageID:   evt.Info.ID,
			ChatJID:     evt.Info.Chat.String(),
			SenderJID:   evt.Info.Sender.String(),
			MessageType: messageType,
			Content:     content,
			MediaURL:    mediaURLPtr,
			// Quoted
			QuotedMessageID:      quotedMsgID,
			QuotedMessageContent: quotedMsgContent,
			QuotedMessageSender:  quotedMsgSender,

			// Media Decryption Fields
			MediaKey:      parsed.MediaKey,
			DirectPath:    parsed.DirectPath,
			FileEncSHA256: parsed.FileEncSHA256,
			FileSHA256:    parsed.FileSHA256,

			IsFromMe:  evt.Info.IsFromMe,
			Timestamp: evt.Info.Timestamp,
			Status:    "received",
		}

		// === SAVE MESSAGE TO DATABASE ===
		if err := sm.db.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "message_id"}},
			DoNothing: true,
		}).Create(&message).Error; err != nil {
			log.Printf("Failed to save message to DB: %v", err)
		} else {
			log.Printf("💾 Message saved to DB: %s", message.MessageID)

			// === SAVE CONTACT TO DATABASE ===
			if !message.IsFromMe { // Save contact for incoming messages
				var existingContact model.WhatsAppContact
				err := sm.db.Where("session_id = ? AND jid = ?", session.SessionID, message.SenderJID).First(&existingContact).Error
				if err != nil { // Not found or error
					name := evt.Info.PushName
					if name == "" {
						name = evt.Info.Sender.User // fallback to phone number
					}
					newContact := model.WhatsAppContact{
						SessionID:   session.SessionID,
						JID:         message.SenderJID,
						Name:        name,
						PhoneNumber: evt.Info.Sender.User,
					}
					if err := sm.db.Create(&newContact).Error; err != nil {
						log.Printf("❌ Failed to create auto-save contact %s: %v", newContact.PhoneNumber, err)
					} else {
						log.Printf("✅ Contact auto-saved: %s (%s)", name, newContact.PhoneNumber)
					}
				}
			}
		}

		// === DOWNLOAD & DECRYPT MEDIA (if applicable) ===
		if mediaURL != "" && evt.Message != nil {
			go func() {
				sm.mu.RLock()
				client := sm.clients[sessionID]
				sm.mu.RUnlock()

				if client == nil {
					log.Printf("❌ No client for media download: session %s", sessionID)
					return
				}

				// Determine the downloadable message type
				var downloadable whatsmeow.DownloadableMessage
				switch {
				case evt.Message.GetImageMessage() != nil:
					downloadable = evt.Message.GetImageMessage()
				case evt.Message.GetVideoMessage() != nil:
					downloadable = evt.Message.GetVideoMessage()
				case evt.Message.GetAudioMessage() != nil:
					downloadable = evt.Message.GetAudioMessage()
				case evt.Message.GetDocumentMessage() != nil:
					downloadable = evt.Message.GetDocumentMessage()
				case evt.Message.GetStickerMessage() != nil:
					downloadable = evt.Message.GetStickerMessage()
				default:
					log.Printf("⚠️ Unknown media type, skipping download")
					return
				}

				// Download decrypted media using whatsmeow
				ctx := context.Background()
				mediaData, err := client.Download(ctx, downloadable)
				if err != nil {
					log.Printf("❌ Media download failed: %v", err)
					return
				}

				// Generate storage key
				hash := sha256.Sum256([]byte(mediaURL))
				fileHash := hex.EncodeToString(hash[:])
				s3Key := fmt.Sprintf("whatsapp/media/%s/%s", session.ID, fileHash)

				// Detect content type
				contentType := "application/octet-stream"
				if len(mediaData) >= 4 {
					switch {
					case mediaData[0] == 0xFF && mediaData[1] == 0xD8:
						contentType = "image/jpeg"
					case mediaData[0] == 0x89 && mediaData[1] == 0x50 && mediaData[2] == 0x4E && mediaData[3] == 0x47:
						contentType = "image/png"
					case mediaData[0] == 0x52 && mediaData[1] == 0x49 && mediaData[2] == 0x46 && mediaData[3] == 0x46:
						contentType = "image/webp"
					case mediaData[0] == 0x00 && mediaData[1] == 0x00 && mediaData[2] == 0x00:
						contentType = "video/mp4"
					}
				}

				// Upload to S3 if available
				sm.mu.RLock()
				s3c := sm.s3Client
				sm.mu.RUnlock()

				if s3c != nil && s3c.IsAvailable() {
					s3URL, err := s3c.Upload(context.Background(), s3Key, mediaData, contentType)
					if err != nil {
						log.Printf("❌ S3 upload failed: %v", err)
					} else {
						log.Printf("☁️  Media uploaded to S3: %s (%d bytes)", s3URL, len(mediaData))
					}
				}

				// Also save locally as cache if not disabled
				if os.Getenv("SAVE_MEDIA_LOCAL") != "false" {
					storageDir := "storage/media"
					filePath := filepath.Join(storageDir, fileHash)
					if err := os.MkdirAll(storageDir, 0755); err != nil {
						log.Printf("❌ Failed to create media dir: %v", err)
					} else if err := os.WriteFile(filePath, mediaData, 0644); err != nil {
						log.Printf("❌ Failed to save media locally: %v", err)
					} else {
						log.Printf("💾 Media saved locally: %s (%d bytes)", filePath, len(mediaData))
					}
				} else {
					log.Printf("⏭️  Skipping local save due to SAVE_MEDIA_LOCAL=false")
				}
			}()
		}

		// Proceed with Redis Update and Broadcast
		log.Printf("Processing message: %s from %s", message.MessageID, message.SenderJID)

		// Unconditional execution block (previously inside existingCount == 1)
		{

			// === REDIS UPDATE (CHAT LIST) ===
			// Skip status updates for main chat list
			if message.ChatJID != "status@broadcast" && sm.redisCache != nil && sm.redisCache.IsAvailable() {
				ctx := context.Background()
				timestamp := float64(message.Timestamp.Unix())
				chatKey := fmt.Sprintf("chats:data:%s:%s", session.ID, message.ChatJID)
				listKey := fmt.Sprintf("chats:list:%s", session.ID)

				// 1. Update Sorted Set (for ordering)
				sm.redisCache.ZAdd(ctx, listKey, timestamp, message.ChatJID)
				sm.redisCache.Expire(ctx, listKey, 30*24*time.Hour) // 30 days TTL

				// 2. Update Chat Data (Hash)
				sm.redisCache.HSet(ctx, chatKey,
					"id", message.ChatJID, // Needed for simple retrieval
					"jid", message.ChatJID,
					"last_message", message.Content,
					"last_timestamp", message.Timestamp.Unix(), // Store as int64
				)

				// 3. Increment Unread Count (if incoming)
				if !message.IsFromMe {
					sm.redisCache.HIncrBy(ctx, chatKey, "unread_count", 1)
				}

				sm.redisCache.Expire(ctx, chatKey, 30*24*time.Hour)
				log.Printf("📥 Redis Chat Update: %s (Unread++)", message.ChatJID)
			}

			// Broadcast via SSE for real-time updates
			broadcaster := GetMessageBroadcaster()
			// Get media URL for broadcast
			var mediaURLStr string
			if message.MediaURL != nil {
				mediaURLStr = *message.MediaURL
			}

			broadcaster.Broadcast(MessageEvent{
				Type:        "new_message",
				SessionID:   session.ID.String(), // Use UUID primary key, not SessionID string field
				MessageID:   message.MessageID,
				ChatJID:     message.ChatJID,
				SenderJID:   message.SenderJID,
				MessageType: message.MessageType,
				Content:     message.Content,
				MediaURL:    mediaURLStr,
				IsFromMe:    message.IsFromMe,
				Timestamp:   message.Timestamp,
				Status:      message.Status,
			})
		}

		// === DEBUG LOGGING FOR AI AUTO-REPLY ===
		debugLog := map[string]interface{}{
			"timestamp":       time.Now().Format(time.RFC3339),
			"type":            "message_received_debug",
			"session_id":      session.ID.String(),
			"user_id":         session.UserID,
			"message_id":      message.MessageID,
			"chat_jid":        message.ChatJID,
			"sender_jid":      message.SenderJID,
			"is_from_me":      message.IsFromMe,
			"message_type":    message.MessageType,
			"content_preview": content,
			"ai_auto_reply":   session.AIAutoReply,
			"ai_prompt":       session.AIPrompt != "",
			"api_key_id":      session.APIKeyID != nil,
		}
		if logJSON, err := json.MarshalIndent(debugLog, "", "  "); err == nil {
			log.Printf("📨 ═════════════════════════════════════════════════════════════")
			log.Printf("📨 MESSAGE DEBUG:\n%s", string(logJSON))
			log.Printf("📨 ═════════════════════════════════════════════════════════════")
		}

		// === AI AUTO-REPLY LOGIC ===
		// Only run if simple text message, from someone else, and AI is enabled
		if !message.IsFromMe && session.AIAutoReply && message.MessageType == "text" {
			go func(incomingMsg string, chatJID string, sess model.WhatsAppSessionModel) {
				// Structured log for AI trigger
				triggerLog := map[string]interface{}{
					"timestamp":    time.Now().Format(time.RFC3339),
					"type":         "ai_auto_reply_triggered",
					"session_id":   sess.ID.String(),
					"user_id":      sess.UserID,
					"chat_jid":     chatJID,
					"message_type": "text",
					"message":      incomingMsg,
				}
				if logJSON, err := json.MarshalIndent(triggerLog, "", "  "); err == nil {
					log.Printf("🟢 ═════════════════════════════════════════════════════════════")
					log.Printf("🟢 AI AUTO-REPLY TRIGGERED:\n%s", string(logJSON))
					log.Printf("🟢 ═════════════════════════════════════════════════════════════")
				}

				// 1. Get User Quota
				var user model.User
				if err := sm.db.Where("id = ?", sess.UserID).First(&user).Error; err != nil {
					log.Printf("🔴 AI Reply failed: couldn't fetch user: %v", err)
					return
				}
				// Skip quota check only if quota is 0 (not unlimited -1)
				if user.AIQuota == 0 {
					log.Printf("🟡 AI Reply skipped: user %s has no quota (quota: %d)", user.Username, user.AIQuota)
					return
				}

				// 2. Get API Key & Model
				apiKeyString := ""
				aiModel := "google/gemini-2.5-flash" // Default
				apiKeySource := ""

				if sess.APIKeyID != nil {
					var apiKey model.ApiKey
					if err := sm.db.Where("id = ?", *sess.APIKeyID).First(&apiKey).Error; err == nil && apiKey.IsActive {
						apiKeyString = apiKey.Key
						if sess.AIModel != "" {
							aiModel = sess.AIModel
						}
						apiKeySource = fmt.Sprintf("session:%s", apiKey.Name)
					}
				}

				if apiKeyString == "" {
					var setting model.SystemSetting
					if err := sm.db.Where("key = ?", "OPENROUTER_API_KEY").First(&setting).Error; err == nil && setting.Value != "" {
						apiKeyString = setting.Value
						apiKeySource = "global:OPENROUTER_API_KEY"
					}
				}

				if apiKeyString == "" {
					log.Printf("🔴 AI Reply skipped: No API Key configured")
					return
				}

				// Log API key source
				configLog := map[string]interface{}{
					"timestamp":      time.Now().Format(time.RFC3339),
					"type":           "ai_config_resolved",
					"api_key_source": apiKeySource,
					"ai_model":       aiModel,
					"user_quota":     user.AIQuota,
				}
				if logJSON, err := json.MarshalIndent(configLog, "", "  "); err == nil {
					log.Printf("🔧 AI CONFIG:\n%s", string(logJSON))
				}

				// 3. Determine Instruction (Bot vs Session Prompt)
				var instruction string
				var matchedBot *model.Bot
				var bots []model.Bot

				// Fetch active bots for this user
				if err := sm.db.Where("user_id = ? AND is_active = ?", sess.UserID, true).Find(&bots).Error; err == nil && len(bots) > 0 {
					// A. Check for Trigger Match
					for i := range bots {
						bot := &bots[i]
						if bot.Trigger != "" {
							triggers := strings.Split(bot.Trigger, ",")
							for _, t := range triggers {
								t = strings.TrimSpace(t)
								if t != "" && strings.Contains(strings.ToLower(incomingMsg), strings.ToLower(t)) {
									instruction = bot.Instruction
									matchedBot = bot
									break
								}
							}
							if instruction != "" {
								break
							}
						}
					}

					// B. Fallback to Default Bot (Empty Trigger)
					if instruction == "" {
						for i := range bots {
							bot := &bots[i]
							if bot.Trigger == "" {
								instruction = bot.Instruction
								matchedBot = bot
								break
							}
						}
					}

					// C. Fallback to First Bot
					if instruction == "" {
						instruction = bots[0].Instruction
						matchedBot = &bots[0]
					}
				}

				// D. Fallback to Legacy Session Prompt
				instructionSource := "none"
				if matchedBot != nil {
					instructionSource = fmt.Sprintf("bot:%s", matchedBot.Name)
				} else if sess.AIPrompt != "" {
					instruction = sess.AIPrompt
					instructionSource = "session_prompt"
				}

				// Log instruction resolution
				instructionLog := map[string]interface{}{
					"timestamp":         time.Now().Format(time.RFC3339),
					"type":              "ai_instruction_resolved",
					"instruction_source": instructionSource,
					"bot_id":            "",
					"bot_name":          "",
					"trigger_matched":   "",
				}
				if matchedBot != nil {
					instructionLog["bot_id"] = matchedBot.ID.String()
					instructionLog["bot_name"] = matchedBot.Name
					if matchedBot.Trigger != "" {
						instructionLog["trigger_matched"] = matchedBot.Trigger
					}
				}
				if logJSON, err := json.MarshalIndent(instructionLog, "", "  "); err == nil {
					log.Printf("📋 AI INSTRUCTION:\n%s", string(logJSON))
				}

				if instruction == "" {
					log.Printf("🔴 AI Reply skipped: No instruction found (No active bot and no session prompt)")
					return
				}

				// --- AI PRODUCT STOCK SEARCH LOGIC ---
				intentDescription := "The user is asking about the availability, stock, or price of a product, or asking to see the catalog."
				isProductInquiry, _, errIntent := util.CheckAIIntent(apiKeyString, incomingMsg, intentDescription, aiModel)
				if errIntent == nil && isProductInquiry {
					log.Printf("🛒 Product Inquiry Detected for session %s", sess.ID.String())
					keyword, _ := util.ExtractProductKeyword(apiKeyString, incomingMsg, aiModel)
					
					var products []model.Product
					query := sm.db.Where("user_id = ? AND status = ?", sess.UserID, model.ProductStatusActive)
					if keyword != "" && keyword != "none" {
						query = query.Where("name ILIKE ?", "%"+keyword+"%")
					}

					// Detect if user is just asking for "model" or "catalog" (general list)
					isModelInquiry := strings.Contains(strings.ToLower(incomingMsg), "model") || 
						strings.Contains(strings.ToLower(incomingMsg), "katalog") || 
						strings.Contains(strings.ToLower(incomingMsg), "daftar")

					if err := query.Limit(5).Find(&products).Error; err == nil && len(products) > 0 {
						for _, p := range products {
							var selectedImages []string
							if p.ImageURL != "" {
								selectedImages = append(selectedImages, p.ImageURL)
							}

							// If NOT a general model inquiry (meaning they asked for specific details/stock),
							// we can send additional images if they exist.
							if !isModelInquiry {
								for _, img := range p.Images {
									if img != p.ImageURL && img != "" {
										selectedImages = append(selectedImages, img)
									}
								}
							}

							// Send images, with the product name and description attached to the first image
							for i, imgUrl := range selectedImages {
								caption := ""
								if i == 0 {
									// Grouping header/caption
									caption = fmt.Sprintf("✨ *%s*\n%s", p.Name, p.Description)
								}
								_, errSend := sm.SendMediaMessageFromURL(sess.ID, chatJID, imgUrl, caption)
								if errSend != nil {
									log.Printf("🔴 Failed to send product image: %v", errSend)
								}
							}
						}
						
						// Feed product data into the AI Instruction
						productContext := "\n\n=== SYSTEM CATALOG INFORMATION ===\n" +
							"The user asked about products. The database successfully matched the following real-time catalog items:\n"
						for i, p := range products {
							productContext += fmt.Sprintf("%d. Name: %s\n   - Description: %s\n   - Stock Available: %d\n   - Price: %s %.0f\n", 
								i+1, p.Name, p.Description, p.Stock, p.Currency, p.Price)
						}
						productContext += "\nPlease politely summarize these products to the user in a natural, conversational way (Indonesian). " +
							"CRITICAL: You MUST explicitly state the 'Stock Available' exactly as it is (angka stok) and 'Price' for each product you mention. " +
							"DO NOT add any hardcoded 'Order Now' or 'Pesan Sekarang' buttons. Just let them know about the details and ask what they would like."
						
						instruction = instruction + productContext
						log.Printf("✅ AI Product Search appended %d products to instruction", len(products))
					} else {
						// Feed empty data to AI
						instruction = instruction + "\n\n=== SYSTEM CATALOG INFORMATION ===\nThe user asked about a product, but I could not find anything matching in our catalog. Please kindly inform the user that the item is either not available or out of stock."
					}
				}
				// -------------------------------------

				// 4. Call OpenRouter
				replyText, err := util.GenerateAIReply(apiKeyString, instruction, incomingMsg, aiModel)
				if err != nil {
					log.Printf("🔴 AI Reply error calling OpenRouter: %v", err)
					return
				}

				// 5. Send Message via WhatsApp
				aiClient, clientExists := sm.GetClient(sess.ID)
				if err := sm.SendMessage(sess.ID, chatJID, replyText); err != nil {
					log.Printf("🔴 AI Reply error sending WhatsApp message: %v", err)
					return
				}

				// 5a. Persist AI reply to DB so it appears in chat management UI
				aiMsgID := fmt.Sprintf("ai-reply-%d", time.Now().UnixNano())
				senderJIDStr := chatJID // fallback
				if clientExists && aiClient.Store != nil && aiClient.Store.ID != nil {
					senderJIDStr = aiClient.Store.ID.String()
				}
				aiOutbound := model.WhatsAppMessage{
					SessionID:   sess.ID.String(),
					UserID:      sess.UserID,
					MessageID:   aiMsgID,
					ChatJID:     chatJID,
					SenderJID:   senderJIDStr,
					MessageType: "text",
					Content:     replyText,
					IsFromMe:    true,
					Timestamp:   time.Now(),
					Status:      "sent",
				}
				if err := sm.db.Clauses(clause.OnConflict{
					Columns:   []clause.Column{{Name: "message_id"}},
					DoUpdates: clause.AssignmentColumns([]string{"status"}),
				}).Create(&aiOutbound).Error; err != nil {
					log.Printf("⚠️ AI Reply: failed to save outbound message to DB: %v", err)
				} else {
					log.Printf("💾 AI Reply: outbound message saved to DB: %s", aiMsgID)
				}

				// 5b. Broadcast via SSE so frontend chat updates in real-time
				GetMessageBroadcaster().Broadcast(MessageEvent{
					Type:        "new_message",
					SessionID:   sess.ID.String(),
					MessageID:   aiMsgID,
					ChatJID:     chatJID,
					SenderJID:   senderJIDStr,
					MessageType: "text",
					Content:     replyText,
					IsFromMe:    true,
					Timestamp:   time.Now(),
					Status:      "sent",
				})

				// 6. Decrement Quota
				newQuota := user.AIQuota - 1
				if err := sm.db.Model(&user).Update("ai_quota", newQuota).Error; err != nil {
					log.Printf("🔴 AI Reply error decrementing quota: %v", err)
				}

				// Final success log
				successLog := map[string]interface{}{
					"timestamp":      time.Now().Format(time.RFC3339),
					"type":           "ai_auto_reply_sent",
					"session_id":     sess.ID.String(),
					"chat_jid":       chatJID,
					"incoming_msg":   incomingMsg,
					"reply_msg":      replyText,
					"quota_remaining": newQuota,
					"bot_used":       instructionSource,
				}
				if logJSON, err := json.MarshalIndent(successLog, "", "  "); err == nil {
					log.Printf("✅ ═════════════════════════════════════════════════════════════")
					log.Printf("✅ AI AUTO-REPLY SUCCESS:\n%s", string(logJSON))
					log.Printf("✅ ═════════════════════════════════════════════════════════════")
				}

			}(message.Content, message.ChatJID, session)
		} else {
			// Log why AI auto-reply was NOT triggered
			skipReason := []string{}
			if message.IsFromMe {
				skipReason = append(skipReason, "message is from me (own message)")
			}
			if !session.AIAutoReply {
				skipReason = append(skipReason, "AI auto-reply is disabled for this session")
			}
			if message.MessageType != "text" {
				skipReason = append(skipReason, fmt.Sprintf("message type is '%s' (not text)", message.MessageType))
			}

			skipLog := map[string]interface{}{
				"timestamp":     time.Now().Format(time.RFC3339),
				"type":          "ai_auto_reply_skipped",
				"session_id":    session.ID.String(),
				"message_id":    message.MessageID,
				"skip_reasons":  skipReason,
				"is_from_me":    message.IsFromMe,
				"ai_auto_reply": session.AIAutoReply,
				"message_type":  message.MessageType,
			}
			if logJSON, err := json.MarshalIndent(skipLog, "", "  "); err == nil {
				log.Printf("⏭️  AI AUTO-REPLY SKIPPED:\n%s", string(logJSON))
			}
		}

	case *events.HistorySync:
		log.Printf("Session %s: Received HistorySync event: %s", sessionID, evt.Data.GetSyncType().String())

		// Process histories in a separate goroutine so it doesn't block the handler event loop
		go func(syncData *waProto.HistorySync) {
			now := time.Now()
			cutoff := now.Add(-30 * 24 * time.Hour) // 30 days ago

			var session model.WhatsAppSessionModel
			if err := sm.db.Where("id = ?", sessionID).First(&session).Error; err != nil {
				log.Printf("HistorySync: Failed to get session %s: %v", sessionID, err)
				return
			}

			var messagesToInsert []model.WhatsAppMessage

			for _, conv := range syncData.GetConversations() {
				chatJIDStr := conv.GetID()
				
				for _, historyMsg := range conv.GetMessages() {
					msgInfo := historyMsg.GetMessage()
					if msgInfo == nil {
						continue
					}
					msgData := msgInfo.GetMessage()
					
					if msgData == nil {
						continue
					}

					msgKey := msgInfo.GetKey()
					if msgKey == nil {
						continue
					}

					msgID := msgKey.GetID()
					if msgID == "" {
						continue
					}

					msgTimestamp := int64(msgInfo.GetMessageTimestamp())
					msgTime := time.Unix(msgTimestamp, 0)
					
					if msgTime.Before(cutoff) {
						continue // Ignore messages older than 30 days
					}

					isFromMe := msgKey.GetFromMe()
					senderJIDStr := chatJIDStr
					if !isFromMe && msgKey.GetParticipant() != "" {
						senderJIDStr = msgKey.GetParticipant()
					}

					// Use ParseMessage
					fakeEvt := &events.Message{
						Message: msgData,
					}
					parsed := ParseMessage(fakeEvt)

					var mediaURLPtr *string
					if parsed.MediaURL != "" {
						mediaURLPtr = &parsed.MediaURL
					}

					status := "received"
					if isFromMe {
						status = "sent"
						if msgInfo.GetStatus() == waProto.WebMessageInfo_READ {
							status = "read"
						} else if msgInfo.GetStatus() == waProto.WebMessageInfo_DELIVERY_ACK {
							status = "delivered"
						} else if msgInfo.GetStatus() == waProto.WebMessageInfo_SERVER_ACK {
							status = "sent"
						}
					}

					messagesToInsert = append(messagesToInsert, model.WhatsAppMessage{
						SessionID:   session.ID.String(),
						UserID:      session.UserID,
						MessageID:   msgID,
						ChatJID:     chatJIDStr,
						SenderJID:   senderJIDStr,
						MessageType: parsed.MessageType,
						Content:     parsed.Content,
						MediaURL:    mediaURLPtr,
						QuotedMessageID:      parsed.QuotedMessageID,
						QuotedMessageContent: parsed.QuotedMessageContent,
						QuotedMessageSender:  parsed.QuotedMessageSender,
						IsFromMe:  isFromMe,
						Timestamp: msgTime,
						Status:    status,
					})
				}
			}

			if len(messagesToInsert) > 0 {
				log.Printf("Session %s: HistorySync -> Inserting %d historical messages", sessionID, len(messagesToInsert))
				err := sm.db.Clauses(clause.OnConflict{
					Columns:   []clause.Column{{Name: "message_id"}}, // unique per message_id
					DoNothing: true,
				}).CreateInBatches(messagesToInsert, 100).Error
				
				if err != nil {
					log.Printf("HistorySync: Failed to insert messages: %v", err)
				} else {
					log.Printf("HistorySync: Successfully saved %d messages", len(messagesToInsert))
				}
			}
		}(evt.Data)

	case *events.Receipt:
		if len(evt.MessageIDs) > 0 {
			// Map receipt type to status
			statusStr := string(evt.Type)
			isRead := false
			if statusStr == "read" || statusStr == "read-self" {
				statusStr = "read"
				isRead = true
			}

			// Update messages in database
			err := sm.db.Model(&model.WhatsAppMessage{}).
				Where("session_id = ? AND message_id IN ?", sessionID.String(), evt.MessageIDs).
				Updates(map[string]interface{}{
					"status":  statusStr,
					"is_read": isRead,
				}).Error

			if err != nil {
				log.Printf("Session %s: Failed to update message receipt status: %v", sessionID.String(), err)
			} else {
				log.Printf("Session %s: Marked %d messages as %s", sessionID.String(), len(evt.MessageIDs), statusStr)
			}

			// Broadcast via SSE for real-time receipt updates
			broadcaster := GetMessageBroadcaster()
			for _, msgID := range evt.MessageIDs {
				broadcaster.Broadcast(MessageEvent{
					Type:      "receipt",
					SessionID: sessionID.String(),
					MessageID: msgID,
					ChatJID:   evt.Chat.String(),
					SenderJID: evt.Sender.String(),
					Status:    statusStr,
				})
			}

			// Clear unread count if read receipt
			if isRead && sm.redisCache != nil && sm.redisCache.IsAvailable() {
				// Use same key prefix as message handler: "chats:data:" not "chat:"
				chatKey := fmt.Sprintf("chats:data:%s:%s", sessionID.String(), evt.Chat.String())
				err := sm.redisCache.HSet(context.Background(), chatKey, "unread_count", 0)
				if err != nil {
					log.Printf("Session %s: Failed to reset unread_count for %s: %v", sessionID.String(), evt.Chat.String(), err)
				} else {
					log.Printf("Session %s: Reset unread_count for %s", sessionID.String(), evt.Chat.String())
				}
			}
		}

	case *events.Connected:
		log.Printf("Session %s: Connected to WhatsApp", sessionID)
		sm.updateSessionStatus(sessionID, "connected")

	case *events.Disconnected:
		log.Printf("Session %s: Disconnected from WhatsApp", sessionID)
		sm.updateSessionStatus(sessionID, "disconnected")

	case *events.LoggedOut:
		log.Printf("Session %s: Logged out", sessionID)
		sm.updateSessionStatus(sessionID, "logged_out")
		sm.mu.Lock()
		delete(sm.qrCodes, sessionID)
		sm.mu.Unlock()

	case *events.PairSuccess:
		log.Printf("Session %s: Pair successful", sessionID)
		sm.updateSessionStatus(sessionID, "paired")
		sm.mu.Lock()
		delete(sm.qrCodes, sessionID) // Clear QR after successful pair
		sm.mu.Unlock()
	}
}

func (sm *SessionManager) updateSessionStatus(sessionID uuid.UUID, status string) {
	err := sm.db.Model(&model.WhatsAppSessionModel{}).
		Where("id = ?", sessionID).
		Updates(map[string]interface{}{
			"status":     status,
			"updated_at": time.Now(),
		}).Error

	if err != nil {
		log.Printf("Failed to update session status: %v", err)
	}
}

func (sm *SessionManager) RestoreExistingSessions() error {
	log.Println("🔄 Restoring existing WhatsApp sessions...")

	// Dynamically query all user IDs with active sessions
	var activeUserIDs []string
	sm.db.Model(&model.WhatsAppSessionModel{}).
		Where("deleted_at IS NULL AND status IN (?, ?)", "connected", "qr_ready").
		Distinct().Pluck("user_id", &activeUserIDs)

	if len(activeUserIDs) == 0 {
		log.Println("✅ No active user sessions to restore")
		return nil
	}

	log.Printf("👥 Restoring sessions for: %v", activeUserIDs)

	// Query ACTIVE sessions from database for these users only
	var sessions []model.WhatsAppSessionModel
	err := sm.db.Where("deleted_at IS NULL AND user_id IN (?) AND status IN (?, ?)",
		activeUserIDs, "connected", "qr_ready").Find(&sessions).Error
	if err != nil {
		log.Printf("❌ Failed to query active sessions: %v", err)
		return fmt.Errorf("failed to query sessions: %w", err)
	}

	if len(sessions) == 0 {
		log.Println("✅ No active sessions to restore")
		return nil
	}

	log.Printf("📋 Found %d active sessions in database to restore", len(sessions))

	restored := 0
	for _, session := range sessions {
		// Get devices from whatsmeow store
		devices, err := sm.container.GetAllDevices(context.Background())
		if err != nil {
			log.Printf("⚠️  Failed to get devices for session %s: %v", session.SessionID, err)
			continue
		}

		// Find device that matches this session's phone number
		var matchedDevice *store.Device
		for _, device := range devices {
			sessionPhone := ""
			if session.PhoneNumber != nil {
				sessionPhone = *session.PhoneNumber
			}
			if device.ID != nil && device.ID.User == sessionPhone {
				matchedDevice = device
				break
			}
		}

		if matchedDevice == nil {
			phoneNum := "unknown"
			if session.PhoneNumber != nil {
				phoneNum = *session.PhoneNumber
			}
			log.Printf("⚠️  No whatsmeow device found for session %s (%s), skipping", session.SessionName, phoneNum)
			continue
		}

		// Create WhatsApp client with matched device
		clientLog := waLog.Stdout(fmt.Sprintf("Client-%s", session.ID), "INFO", true)
		client := whatsmeow.NewClient(matchedDevice, clientLog)

		// Add event handler
		client.AddEventHandler(func(evt interface{}) {
			sm.handleEvent(session.ID, evt)
		})

		// Connect
		err = client.Connect()
		if err != nil {
			phoneNum := "unknown"
			if session.PhoneNumber != nil {
				phoneNum = *session.PhoneNumber
			}
			log.Printf("⚠️  Failed to reconnect session %s (%s): %v", session.SessionName, phoneNum, err)
			sm.updateSessionStatus(session.ID, "disconnected")
			continue
		}

		// Store client
		sm.mu.Lock()
		sm.clients[session.ID] = client
		sm.mu.Unlock()

		sm.updateSessionStatus(session.ID, "connected")
		restored++
		phoneNum := "unknown"
		if session.PhoneNumber != nil {
			phoneNum = *session.PhoneNumber
		}
		log.Printf("✅ Restored session: %s (%s)", session.SessionName, phoneNum)
	}

	log.Printf("✅ Restored %d/%d existing sessions", restored, len(sessions))
	return nil
}
