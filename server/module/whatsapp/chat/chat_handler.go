package chat

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"loko/server/cache"
	"loko/server/connection"
	"loko/server/dto"
	"loko/server/model"
	"loko/server/response"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/gofiber/fiber/v2"
	"go.mau.fi/whatsmeow/types"
	"gorm.io/gorm"
)

// Handler handles chat-related HTTP requests
type Handler struct {
	DB         *gorm.DB
	SqlDB      *sql.DB
	Cache      cache.ChatCache   // Legacy in-memory cache
	RedisCache *cache.RedisCache // New Redis cache
}

// NewHandler creates a new chat handler
func NewHandler(db *gorm.DB, sqlDB *sql.DB, cache cache.ChatCache, redisCache *cache.RedisCache) *Handler {
	return &Handler{
		DB:         db,
		SqlDB:      sqlDB,
		Cache:      cache,
		RedisCache: redisCache,
	}
}

// GetChats retrieves all chats with recent activity
// @Summary Get WhatsApp chats
// @Description Get list of chats with recent activity
// @Tags WhatsApp Chats
// @Accept json
// @Produce json
// @Param session_id query string false "Session ID"
// @Param limit query int false "Limit results" default(50)
// @Param offset query int false "Offset for pagination" default(0)
// @Param hours query int false "Hours back for activity" default(720) maximum(8760)
// @Success 200 {object} response.WhatsAppBaseResponse
// @Failure 503 {object} response.ErrorResponse
// @Router /whatsapp/chats [get]
func (h *Handler) GetChats(c *fiber.Ctx) error {
	// Get pagination params
	limitStr := c.Query("limit", "100")
	offsetStr := c.Query("offset", "0")
	hoursBackStr := c.Query("hours", "720") // Default 30 days instead of 24 hours
	sessionID := c.Query("session_id")
	sessionCode := c.Query("session_code") // Get session_code

	limit, _ := strconv.Atoi(limitStr)
	offset, _ := strconv.Atoi(offsetStr)
	hoursBack, _ := strconv.Atoi(hoursBackStr)

	// Validate and set reasonable limits
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	if offset < 0 {
		offset = 0
	}
	if hoursBack <= 0 || hoursBack > 8760 { // Max 1 year (365 * 24 = 8760)
		hoursBack = 720 // Default 30 days (30 * 24 = 720)
	}

	// Get session manager
	sessionManager := connection.GetSessionManager(h.DB, h.SqlDB)

	var activeSession *model.WhatsAppSessionModel

	// Attempt to resolve session ID alias (like 'default-user') to actual UUID using session manager
	var actualSessionID string = sessionID

	if actualSessionID == "" {
		// Get user ID from authentication context (set by UseAuth middleware)
		userIDVal := c.Locals("user_id")
		if userIDVal == nil {
			return c.Status(fiber.StatusUnauthorized).JSON(response.ErrorResponse{
				Success: false,
				Message: "Unauthorized: user ID not found in context",
				Error:   "Missing authentication",
			})
		}
		userID := userIDVal.(string)
		sessions, err := sessionManager.GetUserSessions(userID)
		if err != nil || len(sessions) == 0 {
			return c.Status(fiber.StatusServiceUnavailable).JSON(response.ErrorResponse{
				Success: false,
				Message: "No active WhatsApp sessions found",
				Error:   "Please connect a WhatsApp session first",
			})
		}

		// Find first connected session
		for i := range sessions {
			if sessions[i].Status == "connected" {
				activeSession = &sessions[i]
				break
			}
		}

		// If no connected session, use the first one
		if activeSession == nil {
			activeSession = &sessions[0]
		}
		actualSessionID = activeSession.ID.String()
	} else {
		session, err := sessionManager.GetSession(actualSessionID)
		if err != nil {
			return c.Status(fiber.StatusNotFound).JSON(response.ErrorResponse{
				Success: false,
				Message: "Session not found",
				Error:   err.Error(),
			})
		}
		activeSession = session
	}

	// Validate sessionCode — mandatory when session_id is known to prevent cross-session data leakage
	if sessionCode == "" {
		return c.Status(fiber.StatusBadRequest).JSON(response.ErrorResponse{
			Success: false,
			Message: "session_code is required for session validation",
			Error:   "Missing session_code parameter",
		})
	}
	if err := sessionManager.ValidateSession(actualSessionID, sessionCode); err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(response.ErrorResponse{
			Success: false,
			Message: "Unauthorized: Invalid session code",
			Error:   err.Error(),
		})
	}

	// Always use SQL as the source of truth for chat list
	// Redis is used only for supplementary unread count tracking via handleEvent
	listKey := fmt.Sprintf("chats:list:%s", activeSession.ID.String())
	_ = listKey // Keep for Redis population later

	// HYBRID APPROACH: Get chats with recent activity from database
	type ChatActivity struct {
		ChatJID       string
		LastMessage   string
		LastTimestamp time.Time
		UnreadCount   int64
	}

	// Get WhatsApp client from session manager (Needed for Group/Contact info in fallback)
	client, exists := sessionManager.GetClient(activeSession.ID)
	// We don't error out here strictly, as we might just show numbers if client is offline
	if !exists || client == nil {
		log.Printf("⚠️ [CHAT LIST] Client not available for session %s (%s) name resolution — will use raw JIDs", activeSession.ID, activeSession.SessionName)
	}

	var recentChats []ChatActivity
	cutoffTime := time.Now().Add(-time.Duration(hoursBack) * time.Hour)
	log.Printf("GetChats: session=%s, looking for chats since %v (last %d hours)", activeSession.ID, cutoffTime, hoursBack)

	// Query recent message activity correctly handling ordering vs grouping
	if err := h.DB.Raw(`
		SELECT * FROM (
			SELECT DISTINCT ON (chat_j_id)
				chat_j_id, content as last_message, timestamp as last_timestamp
			FROM whatsapp_messages
			WHERE session_id = ? AND timestamp > ? AND chat_j_id != 'status@broadcast'
			  AND chat_j_id NOT LIKE '%@newsletter'
			  AND deleted_at IS NULL
			ORDER BY chat_j_id, timestamp DESC
		) sub
		ORDER BY last_timestamp DESC
		LIMIT ? OFFSET ?
	`, activeSession.ID.String(), cutoffTime, limit, offset).Scan(&recentChats).Error; err != nil {
		log.Printf("GetChats: SQL query failed for session %s: %v", activeSession.ID, err)
		return c.Status(fiber.StatusInternalServerError).JSON(response.ErrorResponse{
			Success: false,
			Message: "Failed to retrieve chats",
			Error:   err.Error(),
		})
	}

	// Fetch unread counts separately for these chats
	if len(recentChats) > 0 {
		var jids []string
		for _, rc := range recentChats {
			jids = append(jids, rc.ChatJID)
		}

		type UnreadCount struct {
			ChatJID     string
			UnreadCount int64
		}
		var unreads []UnreadCount

		h.DB.Model(&model.WhatsAppMessage{}).
			Select("chat_j_id, COUNT(*) as unread_count").
			Where("session_id = ? AND is_from_me = false AND is_read = false AND chat_j_id IN ?",
				activeSession.ID.String(), jids).
			Group("chat_j_id").
			Scan(&unreads)

		unreadMap := make(map[string]int64)
		for _, u := range unreads {
			unreadMap[u.ChatJID] = u.UnreadCount
		}

		for i := range recentChats {
			recentChats[i].UnreadCount = unreadMap[recentChats[i].ChatJID]
		}
	}

	log.Printf("GetChats: Found %d chats, offset=%d", len(recentChats), offset)

	var chatResponses []dto.ChatResponse
	processedJIDs := make(map[string]bool)

	for _, activity := range recentChats {
		jid, err := types.ParseJID(activity.ChatJID)
		if err != nil {
			log.Printf("Invalid JID %s: %v", activity.ChatJID, err)
			continue
		}

		var chatResponse dto.ChatResponse
		chatResponse.ID = jid.String()
		chatResponse.JID = jid.String()
		chatResponse.LastMessage = &activity.LastMessage
		chatResponse.UpdatedAt = activity.LastTimestamp
		chatResponse.UnreadCount = int(activity.UnreadCount)

		// Check if it's a group
		if jid.Server == types.GroupServer {
			chatResponse.IsGroup = true
			if client != nil {
				// Get group info from WhatsApp
				groupInfo, err := client.GetGroupInfo(context.Background(), jid)
				if err == nil && groupInfo != nil {
					chatResponse.Name = groupInfo.Name
				} else {
					chatResponse.Name = jid.User // Fallback
				}
			} else {
				chatResponse.Name = jid.User // Client unavailable fallback
			}
		} else {
			chatResponse.IsGroup = false
			if client != nil {
				// Get contact info from WhatsApp store
				contact, err := client.Store.Contacts.GetContact(context.Background(), jid)
				if err == nil {
					// Priority: FullName > PushName > Phone
					if contact.FullName != "" {
						chatResponse.Name = contact.FullName
					} else if contact.PushName != "" {
						chatResponse.Name = contact.PushName
					} else {
						chatResponse.Name = jid.User
					}
				} else {
					chatResponse.Name = jid.User
				}
			} else {
				chatResponse.Name = jid.User // Client unavailable fallback
			}
		}

		chatResponses = append(chatResponses, chatResponse)
		processedJIDs[jid.String()] = true
	}

	// Sort by last message time (most recent first) - WhatsApp Web style
	sort.Slice(chatResponses, func(i, j int) bool {
		// Pinned chats first (if implemented later)
		if chatResponses[i].IsPinned != chatResponses[j].IsPinned {
			return chatResponses[i].IsPinned
		}
		// Then by last message time
		return chatResponses[i].UpdatedAt.After(chatResponses[j].UpdatedAt)
	})

	// === NAME RESOLUTION SCRIPT ===
	// The default name resolution above uses whatsmeow store which might be empty
	// We need to check our own whatsapp_contacts table for saved names
	if len(chatResponses) > 0 {
		var chatJIDs []string
		for _, c := range chatResponses {
			chatJIDs = append(chatJIDs, c.JID)
		}

		// Query contacts
		type ContactName struct {
			JID  string
			Name string
		}
		var savedContacts []ContactName

		// We only care about contacts that match our chat JIDs
		h.DB.Table("whatsapp_contacts").
			Select("jid, name").
			Where("session_id = ? AND jid IN (?)", activeSession.ID.String(), chatJIDs).
			Scan(&savedContacts)

		// Create Map
		contactMap := make(map[string]string)
		for _, c := range savedContacts {
			if c.Name != "" {
				contactMap[c.JID] = c.Name
			}
		}

		// Update Responses
		for i := range chatResponses {
			if savedName, exists := contactMap[chatResponses[i].JID]; exists {
				// Only override if it's currently a raw number or empty, OR just prefer saved contact name
				// Protocol: Saved Contact Name > Group Name > Push Name > Phone Number
				// Since we are managing contacts, the saved name should be the source of truth for "display name"
				// Exception: Groups usually manage their own Subject, but if user renamed it locally?
				// For now let's apply to non-groups primarily, or all if we treat contact list as address book
				if !chatResponses[i].IsGroup {
					chatResponses[i].Name = savedName
				}
			}
		}
		log.Printf("GetChats: Resolved %d contact names from database", len(savedContacts))
	}
	// === END NAME RESOLUTION ===

	log.Printf("GetChats: Returning %d chats sorted by recent activity", len(chatResponses))

	// Populate Redis Cache (Async)
	if h.RedisCache != nil && h.RedisCache.IsAvailable() && len(chatResponses) > 0 {
		go func(chats []dto.ChatResponse, sessionID string) {
			ctx := context.Background()
			listKey := fmt.Sprintf("chats:list:%s", sessionID)

			for _, chat := range chats {
				chatKey := fmt.Sprintf("chats:data:%s:%s", sessionID, chat.JID)

				// Calculate timestamp score
				ts := float64(chat.UpdatedAt.Unix())

				// 1. ZAdd
				h.RedisCache.ZAdd(ctx, listKey, ts, chat.JID)

				// 2. HSet
				lastMsg := ""
				if chat.LastMessage != nil {
					lastMsg = *chat.LastMessage
				}

				h.RedisCache.HSet(ctx, chatKey,
					"id", chat.ID,
					"jid", chat.JID,
					"last_message", lastMsg,
					"last_timestamp", chat.UpdatedAt.Unix(),
					"unread_count", chat.UnreadCount,
					"is_group", strconv.FormatBool(chat.IsGroup),
					"name", chat.Name,
				)
				h.RedisCache.Expire(ctx, chatKey, 30*24*time.Hour)
			}
			h.RedisCache.Expire(ctx, listKey, 30*24*time.Hour)
			log.Printf("💾 [CHAT CACHE] Populated Redis with %d chats", len(chats))
		}(chatResponses, activeSession.ID.String())
	}

	apiResponse := response.NewSuccessResponse("Chats retrieved successfully", map[string]interface{}{
		"chats":      chatResponses,
		"total":      len(chatResponses),
		"limit":      limit,
		"offset":     offset,
		"hours_back": hoursBack,
		"has_more":   len(chatResponses) == limit, // Indicate if there's more data
	})

	return c.Status(fiber.StatusOK).JSON(apiResponse)
}

