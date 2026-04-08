package middleware

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
)

var (
	logFile *os.File
	mu      sync.Mutex
)

// LogEntry structured log entry for API requests and responses
type LogEntry struct {
	Timestamp    string `json:"timestamp"`
	RequestID    string `json:"request_id"`
	ClientIP     string `json:"client_ip"`
	Method       string `json:"method"`
	Path         string `json:"path"`
	UserAgent    string `json:"user_agent"`
	StatusCode   int    `json:"status"`
	Latency      string `json:"latency"`
	ReqBody      string `json:"request_body,omitempty"`
	ResBody      string `json:"response_body,omitempty"`
	ErrorMessage string `json:"error_message,omitempty"`
}

func initLogFile() {
	mu.Lock()
	defer mu.Unlock()

	logDir := "./logs"
	if err := os.MkdirAll(logDir, 0755); err != nil {
		log.Printf("Failed to create log directory: %v", err)
		return
	}

	logPath := filepath.Join(logDir, "api_requests.log")
	file, err := os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
	if err != nil {
		log.Printf("Failed to open log file %s: %v", logPath, err)
		return
	}
	logFile = file
}

func truncateBody(body []byte, limit int) string {
	if len(body) == 0 {
		return ""
	}
	if len(body) > limit {
		return string(body[:limit]) + "... (truncated)"
	}
	// Try to compact JSON if possible
	var j map[string]interface{}
	if err := json.Unmarshal(body, &j); err == nil {
		compact, err := json.Marshal(j)
		if err == nil {
			return string(compact)
		}
	}
	return string(body)
}

// APILogger logs detailed request and response information
func APILogger() fiber.Handler {
	initLogFile()

	return func(c *fiber.Ctx) error {
		// Skip logging for static assets and specific endpoints
		path := c.Path()
		if strings.HasPrefix(path, "/static/") ||
			strings.HasPrefix(path, "/swagger/") ||
			strings.HasSuffix(path, "/stream") || // SSE endpoints
			path == "/favicon.ico" {
			return c.Next()
		}

		start := time.Now()

		// Capture request body (up to 2KB)
		reqBody := truncateBody(c.Body(), 2048)

		// Create RequestID if not exists
		reqID := c.Get("X-Request-Id")
		if reqID == "" {
			reqID = c.GetRespHeader("X-Request-Id") // Some middleware sets it in response first
		}

		// Proceed to next middleware/handler
		err := c.Next()

		latency := time.Since(start)
		statusCode := c.Response().StatusCode()
		
		if err != nil && statusCode == 200 {
			// Fiber error handling mechanism fallback
			statusCode = 500
			if e, ok := err.(*fiber.Error); ok {
				statusCode = e.Code
			}
		}

		// Capture response body (up to 2KB)
		resBody := truncateBody(c.Response().Body(), 2048)

		logEntry := LogEntry{
			Timestamp:  time.Now().Format(time.RFC3339),
			RequestID:  reqID,
			ClientIP:   c.IP(),
			Method:     c.Method(),
			Path:       path,
			UserAgent:  c.Get("User-Agent"),
			StatusCode: statusCode,
			Latency:    fmt.Sprintf("%v", latency),
			ReqBody:    reqBody,
			ResBody:    resBody,
		}

		if err != nil {
			logEntry.ErrorMessage = err.Error()
		}

		logBytes, marshalErr := json.Marshal(logEntry)
		if marshalErr == nil {
			logLine := string(logBytes)
			// Print to stdout
			fmt.Println(logLine)

			// Write to file buffer
			if logFile != nil {
				mu.Lock()
				logFile.WriteString(logLine + "\n")
				mu.Unlock()
			}
		}

		return err
	}
}
