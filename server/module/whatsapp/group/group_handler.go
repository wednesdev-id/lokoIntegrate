package group

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"loko/server/cache"
	"loko/server/connection"
	"loko/server/dto"
	"loko/server/response"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"go.mau.fi/whatsmeow"
	waProto "go.mau.fi/whatsmeow/binary/proto"
	"go.mau.fi/whatsmeow/types"
	"google.golang.org/protobuf/proto"
	"gorm.io/gorm"
)

// Handler handles group-related HTTP requests
type Handler struct {
	DB    *gorm.DB
	SqlDB *sql.DB
	Cache cache.ChatCache
}

// NewHandler creates a new group handler
func NewHandler(db *gorm.DB, sqlDB *sql.DB, cache cache.ChatCache) *Handler {
	return &Handler{
		DB:    db,
		SqlDB: sqlDB,
		Cache: cache,
	}
}

// CreateGroup creates a new WhatsApp group
// @Summary Create WhatsApp group
// @Description Create a new WhatsApp group with specified participants
// @Tags WhatsApp Groups
// @Accept json
// @Produce json
// @Param group body dto.CreateGroupRequest true "Group data"
// @Success 201 {object} response.CreateGroupSuccessResponse
// @Failure 400 {object} response.ErrorResponse
// @Failure 503 {object} response.ErrorResponse
// @Router /whatsapp/groups [post]
func (h *Handler) CreateGroup(c *fiber.Ctx) error {
	if connection.WhatsAppClient == nil || !connection.WhatsAppClient.IsConnected() {
		return c.Status(fiber.StatusServiceUnavailable).JSON(response.ErrorResponse{
			Success: false,
			Message: "WhatsApp client not connected",
			Error:   "Please connect to WhatsApp first",
		})
	}

	var req dto.CreateGroupRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(response.ErrorResponse{
			Success: false,
			Message: "Invalid request body",
			Error:   err.Error(),
		})
	}

	// Convert participant phone numbers to JIDs
	var participantJIDs []types.JID
	for _, participant := range req.Participants {
		jid, participantErr := types.ParseJID(participant)
		if participantErr != nil {
			// Try to parse as phone number
			if !strings.Contains(participant, "@") {
				participant = participant + "@s.whatsapp.net"
			}
			var parseErr error
			jid, parseErr = types.ParseJID(participant)
			if parseErr != nil {
				return c.Status(fiber.StatusBadRequest).JSON(response.ErrorResponse{
					Success: false,
					Message: "Invalid participant JID",
					Error:   fmt.Sprintf("Failed to parse JID: %s", participant),
				})
			}
		}
		participantJIDs = append(participantJIDs, jid)
	}

	// Create group
	groupInfo, err := connection.WhatsAppClient.CreateGroup(context.Background(), whatsmeow.ReqCreateGroup{
		Name:         req.Name,
		Participants: participantJIDs,
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(response.ErrorResponse{
			Success: false,
			Message: "Failed to create group",
			Error:   err.Error(),
		})
	}

	// Get invite link
	inviteLink, err := connection.WhatsAppClient.GetGroupInviteLink(context.Background(), groupInfo.JID, false)
	if err != nil {
		log.Printf("Failed to get invite link: %v", err)
		inviteLink = ""
	}

	responseData := dto.CreateGroupResponse{
		GroupJID:   groupInfo.JID.String(),
		InviteCode: inviteLink,
		CreatedAt:  time.Now(),
	}

	return c.Status(fiber.StatusCreated).JSON(response.CreateGroupSuccessResponse{
		Success: true,
		Message: "Group created successfully",
		Data:    responseData,
	})
}