// DeleteChat deletes a chat history from local database/cache.
// Optionally attempts delete on WhatsApp (currently not supported for full chat wipe via API).
// @Summary Delete chat history
// @Description Delete all local messages for a specific chat (and remove from local chat list)
// @Tags WhatsApp Chats
// @Accept json
// @Produce json
// @Param session_id query string true "Session ID"
// @Param session_code query string true "Session code for validation"
// @Param chat_jid query string true "Chat JID"
// @Param delete_from_wa query boolean false "Attempt delete on WhatsApp side"
// @Success 200 {object} response.WhatsAppBaseResponse
// @Failure 400 {object} response.ErrorResponse
// @Failure 401 {object} response.ErrorResponse
// @Router /whatsapp/v1/chats [delete]
func (h *Handler) DeleteChat(c *fiber.Ctx) error {
	sessionID := c.Query("session_id")
	sessionCode := c.Query("session_code")
	chatJID := c.Query("chat_jid")
	deleteFromWA := c.QueryBool("delete_from_wa", false)

	if sessionID == "" || sessionCode == "" || chatJID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(response.ErrorResponse{
			Success: false,
			Message: "session_id, session_code, and chat_jid are required",
		})
	}

	sessionManager := connection.GetSessionManager(h.DB, h.SqlDB)
	session, err := sessionManager.GetSession(sessionID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(response.ErrorResponse{
			Success: false,
			Message: "Session not found",
			Error:   err.Error(),
		})
	}
	if err := sessionManager.ValidateSession(session.ID.String(), sessionCode); err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(response.ErrorResponse{
			Success: false,
			Message: "Unauthorized: Invalid session code",
			Error:   err.Error(),
		})
	}

	// Soft delete local messages for this chat.
	msgResult := h.DB.Where("session_id = ? AND chat_j_id = ?", session.ID.String(), chatJID).
		Delete(&model.WhatsAppMessage{})
	if msgResult.Error != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(response.ErrorResponse{
			Success: false,
			Message: "Failed to delete local chat messages",
			Error:   msgResult.Error.Error(),
		})
	}

	// Remove local chat metadata if exists (compatible with both j_id and jid schemas).
	deletedChatMetadata, err := h.softDeleteChatMetadata(session.ID.String(), chatJID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(response.ErrorResponse{
			Success: false,
			Message: "Failed to delete local chat metadata",
			Error:   err.Error(),
		})
	}

	// Remove cached chat entry.
	if h.RedisCache != nil && h.RedisCache.IsAvailable() {
		ctx := context.Background()
		listKey := fmt.Sprintf("chats:list:%s", session.ID.String())
		chatKey := fmt.Sprintf("chats:data:%s:%s", session.ID.String(), chatJID)
		_ = h.RedisCache.ZRem(ctx, listKey, chatJID)
		_ = h.RedisCache.Del(ctx, chatKey)
	}

	waDeleteSupported := false
	waDeleteMessage := "Delete full chat on WhatsApp side is not supported by current API flow; local DB deleted only."
	waCheckPerformed := false
	waChatExists := false
	waCheckReason := ""
	if deleteFromWA {
		// Full chat wipe on WA is not exposed in current flow, but we still perform best-effort existence check.
		waDeleteMessage = "Full chat deletion on WA is not supported by current API flow; local DB deleted. WA existence was checked (best effort)."
		waCheckPerformed = true
		exists, reason := h.checkChatExistsOnWhatsApp(session.ID.String(), chatJID)
		waChatExists = exists
		waCheckReason = reason
		if exists {
			log.Printf("ℹ️ DeleteChat delete_from_wa=true: chat %s still appears to exist on WA (%s)", chatJID, reason)
		} else {
			log.Printf("ℹ️ DeleteChat delete_from_wa=true: chat %s not found on WA (%s)", chatJID, reason)
		}
	}

	return c.Status(fiber.StatusOK).JSON(response.NewSuccessResponse("Chat deleted from local database", map[string]interface{}{
		"session_id":            session.ID.String(),
		"chat_jid":              chatJID,
		"deleted_messages":      msgResult.RowsAffected,
		"deleted_chat_metadata": deletedChatMetadata,
		"delete_from_wa":        deleteFromWA,
		"wa_delete_supported":   waDeleteSupported,
		"wa_delete_message":     waDeleteMessage,
		"wa_check_performed":    waCheckPerformed,
		"wa_chat_exists":        waChatExists,
		"wa_check_reason":       waCheckReason,
	}))
}

