package broadcast

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"loko/server/connection"
	"loko/server/model"
	"math/rand"
	"regexp"
	"strings"
	"time"

	"go.mau.fi/whatsmeow"
	waProto "go.mau.fi/whatsmeow/binary/proto"
	"go.mau.fi/whatsmeow/types"
	"google.golang.org/protobuf/proto"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var templateVarPattern = regexp.MustCompile(`\{\{\s*([a-zA-Z0-9_]+)\s*\}\}`)
var phoneLikeNamePattern = regexp.MustCompile(`^[+\d\s().-]{8,}$`)

// StartBroadcastScheduler starts a background goroutine that checks for
// pending broadcast schedules every 30 seconds and processes them.
func StartBroadcastScheduler(db *gorm.DB, sqlDB *sql.DB) {
	log.Println("📅 [BroadcastScheduler] Starting background broadcast scheduler...")
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()

		for {
			<-ticker.C
			processPendingBroadcasts(db, sqlDB)
		}
	}()
}

// processPendingBroadcasts queries and processes all due broadcasts
func processPendingBroadcasts(db *gorm.DB, sqlDB *sql.DB) {
	var schedules []model.BroadcastSchedule
	now := time.Now()

	if err := db.Where("status = ? AND scheduled_at <= ?", "pending", now).
		Find(&schedules).Error; err != nil {
		log.Printf("❌ [BroadcastScheduler] Failed to query pending schedules: %v", err)
		return
	}

	if len(schedules) == 0 {
		return
	}

	log.Printf("📅 [BroadcastScheduler] Found %d broadcast(s) to process", len(schedules))
	for _, schedule := range schedules {
		go ProcessBroadcast(db, sqlDB, schedule)
	}
}