// GetGroups retrieves all joined WhatsApp groups
// @Summary Get WhatsApp groups
// @Description Get list of all joined WhatsApp groups
// @Tags WhatsApp Groups
// @Accept json
// @Produce json
// @Success 200 {object} response.GetGroupsSuccessResponse
// @Failure 503 {object} response.ErrorResponse
// @Router /whatsapp/groups [get]
func (h *Handler) GetGroups(c *fiber.Ctx) error {
	if connection.WhatsAppClient == nil || !connection.WhatsAppClient.IsConnected() {
		return c.Status(fiber.StatusServiceUnavailable).JSON(response.ErrorResponse{
			Success: false,
			Message: "WhatsApp client not connected",
			Error:   "Please connect to WhatsApp first",
		})
	}

	// Get all groups from WhatsApp
	groups, err := connection.WhatsAppClient.GetJoinedGroups(context.Background())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(response.ErrorResponse{
			Success: false,
			Message: "Failed to get groups",
			Error:   err.Error(),
		})
	}

	// Convert to response format
	var groupResponses []dto.GroupInfoResponse
	for _, groupInfo := range groups {
		// Convert participants
		var participants []dto.GroupParticipantResponse
		for _, participant := range groupInfo.Participants {
			role := "member"
			if participant.IsAdmin {
				role = "admin"
			}
			if participant.IsSuperAdmin {
				role = "superadmin"
			}
			participants = append(participants, dto.GroupParticipantResponse{
				JID:      participant.JID.String(),
				Role:     role,
				JoinedAt: time.Now(), // WhatsApp doesn't provide join time
			})
		}

		groupResponse := dto.GroupInfoResponse{
			JID:              groupInfo.JID.String(),
			Name:             groupInfo.Name,
			Description:      &groupInfo.Topic,
			OwnerJID:         groupInfo.OwnerJID.String(),
			Subject:          groupInfo.Name,
			Participants:     participants,
			ParticipantCount: len(participants),
			CreatedAt:        groupInfo.GroupCreated,
			UpdatedAt:        time.Now(),
		}

		groupResponses = append(groupResponses, groupResponse)
	}

	// Simple pagination (for now, return all groups)
	pagination := response.Pagination{
		CurrentPage: 1,
		PerPage:     len(groupResponses),
		Total:       int64(len(groupResponses)),
		TotalPages:  1,
		HasNext:     false,
		HasPrev:     false,
	}

	return c.Status(fiber.StatusOK).JSON(response.GetGroupsSuccessResponse{
		Success:    true,
		Message:    "Groups retrieved successfully",
		Data:       groupResponses,
		Pagination: pagination,
	})
}

// GetGroupInfo retrieves information about a specific group
// @Summary Get group information
// @Description Get detailed information about a specific WhatsApp group
// @Tags WhatsApp Groups
// @Accept json
// @Produce json
// @Param jid path string true "Group JID"
// @Success 200 {object} response.WhatsAppBaseResponse{data=dto.GroupInfoResponse}
// @Failure 400 {object} response.ErrorResponse
// @Failure 503 {object} response.ErrorResponse
// @Router /whatsapp/groups/{jid} [get]
func (h *Handler) GetGroupInfo(c *fiber.Ctx) error {
	// Validate connection
	if connection.WhatsAppClient == nil || !connection.WhatsAppClient.IsConnected() {
		return c.Status(fiber.StatusServiceUnavailable).JSON(response.ErrorResponse{
			Success: false,
			Message: "WhatsApp client not connected",
			Error:   "Please connect to WhatsApp first",
		})
	}

	// Get group JID from URL parameter
	groupJID := c.Params("jid")
	if groupJID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(response.ErrorResponse{
			Success: false,
			Message: "Group JID is required",
			Error:   "Missing group JID parameter",
		})
	}

	// Parse JID
	parsedJID, err := types.ParseJID(groupJID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(response.ErrorResponse{
			Success: false,
			Message: "Invalid group JID format",
			Error:   err.Error(),
		})
	}

	// Get group info from WhatsApp
	groupInfo, err := connection.WhatsAppClient.GetGroupInfo(context.Background(), parsedJID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(response.ErrorResponse{
			Success: false,
			Message: "Failed to get group info",
			Error:   err.Error(),
		})
	}

	// Convert participants
	var participants []dto.GroupParticipantResponse
	for _, participant := range groupInfo.Participants {
		role := "member"
		if participant.IsAdmin {
			role = "admin"
		}
		if participant.IsSuperAdmin {
			role = "superadmin"
		}
		participants = append(participants, dto.GroupParticipantResponse{
			JID:      participant.JID.String(),
			Role:     role,
			JoinedAt: time.Now(), // WhatsApp doesn't provide join time
		})
	}

	// Create response
	groupResponse := dto.GroupInfoResponse{
		JID:              groupInfo.JID.String(),
		Name:             groupInfo.Name,
		Description:      &groupInfo.Topic,
		OwnerJID:         groupInfo.OwnerJID.String(),
		Subject:          groupInfo.Name,
		Participants:     participants,
		ParticipantCount: len(participants),
		CreatedAt:        groupInfo.GroupCreated,
		UpdatedAt:        time.Now(),
	}

	return c.Status(fiber.StatusOK).JSON(response.NewSuccessResponse("Group info retrieved successfully", groupResponse))
}