// CheckChatConsistency validates whether a chat still exists on WhatsApp (best effort)
// and optionally cleans up local DB/cache when WA indicates missing chat.
// @Summary Check WA-vs-DB chat consistency
// @Description Validate chat consistency and optionally delete local data when chat is missing on WA
// @Tags WhatsApp Chats
// @Accept json
// @Produce json
// @Param session_id query string true "Session ID"
// @Param session_code query string true "Session code for validation"
// @Param chat_jid query string true "Chat JID"
// @Param cleanup_if_missing query boolean false "Auto delete local DB/cache when WA check says chat missing" default(false)
// @Success 200 {object} response.WhatsAppBaseResponse
// @Failure 400 {object} response.ErrorResponse
// @Failure 401 {object} response.ErrorResponse
// @Router /whatsapp/v1/chats/consistency-check [post]
func (h *Handler) CheckChatConsistency(c *fiber.Ctx) error {
	sessionID := c.Query("session_id")
	sessionCode := c.Query("session_code")
	chatJID := c.Query("chat_jid")
	cleanupIfMissing := c.QueryBool("cleanup_if_missing", false)

	if sessionID == "" || sessionCode == "" || chatJID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(response.ErrorResponse{
			Success: false,
			Message: "session_id, session_code, and chat_jid are required",
		})
	}

	sessionManager := connection.GetSessionManager(h.DB, h.SqlDB)
	session, err := sessionManager.GetSession(sessionID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(response.ErrorResponse{
			Success: false,
			Message: "Session not found",
			Error:   err.Error(),
		})
	}
	if err := sessionManager.ValidateSession(session.ID.String(), sessionCode); err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(response.ErrorResponse{
			Success: false,
			Message: "Unauthorized: Invalid session code",
			Error:   err.Error(),
		})
	}

	waExists, reason := h.checkChatExistsOnWhatsApp(session.ID.String(), chatJID)

	cleanupApplied := false
	var deletedMessages int64 = 0
	var deletedChatMetadata int64 = 0

	if cleanupIfMissing && !waExists {
		msgResult := h.DB.Where("session_id = ? AND chat_j_id = ?", session.ID.String(), chatJID).
			Delete(&model.WhatsAppMessage{})
		if msgResult.Error != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(response.ErrorResponse{
				Success: false,
				Message: "WA check done, but failed to cleanup local messages",
				Error:   msgResult.Error.Error(),
			})
		}
		deletedChatMetadataRes, err := h.softDeleteChatMetadata(session.ID.String(), chatJID)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(response.ErrorResponse{
				Success: false,
				Message: "WA check done, but failed to cleanup local chat metadata",
				Error:   err.Error(),
			})
		}

		deletedMessages = msgResult.RowsAffected
		deletedChatMetadata = deletedChatMetadataRes
		cleanupApplied = true

		if h.RedisCache != nil && h.RedisCache.IsAvailable() {
			ctx := context.Background()
			listKey := fmt.Sprintf("chats:list:%s", session.ID.String())
			chatKey := fmt.Sprintf("chats:data:%s:%s", session.ID.String(), chatJID)
			_ = h.RedisCache.ZRem(ctx, listKey, chatJID)
			_ = h.RedisCache.Del(ctx, chatKey)
		}
	}

	return c.Status(fiber.StatusOK).JSON(response.NewSuccessResponse("Chat consistency check completed", map[string]interface{}{
		"session_id":             session.ID.String(),
		"chat_jid":               chatJID,
		"wa_chat_exists":         waExists,
		"wa_check_reason":        reason,
		"cleanup_if_missing":     cleanupIfMissing,
		"cleanup_applied":        cleanupApplied,
		"deleted_messages":       deletedMessages,
		"deleted_chat_metadata":  deletedChatMetadata,
		"consistency_recommendation": map[string]string{
			"action": ternaryAction(waExists, cleanupApplied),
		},
	}))
}

