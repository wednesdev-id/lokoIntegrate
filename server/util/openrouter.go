package util

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"
)

// OpenRouterRequest is the payload for OpenRouter chat completions
type OpenRouterRequest struct {
	Model    string    `json:"model"`
	Messages []Message `json:"messages"`
}

// Message struct for OpenRouter conversation array
type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// OpenRouterResponse represents the expected response from the OpenRouter API
type OpenRouterResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
}

// AIRequestLog represents structured log for AI requests
type AIRequestLog struct {
	Timestamp   string        `json:"timestamp"`
	Type        string        `json:"type"`
	Model       string        `json:"model"`
	APIKey      string        `json:"api_key"`      // Masked for security
	SystemPrompt string       `json:"system_prompt"`
	Messages    []Message     `json:"messages"`
}

// AIResponseLog represents structured log for AI responses
type AIResponseLog struct {
	Timestamp     string `json:"timestamp"`
	Type          string `json:"type"`
	Model         string `json:"model"`
	StatusCode    int    `json:"status_code"`
	DurationMs    int64  `json:"duration_ms"`
	Content       string `json:"content,omitempty"`
	Error         string `json:"error,omitempty"`
	RawResponse   string `json:"raw_response,omitempty"`
}

// maskAPIKey masks an API key for logging (shows first 8 and last 4 chars)
func maskAPIKey(apiKey string) string {
	if len(apiKey) <= 12 {
		return "***masked***"
	}
	return apiKey[:8] + "..." + apiKey[len(apiKey)-4:]
}

