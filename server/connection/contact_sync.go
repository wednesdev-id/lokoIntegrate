package connection

import (
	"context"
	"log"
	"loko/server/model"
	"sync"
	"time"

	"go.mau.fi/whatsmeow/types"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// ContactSyncScheduler manages periodic contact synchronization
type ContactSyncScheduler struct {
	sm       *SessionManager
	db       *gorm.DB
	interval time.Duration
	stopChan chan struct{}

	// Sync state tracking
	isSyncing      bool
	lastSyncTime   time.Time
	lastSyncStatus string
	mu             sync.RWMutex // Protect state fields
}

// NewContactSyncScheduler creates a new contact sync scheduler
func NewContactSyncScheduler(sm *SessionManager, db *gorm.DB, intervalMinutes int) *ContactSyncScheduler {
	return &ContactSyncScheduler{
		sm:       sm,
		db:       db,
		interval: time.Duration(intervalMinutes) * time.Minute,
		stopChan: make(chan struct{}),
	}
}

// Start begins the periodic contact sync
func (css *ContactSyncScheduler) Start() {
	log.Printf("📇 Contact sync scheduler started (interval: %v)", css.interval)

	// Run initial sync after 1 minute
	time.AfterFunc(1*time.Minute, func() {
		css.syncContacts()
	})

	// Then run periodically
	ticker := time.NewTicker(css.interval)
	go func() {
		for {
			select {
			case <-ticker.C:
				css.syncContacts()
			case <-css.stopChan:
				ticker.Stop()
				log.Println("📇 Contact sync scheduler stopped")
				return
			}
		}
	}()
}

// Stop stops the contact sync scheduler
func (css *ContactSyncScheduler) Stop() {
	close(css.stopChan)
}

// syncContacts syncs all contacts from WhatsApp to database
func (css *ContactSyncScheduler) syncContacts() {
	// Set syncing state
	css.mu.Lock()
	if css.isSyncing {
		log.Println("⚠️  Sync already in progress, skipping")
		css.mu.Unlock()
		return
	}
	css.isSyncing = true
	css.lastSyncStatus = "running"
	css.mu.Unlock()

	// Defer to reset state
	defer func() {
		css.mu.Lock()
		css.isSyncing = false
		css.lastSyncTime = time.Now()
		css.mu.Unlock()
	}()

	log.Println("🔄 Starting contact sync from WhatsApp to database...")

	css.sm.mu.RLock()
	clients := css.sm.clients
	css.sm.mu.RUnlock()

	if len(clients) == 0 {
		log.Println("⚠️  No active WhatsApp clients for contact sync")
		css.mu.Lock()
		css.lastSyncStatus = "no_clients"
		css.mu.Unlock()
		return
	}

	totalSynced := 0
	totalGroups := 0

	// Sync contacts for each active session
	for sessionID, client := range clients {
		if !client.IsConnected() {
			log.Printf("⚠️  Session %s not connected, skipping", sessionID)
			continue
		}

		// Get session info
		var session model.WhatsAppSessionModel
		if err := css.db.Where("id = ?", sessionID).First(&session).Error; err != nil {
			log.Printf("⚠️  Session %s not found in database", sessionID)
			continue
		}

		log.Printf("📱 Syncing contacts for session: %s", session.SessionName)

		// Safety check: Ensure Store is initialized
		if client.Store == nil {
			log.Printf("⚠️  Session %s: Store not initialized yet, skipping", sessionID)
			continue
		}

		// Safety check: Ensure Contacts store is initialized
		if client.Store.Contacts == nil {
			log.Printf("⚠️  Session %s: Contacts store not initialized yet, skipping", sessionID)
			continue
		}

		// Get all contacts from WhatsApp store
		contacts, err := client.Store.Contacts.GetAllContacts(context.Background())
		if err != nil {
			log.Printf("❌ Failed to get contacts for session %s: %v", sessionID, err)
			continue
		}

		// Sync contacts to database
		for jid, contactInfo := range contacts {
			// Skip own number
			if client.Store.ID != nil && jid == *client.Store.ID {
				continue
			}

			// Skip group JIDs in contacts
			if jid.Server == types.GroupServer {
				continue
			}

			// Get best available name from contact info
			name := contactInfo.FullName
			if name == "" {
				name = contactInfo.PushName
			}
			if name == "" {
				name = jid.User // Phone number as fallback
			}

			var pushName *string
			if contactInfo.PushName != "" {
				p := contactInfo.PushName
				pushName = &p
			}

			contact := model.WhatsAppContact{
				SessionID:   session.ID.String(),
				UserID:      session.UserID,
				JID:         jid.String(),
				Name:        name,
				PushName:    pushName,
				PhoneNumber: jid.User,
			}

			// UPSERT contact (update if exists, insert if new)
			if err := css.db.Clauses(clause.OnConflict{
				Columns:   []clause.Column{{Name: "session_id"}, {Name: "user_id"}, {Name: "j_id"}},
				DoUpdates: clause.AssignmentColumns([]string{"name", "push_name", "phone_number", "updated_at"}),
			}).Create(&contact).Error; err != nil {
				log.Printf("⚠️  Failed to sync contact %s: %v", jid.String(), err)
			} else {
				totalSynced++
			}
		}

		// Sync groups separately
		groups, err := client.GetJoinedGroups(context.Background())
		if err != nil {
			log.Printf("⚠️  Failed to get groups for session %s: %v", sessionID, err)
		} else {
			for _, groupInfo := range groups {
				group := model.WhatsAppGroup{
					SessionID: session.ID.String(),
					UserID:    session.UserID,
					JID:       groupInfo.JID.String(),
					Name:      groupInfo.Name,
					OwnerJID:  groupInfo.OwnerJID.String(),
					CreatedAt: time.Now(),
				}

				if err := css.db.Clauses(clause.OnConflict{
					Columns:   []clause.Column{{Name: "session_id"}, {Name: "user_id"}, {Name: "j_id"}},
					DoUpdates: clause.AssignmentColumns([]string{"name", "owner_j_id", "updated_at"}),
				}).Create(&group).Error; err != nil {
					log.Printf("⚠️  Failed to sync group %s: %v", groupInfo.JID.String(), err)
				} else {
					totalGroups++
				}
			}
		}

		log.Printf("✅ Session %s: Synced %d contacts, %d groups", session.SessionName, totalSynced, totalGroups)
	}

	// Update final status
	css.mu.Lock()
	css.lastSyncStatus = "completed"
	css.mu.Unlock()

	log.Printf("✅ Contact sync completed: %d contacts, %d groups total", totalSynced, totalGroups)
}

// SyncContactsNow triggers an immediate contact sync (can be called via API)
func (css *ContactSyncScheduler) SyncContactsNow() {
	go css.syncContacts()
}

// GetState returns current sync state
func (css *ContactSyncScheduler) GetState() map[string]interface{} {
	css.mu.RLock()
	defer css.mu.RUnlock()

	return map[string]interface{}{
		"is_syncing":       css.isSyncing,
		"last_sync_time":   css.lastSyncTime,
		"last_sync_status": css.lastSyncStatus,
	}
}

// Global sync scheduler instance
var globalContactSyncScheduler *ContactSyncScheduler

// StartContactSync initializes and starts the contact sync scheduler
func StartContactSync(sm *SessionManager, db *gorm.DB, intervalMinutes int) {
	if globalContactSyncScheduler != nil {
		log.Println("⚠️  Contact sync already running")
		return
	}

	globalContactSyncScheduler = NewContactSyncScheduler(sm, db, intervalMinutes)
	globalContactSyncScheduler.Start()
}

// StopContactSync stops the contact sync scheduler
func StopContactSync() {
	if globalContactSyncScheduler != nil {
		globalContactSyncScheduler.Stop()
		globalContactSyncScheduler = nil
	}
}

// TriggerContactSyncNow triggers immediate sync (for API endpoint)
func TriggerContactSyncNow() map[string]interface{} {
	if globalContactSyncScheduler != nil {
		state := globalContactSyncScheduler.GetState()
		if state["is_syncing"].(bool) {
			return map[string]interface{}{
				"triggered": false,
				"message":   "Sync already in progress",
				"state":     state,
			}
		}
		globalContactSyncScheduler.SyncContactsNow()
		return map[string]interface{}{
			"triggered": true,
			"message":   "Contact sync triggered successfully",
			"state":     globalContactSyncScheduler.GetState(),
		}
	}
	return map[string]interface{}{
		"triggered": false,
		"message":   "Contact sync scheduler not running",
	}
}

// GetContactSyncState returns current sync state
func GetContactSyncState() map[string]interface{} {
	if globalContactSyncScheduler != nil {
		return globalContactSyncScheduler.GetState()
	}
	return map[string]interface{}{
		"is_syncing":       false,
		"last_sync_time":   nil,
		"last_sync_status": "scheduler_not_running",
	}
}