// ProcessBroadcast executes a single broadcast schedule.
// Exported so it can also be triggered from SendBroadcastNow handler.
func ProcessBroadcast(db *gorm.DB, sqlDB *sql.DB, schedule model.BroadcastSchedule) {
	log.Printf("📤 [BroadcastScheduler] Processing broadcast %s (type=%s, recipients=%d)",
		schedule.ID, schedule.BroadcastType, len(schedule.Recipients))

	// Mark as processing
	if err := db.Model(&schedule).Update("status", "processing").Error; err != nil {
		log.Printf("❌ [BroadcastScheduler] Failed to mark processing for %s: %v", schedule.ID, err)
		return
	}

	// Re-validate session_code before sending
	sessionManager := connection.GetSessionManager(db, sqlDB)
	session, err := sessionManager.GetSession(schedule.SessionID)
	if err != nil {
		errMsg := fmt.Sprintf("Session not found: %v", err)
		db.Model(&schedule).Updates(map[string]interface{}{
			"status":        "failed",
			"error_message": errMsg,
		})
		log.Printf("❌ [BroadcastScheduler] %s", errMsg)
		return
	}

	if err := sessionManager.ValidateSession(session.ID.String(), schedule.SessionCode); err != nil {
		errMsg := fmt.Sprintf("Session code validation failed: %v", err)
		db.Model(&schedule).Updates(map[string]interface{}{
			"status":        "failed",
			"error_message": errMsg,
		})
		log.Printf("❌ [BroadcastScheduler] %s for broadcast %s", errMsg, schedule.ID)
		return
	}

	// Get WhatsApp client
	client, exists := sessionManager.GetClient(session.ID)
	if !exists || client == nil || !client.IsLoggedIn() {
		errMsg := "WhatsApp client not available or not logged in"
		db.Model(&schedule).Updates(map[string]interface{}{
			"status":        "failed",
			"error_message": errMsg,
		})
		log.Printf("❌ [BroadcastScheduler] %s for broadcast %s", errMsg, schedule.ID)
		return
	}

	sentCount := 0
	failedCount := 0
	delayMs := schedule.DelayMs
	if delayMs < 500 {
		delayMs = 500
	}

	for _, recipient := range schedule.Recipients {
		jid := recipient
		if !strings.Contains(jid, "@") {
			if schedule.BroadcastType == "group" {
				jid = recipient + "@g.us"
			} else {
				jid = recipient + "@s.whatsapp.net"
			}
		}

		parsedJID, err := types.ParseJID(jid)
		if err != nil {
			log.Printf("⚠️ [BroadcastScheduler] Invalid JID %s: %v", jid, err)
			failedCount++
			continue
		}

		// Build per-recipient template variables from WhatsApp contact model
		templateVars := buildContactTemplateVars(db, schedule.SessionID, jid, parsedJID.User)
		enrichTemplateVarsFromClient(client, parsedJID, templateVars)
		if schedule.UseUniqueCode {
			templateVars["code"] = randomCode(5)
		}

		// Render message/caption using {{variable}} placeholders.
		msg := renderTemplate(schedule.Message, templateVars)
		recipientStatus := model.BroadcastRecipientStatus{
			BroadcastID:    schedule.ID,
			SessionID:      schedule.SessionID,
			RecipientInput: recipient,
			ResolvedJID:    parsedJID.String(),
			RenderedBody:   msg,
			Status:         "pending",
		}
		if err := db.Create(&recipientStatus).Error; err != nil {
			log.Printf("⚠️ [BroadcastScheduler] Failed to create recipient status: %v", err)
		}

		// Build WhatsApp message
		var waMsg *waProto.Message
		if schedule.MessageType == "text" || schedule.MediaURL == nil {
			waMsg = &waProto.Message{
				Conversation: proto.String(msg),
			}
		} else {
			// For media messages, we send just the caption as text for now
			// Full media upload can be extended later
			caption := renderTemplate(schedule.Caption, templateVars)
			if caption == "" {
				caption = msg
			}
			waMsg = &waProto.Message{
				Conversation: proto.String(caption),
			}
		}

		sendResp, err := client.SendMessage(context.Background(), parsedJID, waMsg)
		if err != nil {
			log.Printf("⚠️ [BroadcastScheduler] Failed to send to %s: %v", jid, err)
			failedCount++
			errMsg := err.Error()
			_ = db.Model(&recipientStatus).Updates(map[string]interface{}{
				"status":        "failed",
				"error_message": errMsg,
			}).Error
		} else {
			sentCount++
			// Resolve canonical chat_jid format from our stored contacts to avoid duplicates
			// (e.g. @s.whatsapp.net vs @lid for the same phone number).
			canonicalChatJID := resolveCanonicalChatJID(db, schedule.SessionID, parsedJID.String(), parsedJID.User)

			// Persist outbound broadcast so it appears in Chat Management history/list.
			senderJID := "me@s.whatsapp.net"
			if client.Store != nil && client.Store.ID != nil {
				senderJID = client.Store.ID.String()
			}
			saveOutboundBroadcastMessage(db, session, senderJID, canonicalChatJID, msg, schedule.MessageType, sendResp.ID, sendResp.Timestamp)
			broadcastOutboundBroadcastMessage(session.ID.String(), senderJID, canonicalChatJID, msg, schedule.MessageType, sendResp.ID, sendResp.Timestamp)
			sentAt := sendResp.Timestamp
			_ = db.Model(&recipientStatus).Updates(map[string]interface{}{
				"status":      "sent",
				"message_id":  sendResp.ID,
				"resolved_jid": canonicalChatJID,
				"sent_at":     &sentAt,
			}).Error
		}

		// Update counts progressively
		db.Model(&schedule).Updates(map[string]interface{}{
			"sent_count":   sentCount,
			"failed_count": failedCount,
		})

		// Delay between messages
		if sentCount+failedCount < len(schedule.Recipients) {
			time.Sleep(time.Duration(delayMs) * time.Millisecond)
		}
	}

	// Mark final status
	finalStatus := "completed"
	if failedCount > 0 && sentCount == 0 {
		finalStatus = "failed"
	} else if failedCount > 0 {
		finalStatus = "completed" // Partially succeeded — still mark completed
	}

	db.Model(&schedule).Updates(map[string]interface{}{
		"status":       finalStatus,
		"sent_count":   sentCount,
		"failed_count": failedCount,
	})

	log.Printf("✅ [BroadcastScheduler] Broadcast %s done — sent=%d failed=%d status=%s",
		schedule.ID, sentCount, failedCount, finalStatus)
}