func (h *Handler) checkChatExistsOnWhatsApp(sessionID string, chatJID string) (bool, string) {
	sessionManager := connection.GetSessionManager(h.DB, h.SqlDB)
	sessionUUID, err := uuid.Parse(sessionID)
	if err != nil {
		return false, "invalid session_id format"
	}
	client, exists := sessionManager.GetClient(sessionUUID)
	if !exists || client == nil {
		return false, "client not connected; cannot verify WA state"
	}

	parsedJID, err := types.ParseJID(chatJID)
	if err != nil {
		return false, "invalid chat_jid format"
	}

	// Group: direct WA query.
	if parsedJID.Server == types.GroupServer {
		_, err := client.GetGroupInfo(context.Background(), parsedJID)
		if err != nil {
			return false, "group not found / inaccessible on WA"
		}
		return true, "group exists on WA"
	}

	// Individual: best effort via contacts + synchronized DB contacts.
	if client.Store != nil {
		if _, err := client.Store.Contacts.GetContact(context.Background(), parsedJID); err == nil {
			return true, "contact found in WA store"
		}
	}

	phone := strings.Split(parsedJID.User, ":")[0]
	if phone == "" {
		return false, "cannot extract phone from JID"
	}

	var contactCount int64
	if err := h.DB.Model(&model.WhatsAppContact{}).
		Where("session_id = ? AND (jid = ? OR phone_number = ?)", sessionID, chatJID, phone).
		Count(&contactCount).Error; err == nil && contactCount > 0 {
		return true, "contact exists in synchronized whatsapp_contacts"
	}

	return false, "not found in WA store and synchronized contacts"
}

