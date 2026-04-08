package util

import (
	"golang.org/x/crypto/bcrypt"
)

// HashPassword menghasilkan hash bcrypt dari password.
func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(bytes), err
}

// CheckPasswordHash membandingkan password string dengan hash bcrypt.
// Mengembalikan true jika cocok, false jika tidak.
func CheckPasswordHash(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}