func saveOutboundBroadcastMessage(
	db *gorm.DB,
	session *model.WhatsAppSessionModel,
	senderJID string,
	chatJID string,
	content, messageType, messageID string,
	timestamp time.Time,
) {
	if timestamp.IsZero() {
		timestamp = time.Now()
	}

	outbound := model.WhatsAppMessage{
		SessionID:   session.ID.String(),
		UserID:      session.UserID,
		MessageID:   messageID,
		ChatJID:     chatJID,
		SenderJID:   senderJID,
		MessageType: messageType,
		Content:     content,
		IsFromMe:    true,
		Timestamp:   timestamp,
		Status:      "sent",
	}

	if err := db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "message_id"}},
		DoUpdates: clause.AssignmentColumns([]string{"status"}),
	}).Create(&outbound).Error; err != nil {
		log.Printf("⚠️ [BroadcastScheduler] Failed to save outbound broadcast message: %v", err)
	} else {
		log.Printf("💾 [BroadcastScheduler] Outbound broadcast saved: msg_id=%s chat=%s ts=%s",
			messageID, chatJID, timestamp.Format(time.RFC3339))
	}
}

func broadcastOutboundBroadcastMessage(
	sessionID string,
	senderJID string,
	chatJID string,
	content, messageType, messageID string,
	timestamp time.Time,
) {
	if timestamp.IsZero() {
		timestamp = time.Now()
	}

	broadcaster := connection.GetMessageBroadcaster()
	broadcaster.Broadcast(connection.MessageEvent{
		Type:        "new_message",
		SessionID:   sessionID,
		MessageID:   messageID,
		ChatJID:     chatJID,
		SenderJID:   senderJID,
		MessageType: messageType,
		Content:     content,
		IsFromMe:    true,
		Timestamp:   timestamp,
		Status:      "sent",
	})
}

func resolveCanonicalChatJID(db *gorm.DB, sessionID, candidateJID, phone string) string {
	var contact model.WhatsAppContact

	// Prefer exact JID match first.
	if err := db.Where("session_id = ? AND jid = ?", sessionID, candidateJID).
		Find(&contact).Error; err == nil && contact.ID != 0 && contact.JID != "" {
		return contact.JID
	}

	// Fallback: same phone number in this session.
	contact = model.WhatsAppContact{}
	if err := db.Where("session_id = ? AND phone_number = ?", sessionID, phone).
		Find(&contact).Error; err == nil && contact.ID != 0 && contact.JID != "" {
		return contact.JID
	}

	// Last resort: keep candidate as-is.
	return candidateJID
}

func renderTemplate(tpl string, vars map[string]string) string {
	if tpl == "" {
		return ""
	}

	return templateVarPattern.ReplaceAllStringFunc(tpl, func(token string) string {
		matches := templateVarPattern.FindStringSubmatch(token)
		if len(matches) < 2 {
			return token
		}
		key := strings.ToLower(strings.TrimSpace(matches[1]))
		if v, ok := vars[key]; ok {
			return v
		}
		return ""
	})
}