func ternaryAction(waExists bool, cleanupApplied bool) string {
	if waExists {
		return "keep_local_data_or_manual_review"
	}
	if cleanupApplied {
		return "local_data_cleaned"
	}
	return "chat_missing_on_wa_consider_cleanup_if_missing=true"
}

// softDeleteChatMetadata performs soft delete on whatsapp_chats and supports both
// legacy/new column names (j_id and jid) to avoid runtime SQL errors across deployments.
func (h *Handler) softDeleteChatMetadata(sessionID string, chatJID string) (int64, error) {
	now := time.Now()

	// Prefer current production schema variant seen in logs: j_id
	result := h.DB.Exec(
		`UPDATE "whatsapp_chats" SET "deleted_at" = ? WHERE session_id = ? AND j_id = ? AND "whatsapp_chats"."deleted_at" IS NULL`,
		now, sessionID, chatJID,
	)
	if result.Error == nil {
		return result.RowsAffected, nil
	}

	// Fallback for schemas using jid
	if strings.Contains(result.Error.Error(), `column "j_id" does not exist`) {
		fallback := h.DB.Exec(
			`UPDATE "whatsapp_chats" SET "deleted_at" = ? WHERE session_id = ? AND jid = ? AND "whatsapp_chats"."deleted_at" IS NULL`,
			now, sessionID, chatJID,
		)
		if fallback.Error == nil {
			return fallback.RowsAffected, nil
		}
		return 0, fallback.Error
	}

	return 0, result.Error
}