// JoinGroup joins a WhatsApp group using invite link
// @Summary Join group via invite
// @Description Join a WhatsApp group using an invite code/link
// @Tags WhatsApp Groups
// @Accept json
// @Produce json
// @Param invite body dto.JoinGroupRequest true "Invite code"
// @Success 200 {object} response.WhatsAppBaseResponse{data=dto.GroupInfoResponse}
// @Failure 400 {object} response.ErrorResponse
// @Failure 503 {object} response.ErrorResponse
// @Router /whatsapp/groups/join [post]
func (h *Handler) JoinGroup(c *fiber.Ctx) error {
	// Validate connection
	if connection.WhatsAppClient == nil || !connection.WhatsAppClient.IsConnected() {
		return c.Status(fiber.StatusServiceUnavailable).JSON(response.ErrorResponse{
			Success: false,
			Message: "WhatsApp client not connected",
			Error:   "Please connect to WhatsApp first",
		})
	}

	// Parse request body
	var req dto.JoinGroupRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(response.ErrorResponse{
			Success: false,
			Message: "Invalid request body",
			Error:   err.Error(),
		})
	}

	// Validate invite code
	if req.InviteCode == "" {
		return c.Status(fiber.StatusBadRequest).JSON(response.ErrorResponse{
			Success: false,
			Message: "Invite code is required",
			Error:   "Missing invite code in request",
		})
	}

	// Join group using invite code
	groupJID, err := connection.WhatsAppClient.JoinGroupWithLink(context.Background(), req.InviteCode)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(response.ErrorResponse{
			Success: false,
			Message: "Failed to join group",
			Error:   err.Error(),
		})
	}

	// Get group info after joining
	groupInfo, err := connection.WhatsAppClient.GetGroupInfo(context.Background(), groupJID)
	if err != nil {
		// Still return success even if we can't get group info
		return c.Status(fiber.StatusOK).JSON(response.NewSuccessResponse("Successfully joined group", map[string]interface{}{
			"group_jid": groupJID.String(),
		}))
	}

	// Create response with group info
	groupResponse := dto.GroupInfoResponse{
		JID:              groupInfo.JID.String(),
		Name:             groupInfo.Name,
		Description:      &groupInfo.Topic,
		OwnerJID:         groupInfo.OwnerJID.String(),
		Subject:          groupInfo.Name,
		ParticipantCount: len(groupInfo.Participants),
		CreatedAt:        groupInfo.GroupCreated,
		UpdatedAt:        time.Now(),
	}

	return c.Status(fiber.StatusOK).JSON(response.NewSuccessResponse("Successfully joined group", groupResponse))
}

