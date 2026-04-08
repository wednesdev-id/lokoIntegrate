package provider

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"loko/server/cache"
	"os"
	"sync"

	"gorm.io/gorm"
)

var (
	currentProvider Provider
	providerOnce    sync.Once
	providerMu      sync.RWMutex
)

// FactoryConfig holds configuration for creating providers
type FactoryConfig struct {
	DB            *gorm.DB
	SqlDB         *sql.DB
	Cache         cache.ChatCache
	SessionDataDir string
}

// GetProvider returns the current provider instance
// It lazily initializes the provider on first call
func GetProvider() Provider {
	providerMu.RLock()
	defer providerMu.RUnlock()
	return currentProvider
}

// SetProvider sets the current provider (for testing or runtime switching)
func SetProvider(p Provider) {
	providerMu.Lock()
	defer providerMu.Unlock()
	currentProvider = p
}

// InitProvider initializes the provider based on environment configuration
func InitProvider(cfg *FactoryConfig) Provider {
	providerOnce.Do(func() {
		providerType := os.Getenv("WHATSAPP_PROVIDER_TYPE")
		if providerType == "" {
			providerType = "whatsmeow" // Default to whatsmeow
		}

		var provider Provider

		switch ProviderType(providerType) {
		case ProviderTypeWhatsmeow:
			provider = newWhatsmeowProvider(cfg)
			log.Printf("📱 WhatsApp Provider initialized: whatsmeow")

		case ProviderTypeOfficial:
			provider = newOfficialProviderFromEnv(cfg)
			log.Printf("📱 WhatsApp Provider initialized: official")

		default:
			log.Printf("⚠️ Unknown provider type '%s', defaulting to whatsmeow", providerType)
			provider = newWhatsmeowProvider(cfg)
		}

		currentProvider = provider
	})

	return currentProvider
}

// newWhatsmeowProvider creates a new whatsmeow provider
func newWhatsmeowProvider(cfg *FactoryConfig) Provider {
	sessionDataDir := cfg.SessionDataDir
	if sessionDataDir == "" {
		sessionDataDir = "./sessions"
	}

	return NewWhatsmeowProvider(cfg.DB, cfg.SqlDB, cfg.Cache, sessionDataDir)
}

// newOfficialProviderFromEnv creates a new official provider from environment variables
func newOfficialProviderFromEnv(cfg *FactoryConfig) Provider {
	config := Config{
		Type:           ProviderTypeOfficial,
		AccessToken:     os.Getenv("WHATSAPP_OFFICIAL_ACCESS_TOKEN"),
		PhoneNumberID:   os.Getenv("WHATSAPP_OFFICIAL_PHONE_NUMBER_ID"),
		BusinessID:      os.Getenv("WHATSAPP_OFFICIAL_BUSINESS_ID"),
		WebhookSecret:   os.Getenv("WHATSAPP_OFFICIAL_WEBHOOK_SECRET"),
		APIVersion:      os.Getenv("WHATSAPP_OFFICIAL_API_VERSION"),
		SessionDataPath: cfg.SessionDataDir,
	}

	// Validate required configuration
	if config.AccessToken == "" || config.PhoneNumberID == "" {
		log.Printf("⚠️ WhatsApp Official API not fully configured, some features may not work")
	}

	return NewOfficialProvider(config)
}

// SwitchProvider allows runtime switching of providers
func SwitchProvider(providerType ProviderType, cfg *FactoryConfig) error {
	providerMu.Lock()
	defer providerMu.Unlock()

	var newProvider Provider

	switch providerType {
	case ProviderTypeWhatsmeow:
		newProvider = newWhatsmeowProvider(cfg)

	case ProviderTypeOfficial:
		newProvider = newOfficialProviderFromEnv(cfg)

	default:
		return fmt.Errorf("unsupported provider type: %s", providerType)
	}

	currentProvider = newProvider
	log.Printf("📱 WhatsApp Provider switched to: %s", providerType)

	return nil
}

// SendMessage is a convenience function that uses the current provider
func SendMessage(ctx context.Context, req *SendMessageRequest) (*SendMessageResponse, error) {
	p := GetProvider()
	if p == nil {
		return nil, fmt.Errorf("provider not initialized")
	}
	return p.SendMessage(ctx, req)
}

// SendBulkMessage is a convenience function that uses the current provider
func SendBulkMessage(ctx context.Context, req *SendBulkMessageRequest) (*SendBulkMessageResponse, error) {
	p := GetProvider()
	if p == nil {
		return nil, fmt.Errorf("provider not initialized")
	}
	return p.SendBulkMessage(ctx, req)
}

// MarkAsRead is a convenience function that uses the current provider
func MarkAsRead(ctx context.Context, sessionID, messageID, chatJID string) error {
	p := GetProvider()
	if p == nil {
		return fmt.Errorf("provider not initialized")
	}
	return p.MarkAsRead(ctx, sessionID, messageID, chatJID)
}
