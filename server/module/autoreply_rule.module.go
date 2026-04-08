package module

import (
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"loko/server/connection"
	"loko/server/middleware"
	"loko/server/model"
	"loko/server/util"

	"gorm.io/gorm"
)

// AutoReplyRule module
type AutoReplyRule struct{}

// Route registers auto-reply rule routes
func (m AutoReplyRule) Route(api fiber.Router) {
	handler := AutoReplyRuleHandler{}

	routes := api.Group("/auto-reply-rules", middleware.UseAuth)

	routes.Get("/", handler.List)
	routes.Get("/:id", handler.Get)
	routes.Post("/", handler.Create)
	routes.Put("/:id", handler.Update)
	routes.Delete("/:id", handler.Delete)
	routes.Post("/test", handler.TestPattern)
	routes.Post("/reorder", handler.Reorder)
	routes.Get("/stats", handler.Stats)
}

// AutoReplyRuleHandler handles auto-reply rule requests
type AutoReplyRuleHandler struct{}

// List returns all auto-reply rules for the user
func (h AutoReplyRuleHandler) List(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	sessionID := c.Query("session_id")
	sessionCode := c.Query("session_code")

	db, err := autoReplyDBConnect()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Database connection failed"})
	}

	if sessionID != "" {
		if sessionCode == "" {
			return c.Status(400).JSON(fiber.Map{"error": "session_code is required for session validation"})
		}
		sessionManager := connection.GetSessionManager(db, nil)
		if err := sessionManager.ValidateSession(sessionID, sessionCode); err != nil {
			return c.Status(401).JSON(fiber.Map{"error": "Unauthorized: Invalid session code"})
		}
	}

	var rules []model.AutoReplyRule
	query := db.Model(&model.AutoReplyRule{}).Where("user_id = ?", userID)

	if sessionID != "" {
		query = query.Where("whatsapp_session_id = ?", sessionID)
	}

	if err := query.Order("priority ASC").Find(&rules).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to fetch rules"})
	}

	return c.JSON(fiber.Map{"data": rules})
}

// Get returns a single auto-reply rule
func (h AutoReplyRuleHandler) Get(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	ruleID := c.Params("id")

	db, err := autoReplyDBConnect()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Database connection failed"})
	}

	var rule model.AutoReplyRule
	if err := db.Where("id = ? AND user_id = ?", ruleID, userID).First(&rule).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Rule not found"})
	}

	return c.JSON(fiber.Map{"data": rule})
}

// CreateRequest represents the create rule request
type CreateRuleRequest struct {
	SessionID      string  `json:"session_id"`
	Name           string  `json:"name"`
	Description    string  `json:"description"`
	MatchType      string  `json:"match_type"`
	Pattern        string  `json:"pattern"`
	ResponseType   string  `json:"response_type"`
	Response       string  `json:"response"`
	Instruction    string  `json:"instruction"`
	AIConfigSource string  `json:"ai_config_source"`
	AIModel        string  `json:"ai_model"`
	AITemperature  float64 `json:"ai_temperature"`
	AIMaxTokens    int     `json:"ai_max_tokens"`
	Priority       int     `json:"priority"`
	StopOnMatch    bool    `json:"stop_on_match"`
}

// Create creates a new auto-reply rule
func (h AutoReplyRuleHandler) Create(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)

	var req CreateRuleRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	// Validate required fields
	if req.SessionID == "" || req.Name == "" || req.Pattern == "" {
		return c.Status(400).JSON(fiber.Map{"error": "session_id, name, and pattern are required"})
	}

	// Validate pattern
	matcher := util.NewPatternMatcher()
	if err := matcher.ValidatePattern(req.Pattern, req.MatchType); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}

	// Parse session ID
	sessionUUID, err := uuid.Parse(req.SessionID)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid session_id"})
	}

	db, err := autoReplyDBConnect()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Database connection failed"})
	}

	// Set defaults
	if req.MatchType == "" {
		req.MatchType = "contains"
	}
	if req.ResponseType == "" {
		req.ResponseType = "static"
	}
	if req.AIConfigSource == "" {
		req.AIConfigSource = "inherit"
	}
	if req.Priority == 0 {
		req.Priority = 100
	}

	rule := model.AutoReplyRule{
		WhatsAppSessionID: sessionUUID,
		UserID:            userID,
		Name:           req.Name,
		Description:    req.Description,
		MatchType:      model.MatchType(req.MatchType),
		Pattern:        req.Pattern,
		ResponseType:   model.ResponseType(req.ResponseType),
		Response:       req.Response,
		Instruction:    req.Instruction,
		AIConfigSource: model.AIConfigSource(req.AIConfigSource),
		AIModel:        req.AIModel,
		AITemperature:  req.AITemperature,
		AIMaxTokens:    req.AIMaxTokens,
		Priority:       req.Priority,
		StopOnMatch:    req.StopOnMatch,
		IsActive:       true,
	}

	if err := db.Create(&rule).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create rule"})
	}

	return c.JSON(fiber.Map{"data": rule, "message": "Rule created successfully"})
}

// UpdateRequest represents the update rule request
type UpdateRuleRequest struct {
	Name           *string  `json:"name"`
	Description    *string  `json:"description"`
	MatchType      *string  `json:"match_type"`
	Pattern        *string  `json:"pattern"`
	ResponseType   *string  `json:"response_type"`
	Response       *string  `json:"response"`
	Instruction    *string  `json:"instruction"`
	AIConfigSource *string  `json:"ai_config_source"`
	AIModel        *string  `json:"ai_model"`
	AITemperature  *float64 `json:"ai_temperature"`
	AIMaxTokens    *int     `json:"ai_max_tokens"`
	Priority       *int     `json:"priority"`
	IsActive       *bool    `json:"is_active"`
	StopOnMatch    *bool    `json:"stop_on_match"`
}