func buildContactTemplateVars(db *gorm.DB, sessionID, rawJID, phone string) map[string]string {
	var contact model.WhatsAppContact

	// Query by exact JID first; then fallback by phone number in the same session.
	err := db.Where("session_id = ? AND jid = ?", sessionID, rawJID).Find(&contact).Error
	if err != nil || contact.ID == 0 {
		var contacts []model.WhatsAppContact
		db.Where("session_id = ? AND phone_number = ?", sessionID, phone).Find(&contacts)
		// Prefer contact with non-phone-like display name.
		for i := range contacts {
			if strings.TrimSpace(contacts[i].Name) != "" && !phoneLikeNamePattern.MatchString(strings.TrimSpace(contacts[i].Name)) {
				contact = contacts[i]
				break
			}
		}
		if contact.ID == 0 && len(contacts) > 0 {
			contact = contacts[0]
		}
	}

	vars := map[string]string{
		"phone": phone,
		"jid":   rawJID,
	}

	// Expose all relevant contact model fields for template usage.
	if contact.ID != 0 {
		vars["id"] = fmt.Sprintf("%d", contact.ID)
		vars["session_id"] = contact.SessionID
		vars["user_id"] = contact.UserID
		vars["jid"] = contact.JID
		vars["phone_number"] = contact.PhoneNumber
		vars["is_blocked"] = fmt.Sprintf("%t", contact.IsBlocked)
		vars["created_at"] = contact.CreatedAt.Format(time.RFC3339)
		vars["updated_at"] = contact.UpdatedAt.Format(time.RFC3339)

		if contact.Name != "" {
			vars["name"] = contact.Name
		}
		if contact.PushName != nil {
			vars["push_name"] = *contact.PushName
		}
		if contact.AvatarURL != nil {
			vars["avatar_url"] = *contact.AvatarURL
		}
		if contact.LastSeen != nil {
			vars["last_seen"] = contact.LastSeen.Format(time.RFC3339)
		}
	}

	// Required fallback: if name is empty, use push_name.
	if strings.TrimSpace(vars["name"]) == "" {
		vars["name"] = strings.TrimSpace(vars["push_name"])
	}
	// Final fallback to phone so {{name}} always resolvable.
	if strings.TrimSpace(vars["name"]) == "" {
		vars["name"] = phone
	}

	return vars
}

func enrichTemplateVarsFromClient(client *whatsmeow.Client, parsedJID types.JID, vars map[string]string) {
	if client == nil || client.Store == nil || client.Store.Contacts == nil {
		return
	}

	useIncomingName := strings.TrimSpace(vars["name"]) == "" || phoneLikeNamePattern.MatchString(strings.TrimSpace(vars["name"]))

	applyName := func(fullName, pushName string) {
		if useIncomingName {
			if strings.TrimSpace(fullName) != "" {
				vars["name"] = strings.TrimSpace(fullName)
			} else if strings.TrimSpace(pushName) != "" {
				vars["name"] = strings.TrimSpace(pushName)
			}
		}
		if strings.TrimSpace(vars["push_name"]) == "" && strings.TrimSpace(pushName) != "" {
			vars["push_name"] = strings.TrimSpace(pushName)
		}
	}

	contact, err := client.Store.Contacts.GetContact(context.Background(), parsedJID)
	if err == nil {
		applyName(contact.FullName, contact.PushName)
	}

	// Secondary lookup for lid-format contacts when direct JID is s.whatsapp.net.
	if parsedJID.Server != "lid" {
		if lidJID, parseErr := types.ParseJID(parsedJID.User + "@lid"); parseErr == nil {
			lidContact, lidErr := client.Store.Contacts.GetContact(context.Background(), lidJID)
			if lidErr == nil {
				applyName(lidContact.FullName, lidContact.PushName)
				if vars["jid"] == "" || strings.HasSuffix(vars["jid"], "@s.whatsapp.net") {
					vars["jid"] = lidJID.String()
				}
			}
		}
	}
}

const letters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

func randomCode(n int) string {
	b := make([]byte, n)
	for i := range b {
		b[i] = letters[rand.Intn(len(letters))]
	}
	return string(b)
}