// LeaveGroup leaves a WhatsApp group
// @Summary Leave group
// @Description Leave a WhatsApp group
// @Tags WhatsApp Groups
// @Accept json
// @Produce json
// @Param jid path string true "Group JID"
// @Success 200 {object} response.WhatsAppBaseResponse
// @Failure 400 {object} response.ErrorResponse
// @Failure 503 {object} response.ErrorResponse
// @Router /whatsapp/groups/{jid}/leave [post]
func (h *Handler) LeaveGroup(c *fiber.Ctx) error {
	// Validate connection
	if connection.WhatsAppClient == nil || !connection.WhatsAppClient.IsConnected() {
		return c.Status(fiber.StatusServiceUnavailable).JSON(response.ErrorResponse{
			Success: false,
			Message: "WhatsApp client not connected",
			Error:   "Please connect to WhatsApp first",
		})
	}

	// Get group JID from URL parameter
	groupJID := c.Params("jid")
	if groupJID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(response.ErrorResponse{
			Success: false,
			Message: "Group JID is required",
			Error:   "Missing group JID parameter",
		})
	}

	// Parse JID
	parsedJID, err := types.ParseJID(groupJID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(response.ErrorResponse{
			Success: false,
			Message: "Invalid group JID format",
			Error:   err.Error(),
		})
	}

	// Leave group
	err = connection.WhatsAppClient.LeaveGroup(context.Background(), parsedJID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(response.ErrorResponse{
			Success: false,
			Message: "Failed to leave group",
			Error:   err.Error(),
		})
	}

	return c.Status(fiber.StatusOK).JSON(response.NewSuccessResponse("Successfully left group", map[string]interface{}{
		"group_jid": groupJID,
	}))
}

// UpdateGroup updates group information (name, description)
// @Summary Update group
// @Description Update WhatsApp group name or description
// @Tags WhatsApp Groups
// @Accept json
// @Produce json
// @Param group body dto.UpdateGroupRequest true "Update data"
// @Success 200 {object} response.WhatsAppBaseResponse{data=dto.GroupInfoResponse}
// @Failure 400 {object} response.ErrorResponse
// @Failure 503 {object} response.ErrorResponse
// @Router /whatsapp/groups [put]
func (h *Handler) UpdateGroup(c *fiber.Ctx) error {
	// Validate connection
	if connection.WhatsAppClient == nil || !connection.WhatsAppClient.IsConnected() {
		return c.Status(fiber.StatusServiceUnavailable).JSON(response.ErrorResponse{
			Success: false,
			Message: "WhatsApp client not connected",
			Error:   "Please connect to WhatsApp first",
		})
	}

	// Parse request body
	var req dto.UpdateGroupRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(response.ErrorResponse{
			Success: false,
			Message: "Invalid request body",
			Error:   err.Error(),
		})
	}

	// Parse group JID
	groupJID, err := types.ParseJID(req.GroupJID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(response.ErrorResponse{
			Success: false,
			Message: "Invalid group JID format",
			Error:   err.Error(),
		})
	}

	// Update group name if provided
	if req.Name != nil {
		err = connection.WhatsAppClient.SetGroupName(context.Background(), groupJID, *req.Name)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(response.ErrorResponse{
				Success: false,
				Message: "Failed to update group name",
				Error:   err.Error(),
			})
		}
	}

	// Update group description if provided
	if req.Description != nil {
		err = connection.WhatsAppClient.SetGroupTopic(context.Background(), groupJID, *req.Description, "", "")
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(response.ErrorResponse{
				Success: false,
				Message: "Failed to update group description",
				Error:   err.Error(),
			})
		}
	}

	// Get updated group info
	groupInfo, err := connection.WhatsAppClient.GetGroupInfo(context.Background(), groupJID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(response.ErrorResponse{
			Success: false,
			Message: "Failed to get updated group info",
			Error:   err.Error(),
		})
	}

	// Convert participants
	var participants []dto.GroupParticipantResponse
	for _, participant := range groupInfo.Participants {
		role := "member"
		if participant.IsAdmin {
			role = "admin"
		}
		if participant.IsSuperAdmin {
			role = "superadmin"
		}
		participants = append(participants, dto.GroupParticipantResponse{
			JID:      participant.JID.String(),
			Role:     role,
			JoinedAt: time.Now(),
		})
	}

	// Create response
	groupResponse := dto.GroupInfoResponse{
		JID:              groupInfo.JID.String(),
		Name:             groupInfo.Name,
		Description:      &groupInfo.Topic,
		OwnerJID:         groupInfo.OwnerJID.String(),
		Subject:          groupInfo.Name,
		Participants:     participants,
		ParticipantCount: len(participants),
		CreatedAt:        groupInfo.GroupCreated,
		UpdatedAt:        time.Now(),
	}

	return c.Status(fiber.StatusOK).JSON(response.NewSuccessResponse("Group updated successfully", groupResponse))
}

