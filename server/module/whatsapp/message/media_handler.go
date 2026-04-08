package message

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"log"
	"loko/server/connection"
	"loko/server/model"
	"loko/server/storage"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// DownloadMedia downloads WhatsApp media using authenticated client with Redis caching and Local Storage
// @Summary Download WhatsApp media
// @Description Download and proxy WhatsApp media files (images, videos, audio, documents) with Persistent Local Storage
// @Tags WhatsApp Messages
// @Accept json
// @Produce application/octet-stream
// @Param session_id query string true "Session ID"
// @Param session_code query string false "Session Code for validation"
// @Param url query string true "WhatsApp media URL"
// @Param type query string false "Media type (image/video/audio/document)"
// @Success 200 {file} binary
// @Failure 400 {object} response.ErrorResponse
// @Failure 404 {object} response.ErrorResponse
// @Router /whatsapp/v1/media/download [get]
func (h *Handler) DownloadMedia(c *fiber.Ctx) error {
	// Get query parameters
	sessionID := c.Query("session_id")
	sessionCode := c.Query("session_code")
	mediaURL := c.Query("url")
	mediaType := c.Query("type", "image")
	retryParam := c.Query("retry") // timestamp check

	log.Printf("📥 [MEDIA DOWNLOAD] Request received")
	log.Printf("   ├─ session_id: %s", sessionID)
	log.Printf("   ├─ session_code: %q", sessionCode)
	log.Printf("   ├─ URL: %s", mediaURL)
	if retryParam != "" {
		log.Printf("   └─ Retry: %s (FORCE REFRESH)", retryParam)
	}

	// Validate parameters
	if sessionID == "" || mediaURL == "" {
		log.Printf("❌ DownloadMedia: session_id and url are required")
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "session_id and url are required",
		})
	}

	// Validate session code if provided (for additional security)
	if sessionCode != "" {
		log.Printf("🔍 DownloadMedia: Validating session_code=%q", sessionCode)
		sessionManager := connection.GetSessionManager(h.DB, h.SqlDB)
		if err := sessionManager.ValidateSession(sessionID, sessionCode); err != nil {
			log.Printf("❌ DownloadMedia: Invalid session code: %v", err)
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"success": false,
				"message": "Unauthorized: Invalid session code",
			})
		}
		log.Printf("✅ DownloadMedia: Session code validated successfully")
	}

	// Generate Storage Key (SHA256)
	cacheKeyRaw := generateCacheKey(mediaURL)
	// Remove "media:" prefix for filename
	fileHash := cacheKeyRaw[6:]
	storageDir := "storage/media"
	filePath := filepath.Join(storageDir, fileHash)

	// === TIER 1: Local File System (PERSISTENT & FASTEST) ===
	if _, err := os.Stat(filePath); err == nil {
		// File exists locally
		log.Printf("💿 [MEDIA STORAGE] Serving from Local Disk: %s", filePath)

		// Detect type from file content (read 512 bytes)
		file, err := os.Open(filePath)
		if err == nil {
			defer file.Close()

			buffer := make([]byte, 512)
			_, err = file.Read(buffer)
			if err == nil {
				contentType := detectContentType(buffer, mediaType)

				// Check if cached data is encrypted (octet-stream usually means encrypted)
				if contentType == "application/octet-stream" {
					log.Printf("⚠️  [MEDIA STORAGE] Cached file appears to be ENCRYPTED, deleting and re-downloading: %s", filePath)
					file.Close()
					os.Remove(filePath) // Delete corrupted cache
				} else {
					c.Set("Content-Type", contentType)
					c.Set("X-Cache", "HIT-LOCAL-DISK")
					c.Set("Cache-Control", "public, max-age=31536000") // 1 year
					return c.SendFile(filePath)
				}
			}
		}
	}

	// === TIER 2: S3 Object Storage ===
	s3c := storage.GetS3Client()
	s3Key := fmt.Sprintf("whatsapp/media/%s/%s", sessionID, fileHash)
	if s3c != nil && s3c.IsAvailable() {
		isWhatsappCDN := strings.Contains(mediaURL, "mmg.whatsapp.net")
		maxRetries := 5
		if !isWhatsappCDN {
			maxRetries = 1
		}

		for i := 0; i < maxRetries; i++ {
			if s3c.Exists(context.Background(), s3Key) {
				log.Printf("☁️  [MEDIA STORAGE] Serving from S3: %s", s3Key)
				s3Data, err := s3c.Download(context.Background(), s3Key)
				if err == nil {
					contentType := detectContentType(s3Data, mediaType)
					c.Set("Content-Type", contentType)
					c.Set("X-Cache", "HIT-S3")
					c.Set("Cache-Control", "public, max-age=31536000")

					// Also save locally as disk cache
					go func() {
						if os.Getenv("SAVE_MEDIA_LOCAL") != "false" {
							if err := os.MkdirAll(storageDir, 0755); err == nil {
								_ = os.WriteFile(filePath, s3Data, 0644)
							}
						}
					}()

					return c.Send(s3Data)
				}
				log.Printf("⚠️  S3 download failed, falling through: %v", err)
				break
			}

			if isWhatsappCDN && i < maxRetries-1 {
				log.Printf("⏳ [MEDIA DOWNLOAD] Not found in S3, waiting for arrival download (%d/%d)...", i+1, maxRetries)
				time.Sleep(1 * time.Second)
			}
		}
	}

	// === TIER 2: WhatsApp Download (Fallback) ===
	log.Printf("🔄 [MEDIA DOWNLOAD] Cache MISS - Downloading from WhatsApp CDN...")

	// Validate Session
	sessionUUID, err := uuid.Parse(sessionID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Invalid session_id format",
		})
	}

	sessionManager := connection.GetSessionManager(h.DB, h.SqlDB)
	client, exists := sessionManager.GetClient(sessionUUID)
	if !exists || client == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"success": false,
			"message": "Session not found or not connected",
		})
	}

	ctx := context.Background()
	var mediaData []byte

	// === TIER 3: Native Decrypt Fallback ===
	var dbMsg model.WhatsAppMessage
	if dbErr := h.DB.Where("media_url = ?", mediaURL).First(&dbMsg).Error; dbErr == nil && len(dbMsg.MediaKey) > 0 {
		log.Printf("🔑 [MEDIA DOWNLOAD] Found decryption keys in DB! Downloading natively...")
		downloadable := &customDownloadable{
			MediaKey:      dbMsg.MediaKey,
				DirectPath:    dbMsg.DirectPath,
			FileEncSHA256: dbMsg.FileEncSHA256,
			FileSHA256:    dbMsg.FileSHA256,
			URL:           mediaURL,
		}
		data, err := client.Download(ctx, downloadable)
		if err == nil {
			mediaData = data
			log.Printf("✅ [MEDIA DOWNLOAD] Decrypted natively via Whatsmeow Client")
		} else {
			log.Printf("❌ [MEDIA DOWNLOAD] Native decryption failed: %v", err)
		}
	}

	// Falls through to raw HTTP Download if Native decryption is unavailable or failed
	if mediaData == nil {
		log.Printf("🌐 [MEDIA DOWNLOAD] Native decryption unavailable, falling back to HTTP download...")
		req, err := http.NewRequestWithContext(ctx, "GET", mediaURL, nil)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
		}
		req.Header.Set("User-Agent", "WhatsApp/2.23.20.0")

		httpClient := &http.Client{Timeout: 60 * time.Second}
		resp, err := httpClient.Do(req)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			return c.Status(resp.StatusCode).JSON(fiber.Map{"message": "WhatsApp CDN error"})
		}

		mediaData, err = io.ReadAll(resp.Body)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to read body"})
		}
	}

	contentType := detectContentType(mediaData, mediaType)

	// === SAVE TO S3 ===
	if s3c != nil && s3c.IsAvailable() {
		if contentType == "application/octet-stream" {
			log.Printf("⚠️  [MEDIA STORAGE] Fallback data is likely ENCRYPTED (.enc), NOT caching to S3 to prevent corruption")
		} else {
			s3URL, err := s3c.Upload(context.Background(), s3Key, mediaData, contentType)
			if err != nil {
				log.Printf("❌ [MEDIA STORAGE] S3 upload failed: %v", err)
			} else {
				log.Printf("☁️  [MEDIA STORAGE] Uploaded to S3: %s", s3URL)
			}
		}
	}

	// === SAVE TO LOCAL DISK (cache) ===
	if os.Getenv("SAVE_MEDIA_LOCAL") != "false" {
		if err := os.MkdirAll(storageDir, 0755); err != nil {
			log.Printf("❌ [MEDIA STORAGE] Failed to create dir: %v", err)
		}

		if err := os.WriteFile(filePath, mediaData, 0644); err != nil {
			log.Printf("❌ [MEDIA STORAGE] Failed to write file: %v", err)
		} else {
			log.Printf("💾 [MEDIA STORAGE] Saved to disk: %s", filePath)
		}
	} else {
		log.Printf("⏭️  [MEDIA STORAGE] Skipping local save (SAVE_MEDIA_LOCAL=false)")
	}

	// Return Data
	c.Set("Content-Type", contentType)
	c.Set("X-Cache", "MISS-SAVED")
	c.Set("Cache-Control", "public, max-age=31536000")

	return c.Send(mediaData)
}

