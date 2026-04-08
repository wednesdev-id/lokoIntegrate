package group

import (
	"context"
	"fmt"
	"loko/server/connection"
	"loko/server/dto"
	"loko/server/response"
	"strings"

	"github.com/gofiber/fiber/v2"
	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/types"
)

// AddParticipants adds participants to a WhatsApp group
// @Summary Add group participants
// @Description Add new participants to a WhatsApp group
// @Tags WhatsApp Groups
// @Accept json
// @Produce json
// @Param request body dto.AddParticipantsRequest true "Add participants request"
// @Success 200 {object} response.WhatsAppBaseResponse
// @Failure 400 {object} response.ErrorResponse
// @Failure 503 {object} response.ErrorResponse
// @Router /whatsapp/groups/participants/add [post]
func (h *Handler) AddParticipants(c *fiber.Ctx) error {
	// Validate connection
	if connection.WhatsAppClient == nil || !connection.WhatsAppClient.IsConnected() {
		return c.Status(fiber.StatusServiceUnavailable).JSON(response.ErrorResponse{
			Success: false,
			Message: "WhatsApp client not connected",
			Error:   "Please connect to WhatsApp first",
		})
	}

	// Parse request body
	var req dto.AddParticipantsRequest
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

	// Add participants to group
	_, err = connection.WhatsAppClient.UpdateGroupParticipants(context.Background(), groupJID, participantJIDs, whatsmeow.ParticipantChangeAdd)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(response.ErrorResponse{
			Success: false,
			Message: "Failed to add participants",
			Error:   err.Error(),
		})
	}

	return c.Status(fiber.StatusOK).JSON(response.NewSuccessResponse("Participants added successfully", map[string]interface{}{
		"group_jid":    req.GroupJID,
		"participants": req.Participants,
		"total_added":  len(req.Participants),
	}))
}

// RemoveParticipants removes participants from a WhatsApp group
// @Summary Remove group participants
// @Description Remove participants from a WhatsApp group
// @Tags WhatsApp Groups
// @Accept json
// @Produce json
// @Param request body dto.RemoveParticipantsRequest true "Remove participants request"
// @Success 200 {object} response.WhatsAppBaseResponse
// @Failure 400 {object} response.ErrorResponse
// @Failure 503 {object} response.ErrorResponse
// @Router /whatsapp/groups/participants/remove [post]
func (h *Handler) RemoveParticipants(c *fiber.Ctx) error {
	// Validate connection
	if connection.WhatsAppClient == nil || !connection.WhatsAppClient.IsConnected() {
		return c.Status(fiber.StatusServiceUnavailable).JSON(response.ErrorResponse{
			Success: false,
			Message: "WhatsApp client not connected",
			Error:   "Please connect to WhatsApp first",
		})
	}

	// Parse request body
	var req dto.RemoveParticipantsRequest
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

	// Convert participant phone numbers to JIDs
	var participantJIDs []types.JID
	for _, participant := range req.Participants {
		jid, parseErr := types.ParseJID(participant)
		if parseErr != nil {
			// Try to parse as phone number
			if !strings.Contains(participant, "@") {
				participant = participant + "@s.whatsapp.net"
			}
			var retryErr error
			jid, retryErr = types.ParseJID(participant)
			if retryErr != nil {
				return c.Status(fiber.StatusBadRequest).JSON(response.ErrorResponse{
					Success: false,
					Message: "Invalid participant JID",
					Error:   fmt.Sprintf("Failed to parse JID: %s", participant),
				})
			}
		}
		participantJIDs = append(participantJIDs, jid)
	}

	// Remove participants from group
	_, err = connection.WhatsAppClient.UpdateGroupParticipants(context.Background(), groupJID, participantJIDs, whatsmeow.ParticipantChangeRemove)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(response.ErrorResponse{
			Success: false,
			Message: "Failed to remove participants",
			Error:   err.Error(),
		})
	}

	return c.Status(fiber.StatusOK).JSON(response.NewSuccessResponse("Participants removed successfully", map[string]interface{}{
		"group_jid":     req.GroupJID,
		"participants":  req.Participants,
		"total_removed": len(req.Participants),
	}))
}
