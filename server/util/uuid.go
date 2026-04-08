package util

import (
	"encoding/binary"
	"time"

	"github.com/google/uuid"
)

// GenerateUUIDv7 generates a UUIDv7 with timestamp prefix for better sortability
// Format: timestamp (48 bits) + version (4 bits) + random (12 bits) + variant (2 bits) + random (62 bits)
func GenerateUUIDv7() uuid.UUID {
	var u uuid.UUID

	// Get current timestamp in milliseconds
	now := time.Now()
	timestamp := uint64(now.UnixMilli())

	// Write timestamp (first 48 bits / 6 bytes)
	binary.BigEndian.PutUint64(u[0:8], timestamp<<16)

	// Generate random data for the rest
	randomUUID := uuid.New()
	copy(u[6:], randomUUID[6:])

	// Set version to 7 (bits 48-51)
	u[6] = (u[6] & 0x0F) | 0x70 // Version 7

	// Set variant to RFC4122 (bits 64-65)
	u[8] = (u[8] & 0x3F) | 0x80 // Variant 10

	return u
}