// GenerateAIReply calls OpenRouter to generate a response based on a prompt and an incoming message
func GenerateAIReply(apiKey, systemPrompt, userMessage, model string) (string, error) {
	if apiKey == "" {
		return "", fmt.Errorf("OpenRouter API key is missing")
	}

	url := "https://openrouter.ai/api/v1/chat/completions"

	if model == "" {
		model = "google/gemini-2.5-flash" // Default fallback
	}

	reqBody := OpenRouterRequest{
		Model: model,
		Messages: []Message{
			{
				Role:    "system",
				Content: systemPrompt,
			},
			{
				Role:    "user",
				Content: userMessage,
			},
		},
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return "", err
	}

	// === LOG AI REQUEST ===
	requestLog := AIRequestLog{
		Timestamp:     time.Now().Format(time.RFC3339),
		Type:          "ai_request",
		Model:         model,
		APIKey:        maskAPIKey(apiKey),
		SystemPrompt:  systemPrompt,
		Messages:      reqBody.Messages,
	}
	if logJSON, err := json.MarshalIndent(requestLog, "", "  "); err == nil {
		log.Printf("🤖 ═════════════════════════════════════════════════════════════")
		log.Printf("🤖 AI REQUEST:\n%s", string(logJSON))
		log.Printf("🤖 ═════════════════════════════════════════════════════════════")
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return "", err
	}

	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")
	// Optional but recommended for OpenRouter
	req.Header.Set("HTTP-Referer", "http://localhost:3000") // Change for production
	req.Header.Set("X-Title", "Loko AI Auto Reply")

	startTime := time.Now()
	client := &http.Client{}
	resp, err := client.Do(req)
	duration := time.Since(startTime)

	if err != nil {
		// === LOG AI ERROR ===
		errorLog := AIResponseLog{
			Timestamp:  time.Now().Format(time.RFC3339),
			Type:       "ai_response_error",
			Model:      model,
			StatusCode: 0,
			DurationMs: duration.Milliseconds(),
			Error:      err.Error(),
		}
		if logJSON, marshalErr := json.MarshalIndent(errorLog, "", "  "); marshalErr == nil {
			log.Printf("🤖 ═════════════════════════════════════════════════════════════")
			log.Printf("🤖 AI RESPONSE ERROR:\n%s", string(logJSON))
			log.Printf("🤖 ═════════════════════════════════════════════════════════════")
		}
		return "", err
	}
	defer resp.Body.Close()

	bodyBytes, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK {
		// === LOG AI ERROR RESPONSE ===
		errorLog := AIResponseLog{
			Timestamp:   time.Now().Format(time.RFC3339),
			Type:        "ai_response_error",
			Model:       model,
			StatusCode:  resp.StatusCode,
			DurationMs:  duration.Milliseconds(),
			Error:       fmt.Sprintf("OpenRouter returned status %d", resp.StatusCode),
			RawResponse: string(bodyBytes),
		}
		if logJSON, err := json.MarshalIndent(errorLog, "", "  "); err == nil {
			log.Printf("🤖 ═════════════════════════════════════════════════════════════")
			log.Printf("🤖 AI RESPONSE ERROR:\n%s", string(logJSON))
			log.Printf("🤖 ═════════════════════════════════════════════════════════════")
		}
		return "", fmt.Errorf("OpenRouter returned status %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var orResp OpenRouterResponse
	if err := json.Unmarshal(bodyBytes, &orResp); err != nil {
		return "", err
	}

	if len(orResp.Choices) > 0 {
		content := orResp.Choices[0].Message.Content

		// === LOG AI SUCCESS RESPONSE ===
		successLog := AIResponseLog{
			Timestamp:   time.Now().Format(time.RFC3339),
			Type:        "ai_response_success",
			Model:       model,
			StatusCode:  resp.StatusCode,
			DurationMs:  duration.Milliseconds(),
			Content:     content,
			RawResponse: string(bodyBytes),
		}
		if logJSON, err := json.MarshalIndent(successLog, "", "  "); err == nil {
			log.Printf("🤖 ═════════════════════════════════════════════════════════════")
			log.Printf("🤖 AI RESPONSE SUCCESS:\n%s", string(logJSON))
			log.Printf("🤖 ═════════════════════════════════════════════════════════════")
		}

		return content, nil
	}

	log.Printf("OpenRouter returned empty choices array")
	return "", fmt.Errorf("no reply generated")
}

// AIIntentRequestLog represents structured log for AI intent check requests
type AIIntentRequestLog struct {
	Timestamp        string `json:"timestamp"`
	Type             string `json:"type"`
	Model            string `json:"model"`
	APIKey           string `json:"api_key"`
	Message          string `json:"message"`
	IntentDescription string `json:"intent_description"`
}

// AIIntentResponseLog represents structured log for AI intent check responses
type AIIntentResponseLog struct {
	Timestamp   string  `json:"timestamp"`
	Type        string  `json:"type"`
	Model       string  `json:"model"`
	StatusCode  int     `json:"status_code"`
	DurationMs  int64   `json:"duration_ms"`
	Matched     bool    `json:"matched"`
	Confidence  float64 `json:"confidence"`
	Content     string  `json:"content,omitempty"`
	Error       string  `json:"error,omitempty"`
}

// CheckAIIntent uses AI to determine if a message matches a specific intent
func CheckAIIntent(apiKey, message, intentDescription, model string) (bool, float64, error) {
	if apiKey == "" {
		return false, 0, fmt.Errorf("OpenRouter API key is missing")
	}

	url := "https://openrouter.ai/api/v1/chat/completions"

	if model == "" {
		model = "google/gemini-2.5-flash"
	}

	systemPrompt := `You are an intent classifier. Your job is to determine if a user message matches a specific intent.
Respond with ONLY a JSON object in this format: {"matched": true/false, "confidence": 0.0-1.0}
Do not include any other text or explanation.`

	userPrompt := fmt.Sprintf(`Message: "%s"
Intent to match: "%s"
Does this message match the intent? Respond with JSON only.`, message, intentDescription)

	reqBody := OpenRouterRequest{
		Model: model,
		Messages: []Message{
			{
				Role:    "system",
				Content: systemPrompt,
			},
			{
				Role:    "user",
				Content: userPrompt,
			},
		},
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return false, 0, err
	}

	// === LOG AI INTENT REQUEST ===
	requestLog := AIIntentRequestLog{
		Timestamp:         time.Now().Format(time.RFC3339),
		Type:              "ai_intent_request",
		Model:             model,
		APIKey:            maskAPIKey(apiKey),
		Message:           message,
		IntentDescription: intentDescription,
	}
	if logJSON, err := json.MarshalIndent(requestLog, "", "  "); err == nil {
		log.Printf("🎯 ═════════════════════════════════════════════════════════════")
		log.Printf("🎯 AI INTENT REQUEST:\n%s", string(logJSON))
		log.Printf("🎯 ═════════════════════════════════════════════════════════════")
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return false, 0, err
	}

	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("HTTP-Referer", "http://localhost:3000")
	req.Header.Set("X-Title", "Loko AI Intent Check")

	startTime := time.Now()
	client := &http.Client{}
	resp, err := client.Do(req)
	duration := time.Since(startTime)

	if err != nil {
		// === LOG AI INTENT ERROR ===
		errorLog := AIIntentResponseLog{
			Timestamp:  time.Now().Format(time.RFC3339),
			Type:       "ai_intent_response_error",
			Model:      model,
			StatusCode: 0,
			DurationMs: duration.Milliseconds(),
			Error:      err.Error(),
		}
		if logJSON, marshalErr := json.MarshalIndent(errorLog, "", "  "); marshalErr == nil {
			log.Printf("🎯 ═════════════════════════════════════════════════════════════")
			log.Printf("🎯 AI INTENT RESPONSE ERROR:\n%s", string(logJSON))
			log.Printf("🎯 ═════════════════════════════════════════════════════════════")
		}
		return false, 0, err
	}
	defer resp.Body.Close()

	bodyBytes, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK {
		// === LOG AI INTENT ERROR RESPONSE ===
		errorLog := AIIntentResponseLog{
			Timestamp:  time.Now().Format(time.RFC3339),
			Type:       "ai_intent_response_error",
			Model:      model,
			StatusCode: resp.StatusCode,
			DurationMs: duration.Milliseconds(),
			Error:      fmt.Sprintf("OpenRouter returned status %d", resp.StatusCode),
			Content:    string(bodyBytes),
		}
		if logJSON, err := json.MarshalIndent(errorLog, "", "  "); err == nil {
			log.Printf("🎯 ═════════════════════════════════════════════════════════════")
			log.Printf("🎯 AI INTENT RESPONSE ERROR:\n%s", string(logJSON))
			log.Printf("🎯 ═════════════════════════════════════════════════════════════")
		}
		return false, 0, fmt.Errorf("OpenRouter returned status %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var orResp OpenRouterResponse
	if err := json.Unmarshal(bodyBytes, &orResp); err != nil {
		return false, 0, err
	}

	if len(orResp.Choices) > 0 {
		content := strings.TrimSpace(orResp.Choices[0].Message.Content)
		// Parse JSON response
		var result struct {
			Matched    bool    `json:"matched"`
			Confidence float64 `json:"confidence"`
		}
		if err := json.Unmarshal([]byte(content), &result); err != nil {
			log.Printf("Failed to parse AI intent response: %s", content)
			return false, 0, fmt.Errorf("failed to parse AI response: %w", err)
		}

		// === LOG AI INTENT SUCCESS RESPONSE ===
		successLog := AIIntentResponseLog{
			Timestamp:  time.Now().Format(time.RFC3339),
			Type:       "ai_intent_response_success",
			Model:      model,
			StatusCode: resp.StatusCode,
			DurationMs: duration.Milliseconds(),
			Matched:    result.Matched,
			Confidence: result.Confidence,
			Content:    content,
		}
		if logJSON, err := json.MarshalIndent(successLog, "", "  "); err == nil {
			log.Printf("🎯 ═════════════════════════════════════════════════════════════")
			log.Printf("🎯 AI INTENT RESPONSE SUCCESS:\n%s", string(logJSON))
			log.Printf("🎯 ═════════════════════════════════════════════════════════════")
		}

		return result.Matched, result.Confidence, nil
	}

	return false, 0, fmt.Errorf("no response from AI")
}

// ExtractProductKeyword uses AI to extract the product name a user is looking for
func ExtractProductKeyword(apiKey, message, model string) (string, error) {
	if apiKey == "" {
		return "", fmt.Errorf("OpenRouter API key is missing")
	}

	url := "https://openrouter.ai/api/v1/chat/completions"

	if model == "" {
		model = "google/gemini-2.5-flash"
	}

	systemPrompt := `You are an information extraction assistant. 
The user is asking about product stock, pricing, or catalog.
Extract the specific product name they are asking about. 
If they mention a specific item like "kemeja flanel", respond ONLY with: {"keyword": "kemeja flanel"}
If they are just asking generally like "lihat produk" or "apa saja yang dijual?", respond ONLY with: {"keyword": ""}
Respond with ONLY a JSON object in this format: {"keyword": "xxx"}. Do not include any other text or explanation.`

	reqBody := OpenRouterRequest{
		Model: model,
		Messages: []Message{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: message},
		},
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return "", err
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return "", err
	}

	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("HTTP-Referer", "http://localhost:3000")
	req.Header.Set("X-Title", "Loko AI Keyword Extraction")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	bodyBytes, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("OpenRouter returned status %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var orResp OpenRouterResponse
	if err := json.Unmarshal(bodyBytes, &orResp); err != nil {
		return "", err
	}

	if len(orResp.Choices) > 0 {
		content := strings.TrimSpace(orResp.Choices[0].Message.Content)
		// Clean up markdown code blocks if the AI returns them
		content = strings.TrimPrefix(content, "```json")
		content = strings.TrimPrefix(content, "```")
		content = strings.TrimSuffix(content, "```")
		content = strings.TrimSpace(content)

		var result struct {
			Keyword string `json:"keyword"`
		}
		if err := json.Unmarshal([]byte(content), &result); err != nil {
			log.Printf("Failed to parse AI keyword response: %s", content)
			// Fallback: just return the content as string if it isn't JSON
			return content, nil
		}

		return result.Keyword, nil
	}

	return "", fmt.Errorf("no response from AI")
}