// GetSessionGroups retrieves joined groups for a specific session
func (h *Handler) GetSessionGroups(c *fiber.Ctx) error {
	sessionID := c.Params("session_id")
	sessionCode := c.Query("session_code")

	if sessionID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(response.ErrorResponse{
			Success: false,
			Message: "Session ID is required",
		})
	}

	if sessionCode == "" {
		return c.Status(fiber.StatusBadRequest).JSON(response.ErrorResponse{
			Success: false,
			Message: "Session Code is required",
		})
	}

	sessionManager := connection.GetSessionManager(h.DB, h.SqlDB)

	// Validate Session Code
	if err := sessionManager.ValidateSession(sessionID, sessionCode); err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(response.ErrorResponse{
			Success: false,
			Message: "Invalid session code",
			Error:   err.Error(),
		})
	}

	client, err := sessionManager.GetSessionClient(sessionID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(response.ErrorResponse{
			Success: false,
			Message: "Session not connected or invalid",
			Error:   err.Error(),
		})
	}

	groups, err := client.GetJoinedGroups(context.Background())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(response.ErrorResponse{
			Success: false,
			Message: "Failed to get groups",
			Error:   err.Error(),
		})
	}

	var groupResponses []dto.GroupInfoResponse
	for _, groupInfo := range groups {
		groupResponse := dto.GroupInfoResponse{
			JID:              groupInfo.JID.String(),
			Name:             groupInfo.Name,
			Description:      &groupInfo.Topic,
			OwnerJID:         groupInfo.OwnerJID.String(),
			Subject:          groupInfo.Name,
			ParticipantCount: len(groupInfo.Participants),
			CreatedAt:        groupInfo.GroupCreated,
			UpdatedAt:        time.Now(),
		}
		groupResponses = append(groupResponses, groupResponse)
	}

	return c.Status(fiber.StatusOK).JSON(response.NewSuccessResponse("Groups retrieved successfully", groupResponses))
}

// SendGroupBroadcast sends a message to multiple groups
type GroupBroadcastRequest struct {
	SessionID   string   `json:"session_id" form:"session_id"`
	SessionCode string   `json:"session_code" form:"session_code"`
	Message     string   `json:"message" form:"message"`
	Groups      []string `json:"groups" form:"groups"` // Array of Group JIDs
	// Media file handled via form-file
}