// === CUSTOM DOWNLOADABLE FOR NATIVE DECRYPTION ===
type customDownloadable struct {
	MediaKey      []byte
	DirectPath    string
	FileEncSHA256 []byte
	FileSHA256    []byte
	URL           string
}

func (c *customDownloadable) GetMediaKey() []byte       { return c.MediaKey }
func (c *customDownloadable) GetDirectPath() string     { return c.DirectPath }
func (c *customDownloadable) GetFileEncSHA256() []byte { return c.FileEncSHA256 }
func (c *customDownloadable) GetFileSHA256() []byte    { return c.FileSHA256 }
func (c *customDownloadable) GetUrl() string            { return c.URL }

// generateCacheKey creates a deterministic cache key from URL using SHA256
func generateCacheKey(url string) string {
	hash := sha256.Sum256([]byte(url))
	return "media:" + hex.EncodeToString(hash[:])
}

// detectContentType detects content type from file signature (magic bytes)
func detectContentType(data []byte, fallbackType string) string {
	if len(data) < 4 {
		return getDefaultContentType(fallbackType)
	}

	// Check file signatures (magic bytes)
	switch {
	case data[0] == 0xFF && data[1] == 0xD8:
		return "image/jpeg"
	case data[0] == 0x89 && data[1] == 0x50 && data[2] == 0x4E && data[3] == 0x47:
		return "image/png"
	case data[0] == 0x47 && data[1] == 0x49 && data[2] == 0x46:
		return "image/gif"
	case data[0] == 0x52 && data[1] == 0x49 && data[2] == 0x46 && data[3] == 0x46:
		return "image/webp"
	case data[0] == 0x00 && data[1] == 0x00 && data[2] == 0x00:
		return "video/mp4"
	default:
		return getDefaultContentType(fallbackType)
	}
}

// getDefaultContentType returns default content type based on media type
func getDefaultContentType(mediaType string) string {
	switch mediaType {
	case "image":
		return "image/jpeg"
	case "video":
		return "video/mp4"
	case "audio":
		return "audio/ogg"
	case "document":
		return "application/pdf"
	case "sticker":
		return "image/webp"
	default:
		return "application/octet-stream"
	}
}
