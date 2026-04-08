package message

import (
	"bufio"
	"encoding/json"
	"fmt"
	"loko/server/connection"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// StreamMessages streams real-time WhatsApp messages via Server-Sent Events (SSE)
// @Summary Stream real-time messages
// @Description Get real-time message updates via SSE for a specific session
// @Tags WhatsApp Messages
// @Accept json
// @Produce text/event-stream
// @Param session_id query string true "Session ID"
// @Success 200 {string} string "SSE stream"
// @Failure 400 {object} response.ErrorResponse
// @Router /whatsapp/v1/messages/stream [get]
func (h *Handler) StreamMessages(c *fiber.Ctx) error {
	sessionID := c.Query("session_id")
	if sessionID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "session_id is required",
		})
	}

	// Resolve session ID to actual UUID using session manager
	var actualSessionID string = sessionID
	sessionManager := connection.GetSessionManager(nil, nil)
	if session, err := sessionManager.GetSession(sessionID); err == nil {
		actualSessionID = session.ID.String()
	} else {
		// If not a valid UUID, resolve using authenticated user's sessions
		userID, _ := c.Locals("user_id").(string)
		if userID != "" {
			if sessions, err := sessionManager.GetUserSessions(userID); err == nil && len(sessions) > 0 {
				foundConnected := false
				for i := range sessions {
					if sessions[i].Status == "connected" {
						actualSessionID = sessions[i].ID.String()
						foundConnected = true
						break
					}
				}
				if !foundConnected {
					actualSessionID = sessions[0].ID.String()
				}
			}
		}
	}

	// Validate actual session UUID
	if _, err := uuid.Parse(actualSessionID); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "Invalid session_id format or session not found",
		})
	}

	// session_code is mandatory to prevent cross-session SSE leakage
	sessionCode := c.Query("session_code")
	if sessionCode == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"message": "session_code is required",
		})
	}
	if err := sessionManager.ValidateSession(actualSessionID, sessionCode); err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"success": false,
			"message": "Unauthorized: Invalid session code",
			"error":   err.Error(),
		})
	}

	// Set SSE headers
	c.Set("Content-Type", "text/event-stream")
	c.Set("Cache-Control", "no-cache")
	c.Set("Connection", "keep-alive")
	c.Set("Transfer-Encoding", "chunked")
	c.Set("X-Accel-Buffering", "no") // Disable nginx buffering

	c.Context().SetBodyStreamWriter(func(w *bufio.Writer) { // Changed writer type to *bufio.Writer
		// Get message broadcaster
		broadcaster := connection.GetMessageBroadcaster()

		// Create subscriber channel
		clientChan := broadcaster.Subscribe() // Changed Subscribe interface
		defer broadcaster.Unsubscribe(clientChan)

		// Send initial connection message
		eventData := map[string]interface{}{
			"type":       "connected",
			"session_id": sessionID,
			"timestamp":  time.Now().Format(time.RFC3339),
		}
		if data, err := json.Marshal(eventData); err == nil {
			// SSE format: "data: {...}\n\n"
			fmt.Fprintf(w, "data: %s\n\n", string(data))
			if err := w.Flush(); err != nil {
				return
			}
		}

		// Keep-alive ticker
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()

		for {
			select {
			case message := <-clientChan:
				// Message from broadcaster is already formatted SSE string
				// Just write it directly
				if message != "" {
					fmt.Fprintf(w, "%s", message)
					if err := w.Flush(); err != nil {
						// Client disconnected
						return
					}
				}

			case <-ticker.C:
				// Send keep-alive ping
				fmt.Fprintf(w, ": ping\n\n")
				if err := w.Flush(); err != nil {
					// Client disconnected
					return
				}
			}
		}
	})

	return nil
}
