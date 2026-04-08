package util

import (
	"errors"
	"regexp"
	"strings"
)

// Errors
var (
	ErrEmptyPattern     = errors.New("pattern cannot be empty")
	ErrInvalidRegex     = errors.New("invalid regex pattern")
	ErrUnknownMatchType = errors.New("unknown match type")
)

// MatchResult contains the result of a pattern match
type MatchResult struct {
	Matched    bool
	Captures   []string // For regex captures
	Confidence float64  // For AI matches (0-1)
	Error      string   // Error message if any
}

// PatternMatcher handles different matching types
type PatternMatcher struct{}

// NewPatternMatcher creates a new pattern matcher
func NewPatternMatcher() *PatternMatcher {
	return &PatternMatcher{}
}

// Match performs pattern matching based on match type
func (pm *PatternMatcher) Match(message, pattern, matchType string) MatchResult {
	switch strings.ToLower(matchType) {
	case "exact":
		return pm.ExactMatch(message, pattern)
	case "contains":
		return pm.ContainsMatch(message, pattern)
	case "regex":
		return pm.RegexMatch(message, pattern)
	case "ai":
		return MatchResult{Matched: false}
	default:
		return MatchResult{Matched: false, Error: "unknown match type: " + matchType}
	}
}

// ExactMatch checks if the message exactly matches the pattern (case-insensitive)
func (pm *PatternMatcher) ExactMatch(message, pattern string) MatchResult {
	trimmedMessage := strings.TrimSpace(message)
	trimmedPattern := strings.TrimSpace(pattern)
	matched := strings.EqualFold(trimmedMessage, trimmedPattern)
	return MatchResult{Matched: matched, Confidence: 1.0}
}

// ContainsMatch checks if the message contains the pattern (case-insensitive)
func (pm *PatternMatcher) ContainsMatch(message, pattern string) MatchResult {
	lowerMessage := strings.ToLower(message)
	lowerPattern := strings.ToLower(pattern)
	matched := strings.Contains(lowerMessage, lowerPattern)
	confidence := 0.0
	if matched {
		confidence = 1.0
	}
	return MatchResult{Matched: matched, Confidence: confidence}
}

// RegexMatch checks if the message matches the regex pattern
func (pm *PatternMatcher) RegexMatch(message, pattern string) MatchResult {
	re, err := regexp.Compile(pattern)
	if err != nil {
		return MatchResult{Matched: false, Error: "invalid regex: " + err.Error()}
	}
	matches := re.FindStringSubmatch(message)
	if len(matches) > 0 {
		return MatchResult{Matched: true, Captures: matches[1:], Confidence: 1.0}
	}
	return MatchResult{Matched: false}
}

// ValidatePattern validates a pattern based on its type
func (pm *PatternMatcher) ValidatePattern(pattern, matchType string) error {
	switch strings.ToLower(matchType) {
	case "exact", "contains":
		if strings.TrimSpace(pattern) == "" {
			return ErrEmptyPattern
		}
		return nil
	case "regex":
		_, err := regexp.Compile(pattern)
		if err != nil {
			return ErrInvalidRegex
		}
		return nil
	case "ai":
		return nil
	default:
		return ErrUnknownMatchType
	}
}

// PatternConfig holds pattern configuration for batch matching
type PatternConfig struct {
	Pattern   string
	MatchType string
	Priority  int
}