// Update updates an existing auto-reply rule
func (h AutoReplyRuleHandler) Update(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	ruleID := c.Params("id")

	var req UpdateRuleRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	db, err := autoReplyDBConnect()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Database connection failed"})
	}

	var rule model.AutoReplyRule
	if err := db.Where("id = ? AND user_id = ?", ruleID, userID).First(&rule).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Rule not found"})
	}

	// Update fields
	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.MatchType != nil {
		updates["match_type"] = *req.MatchType
	}
	if req.Pattern != nil {
		// Validate pattern
		matcher := util.NewPatternMatcher()
		matchType := string(rule.MatchType)
		if req.MatchType != nil {
			matchType = *req.MatchType
		}
		if err := matcher.ValidatePattern(*req.Pattern, matchType); err != nil {
			return c.Status(400).JSON(fiber.Map{"error": err.Error()})
		}
		updates["pattern"] = *req.Pattern
	}
	if req.ResponseType != nil {
		updates["response_type"] = *req.ResponseType
	}
	if req.Response != nil {
		updates["response"] = *req.Response
	}
	if req.Instruction != nil {
		updates["instruction"] = *req.Instruction
	}
	if req.AIConfigSource != nil {
		updates["ai_config_source"] = *req.AIConfigSource
	}
	if req.AIModel != nil {
		updates["ai_model"] = *req.AIModel
	}
	if req.AITemperature != nil {
		updates["ai_temperature"] = *req.AITemperature
	}
	if req.AIMaxTokens != nil {
		updates["ai_max_tokens"] = *req.AIMaxTokens
	}
	if req.Priority != nil {
		updates["priority"] = *req.Priority
	}
	if req.IsActive != nil {
		updates["is_active"] = *req.IsActive
	}
	if req.StopOnMatch != nil {
		updates["stop_on_match"] = *req.StopOnMatch
	}

	if len(updates) > 0 {
		if err := db.Model(&rule).Updates(updates).Error; err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to update rule"})
		}
	}

	return c.JSON(fiber.Map{"data": rule, "message": "Rule updated successfully"})
}

// Delete deletes an auto-reply rule
func (h AutoReplyRuleHandler) Delete(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	ruleID := c.Params("id")

	db, err := autoReplyDBConnect()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Database connection failed"})
	}

	result := db.Where("id = ? AND user_id = ?", ruleID, userID).Delete(&model.AutoReplyRule{})
	if result.Error != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to delete rule"})
	}
	if result.RowsAffected == 0 {
		return c.Status(404).JSON(fiber.Map{"error": "Rule not found"})
	}

	return c.JSON(fiber.Map{"message": "Rule deleted successfully"})
}

// TestPatternRequest represents the test pattern request
type TestPatternRequest struct {
	MatchType string `json:"match_type"`
	Pattern   string `json:"pattern"`
	Message   string `json:"message"`
}

// TestPattern tests a pattern against a message
func (h AutoReplyRuleHandler) TestPattern(c *fiber.Ctx) error {
	var req TestPatternRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	matcher := util.NewPatternMatcher()
	result := matcher.Match(req.Message, req.Pattern, req.MatchType)

	return c.JSON(fiber.Map{
		"matched":    result.Matched,
		"captures":   result.Captures,
		"confidence": result.Confidence,
		"error":      result.Error,
	})
}

// ReorderRequest represents the reorder request
type ReorderRequest struct {
	RuleIDs []string `json:"rule_ids"`
}

// Reorder reorders rules by priority
func (h AutoReplyRuleHandler) Reorder(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)

	var req ReorderRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	db, err := autoReplyDBConnect()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Database connection failed"})
	}

	// Update priorities based on order
	for i, ruleID := range req.RuleIDs {
		if err := db.Model(&model.AutoReplyRule{}).
			Where("id = ? AND user_id = ?", ruleID, userID).
			Update("priority", i+1).Error; err != nil {
			continue // Skip if rule not found
		}
	}

	return c.JSON(fiber.Map{"message": "Rules reordered successfully"})
}

// Stats returns auto-reply rule statistics
func (h AutoReplyRuleHandler) Stats(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	sessionID := c.Query("session_id")

	db, err := autoReplyDBConnect()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Database connection failed"})
	}

	query := db.Model(&model.AutoReplyRule{}).Where("user_id = ?", userID)
	if sessionID != "" {
		query = query.Where("whatsapp_session_id = ?", sessionID)
	}

	var stats model.AutoReplyRuleStats

	// Total rules
	query.Count(&stats.TotalRules)

	// Active rules
	db.Model(&model.AutoReplyRule{}).
		Where("user_id = ? AND is_active = ?", userID, true).
		Count(&stats.ActiveRules)

	// Total matches
	db.Model(&model.AutoReplyRule{}).
		Where("user_id = ?", userID).
		Select("COALESCE(SUM(match_count), 0)").
		Scan(&stats.TotalMatches)

	// Today matches
	today := time.Now().Format("2006-01-02")
	db.Model(&model.AutoReplyRule{}).
		Where("user_id = ? AND DATE(last_matched) = ?", userID, today).
		Select("COUNT(*)").
		Scan(&stats.TodayMatches)

	return c.JSON(fiber.Map{"data": stats})
}

// autoReplyDBConnect helper
func autoReplyDBConnect() (*gorm.DB, error) {
	sql := connection.SQL{}
	return sql.Connect()
}
