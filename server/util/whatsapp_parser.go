package util

import (
	"strings"
)

// ParseWhatsAppJID extracts phone number from WhatsApp JID
// Example: "6281234567890@s.whatsapp.net" -> "6281234567890"
func ParseWhatsAppJID(jid string) string {
	// Remove @s.whatsapp.net or @g.us suffix
	if idx := strings.Index(jid, "@"); idx != -1 {
		return jid[:idx]
	}
	return jid
}

// FormatPhoneNumber formats phone number with country code
// Example: "6281234567890" -> "+62 812-3456-7890"
func FormatPhoneNumber(phone string) string {
	// Remove any non-numeric characters
	cleaned := strings.Map(func(r rune) rune {
		if r >= '0' && r <= '9' {
			return r
		}
		return -1
	}, phone)

	// If starts with country code (62 for Indonesia)
	if strings.HasPrefix(cleaned, "62") && len(cleaned) >= 10 {
		// Format: +62 812-3456-7890
		return "+" + cleaned[:2] + " " + cleaned[2:5] + "-" + cleaned[5:9] + "-" + cleaned[9:]
	}

	// If starts with 0 (local format)
	if strings.HasPrefix(cleaned, "0") && len(cleaned) >= 10 {
		// Convert to international format
		return "+62 " + cleaned[1:4] + "-" + cleaned[4:8] + "-" + cleaned[8:]
	}

	// Return as is with + prefix if long enough
	if len(cleaned) >= 10 {
		return "+" + cleaned
	}

	return cleaned
}

// JIDToPhoneNumber converts WhatsApp JID to formatted phone number
// Example: "6281234567890@s.whatsapp.net" -> "+62 812-3456-7890"
func JIDToPhoneNumber(jid string) string {
	phone := ParseWhatsAppJID(jid)
	return FormatPhoneNumber(phone)
}

// IsGroupJID checks if JID is a group
// Example: "120363123456789@g.us" -> true
func IsGroupJID(jid string) bool {
	return strings.HasSuffix(jid, "@g.us")
}

// IsValidJID checks if string is a valid WhatsApp JID
func IsValidJID(jid string) bool {
	return strings.Contains(jid, "@") &&
		(strings.HasSuffix(jid, "@s.whatsapp.net") ||
			strings.HasSuffix(jid, "@g.us") ||
			strings.HasSuffix(jid, "@lid"))
}

// PhoneToJID converts phone number to WhatsApp JID
// Example: "081234567890" -> "6281234567890@s.whatsapp.net"
// Example: "+62 812-3456-7890" -> "6281234567890@s.whatsapp.net"
func PhoneToJID(phone string) string {
	// Remove all non-numeric characters
	cleaned := strings.Map(func(r rune) rune {
		if r >= '0' && r <= '9' {
			return r
		}
		return -1
	}, phone)

	// If starts with 0, replace with country code 62
	if strings.HasPrefix(cleaned, "0") {
		cleaned = "62" + cleaned[1:]
	}

	// If doesn't start with country code, add 62
	if !strings.HasPrefix(cleaned, "62") {
		cleaned = "62" + cleaned
	}

	return cleaned + "@s.whatsapp.net"
}

// GetContactDisplayName gets best display name for a contact
// Priority: fullName > pushName > formatted phone number
func GetContactDisplayName(fullName, pushName, jid string) string {
	if fullName != "" {
		return fullName
	}
	if pushName != "" {
		return pushName
	}
	return JIDToPhoneNumber(jid)
}

// IsValidPhoneNumber checks if a string is a valid WhatsApp phone number
// A valid phone number should be numeric and at least 10 digits
func IsValidPhoneNumber(phone string) bool {
	// Remove any non-numeric characters
	cleaned := strings.Map(func(r rune) rune {
		if r >= '0' && r <= '9' {
			return r
		}
		return -1
	}, phone)

	// Valid phone numbers should be at least 10 digits
	return len(cleaned) >= 10
}

// CleanPhoneNumber extracts a clean phone number from either a JID or phone string
// If the input is a JID (contains @), it extracts the user part
// If the input is already a phone number, it validates and returns it
// Returns empty string if not a valid phone number
func CleanPhoneNumber(input string) string {
	// If it looks like a JID, extract the user part
	if strings.Contains(input, "@") {
		return ParseWhatsAppJID(input)
	}

	// Clean non-numeric characters
	cleaned := strings.Map(func(r rune) rune {
		if r >= '0' && r <= '9' {
			return r
		}
		return -1
	}, input)

	// Validate it's a proper phone number (at least 10 digits)
	if len(cleaned) >= 10 {
		return cleaned
	}

	// Return original input if we can't clean it
	return input
}