func (h *Handler) SendGroupBroadcast(c *fiber.Ctx) error {
	// Parse form data manually or via body parser if JSON
	// Since we support media upload, we likely use multipart/form-data

	sessionID := c.FormValue("session_id")
	sessionCode := c.FormValue("session_code")
	message := c.FormValue("message")
	groupsStr := c.FormValue("groups") // JSON string of group IDs

	if sessionID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(response.ErrorResponse{
			Success: false,
			Message: "Session ID is required",
		})
	}
	if sessionCode == "" {
		return c.Status(fiber.StatusBadRequest).JSON(response.ErrorResponse{
			Success: false,
			Message: "Session Code is required",
		})
	}

	sessionManager := connection.GetSessionManager(h.DB, h.SqlDB)

	// Validate Session Code
	if err := sessionManager.ValidateSession(sessionID, sessionCode); err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(response.ErrorResponse{
			Success: false,
			Message: "Invalid session code",
			Error:   err.Error(),
		})
	}

	client, err := sessionManager.GetSessionClient(sessionID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(response.ErrorResponse{
			Success: false,
			Message: "Session not connected or invalid",
			Error:   err.Error(),
		})
	}

	// Parse groups
	var groupJIDs []string
	// Simple parsing if it's a JSON array string like '["id1", "id2"]'
	// Or handle if it's sent as multiple form values (not typical for array in form-data in some clients)
	// Let's assume JSON string for simplicity as frontend sends JSON.stringify
	if strings.HasPrefix(groupsStr, "[") {
		// Remove brackets and quotes
		trimmed := strings.Trim(groupsStr, "[]")
		parts := strings.Split(trimmed, ",")
		for _, p := range parts {
			clean := strings.Trim(strings.TrimSpace(p), "\"'")
			if clean != "" {
				groupJIDs = append(groupJIDs, clean)
			}
		}
	} else {
		// Single value or comma separated
		parts := strings.Split(groupsStr, ",")
		for _, p := range parts {
			if strings.TrimSpace(p) != "" {
				groupJIDs = append(groupJIDs, strings.TrimSpace(p))
			}
		}
	}

	if len(groupJIDs) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(response.ErrorResponse{
			Success: false,
			Message: "No target groups specified",
		})
	}

	// Handle Media
	file, err := c.FormFile("media")
	var mediaData []byte
	var mimeType string
	hasMedia := err == nil && file != nil
	var uploadResp whatsmeow.UploadResponse

	if hasMedia {
		f, err := file.Open()
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(response.ErrorResponse{Message: "Failed to open media file"})
		}
		defer f.Close()

		buffer := make([]byte, file.Size)
		_, err = f.Read(buffer)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(response.ErrorResponse{Message: "Failed to read media file"})
		}
		mediaData = buffer
		mimeType = file.Header.Get("Content-Type")

		// Upload
		var appInfo whatsmeow.MediaType
		if strings.HasPrefix(mimeType, "image") {
			appInfo = whatsmeow.MediaImage
		} else if strings.HasPrefix(mimeType, "video") {
			appInfo = whatsmeow.MediaVideo
		} else {
			appInfo = whatsmeow.MediaDocument
		}

		uploadResp, err = client.Upload(context.Background(), mediaData, appInfo)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(response.ErrorResponse{Message: "Failed to upload media: " + err.Error()})
		}
	}

	successCount := 0
	failCount := 0

	for _, gid := range groupJIDs {
		jid, err := types.ParseJID(gid)
		if err != nil {
			log.Printf("Invalid group JID %s: %v", gid, err)
			failCount++
			continue
		}

		var msg *waProto.Message

		if hasMedia {
			if strings.HasPrefix(mimeType, "image") {
				msg = &waProto.Message{
					ImageMessage: &waProto.ImageMessage{
						Caption:       proto.String(message),
						URL:           proto.String(uploadResp.URL),
						DirectPath:    proto.String(uploadResp.DirectPath),
						MediaKey:      uploadResp.MediaKey,
						Mimetype:      proto.String(mimeType),
						FileEncSHA256: uploadResp.FileEncSHA256,
						FileSHA256:    uploadResp.FileSHA256,
						FileLength:    proto.Uint64(uint64(len(mediaData))),
					},
				}
			} else if strings.HasPrefix(mimeType, "video") {
				msg = &waProto.Message{
					VideoMessage: &waProto.VideoMessage{
						Caption:       proto.String(message),
						URL:           proto.String(uploadResp.URL),
						DirectPath:    proto.String(uploadResp.DirectPath),
						MediaKey:      uploadResp.MediaKey,
						Mimetype:      proto.String(mimeType),
						FileEncSHA256: uploadResp.FileEncSHA256,
						FileSHA256:    uploadResp.FileSHA256,
						FileLength:    proto.Uint64(uint64(len(mediaData))),
					},
				}
			} else {
				msg = &waProto.Message{
					DocumentMessage: &waProto.DocumentMessage{
						Caption:       proto.String(message),
						URL:           proto.String(uploadResp.URL),
						DirectPath:    proto.String(uploadResp.DirectPath),
						MediaKey:      uploadResp.MediaKey,
						Mimetype:      proto.String(mimeType),
						FileEncSHA256: uploadResp.FileEncSHA256,
						FileSHA256:    uploadResp.FileSHA256,
						FileLength:    proto.Uint64(uint64(len(mediaData))),
						FileName:      proto.String(file.Filename),
					},
				}
			}
		} else {
			msg = &waProto.Message{
				Conversation: proto.String(message),
			}
		}

		_, err = client.SendMessage(context.Background(), jid, msg)
		if err != nil {
			log.Printf("Failed to send to group %s: %v", gid, err)
			failCount++
		} else {
			successCount++
		}

		// Small delay to prevent rate limiting
		time.Sleep(500 * time.Millisecond)
	}

	return c.Status(fiber.StatusOK).JSON(response.NewSuccessResponse("Broadcast completed", map[string]interface{}{
		"success": successCount,
		"failed":  failCount,
	}))
}
