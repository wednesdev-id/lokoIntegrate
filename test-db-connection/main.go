package main

import (
	"fmt"
	"log"
	"os"

	"github.com/joho/godotenv"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	// Load environment variables
	if err := godotenv.Load(".env.dev"); err != nil {
		log.Printf("Warning: .env.dev file not found: %v", err)
	}

	// Get database configuration
	dbType := os.Getenv("DB_TYPE")
	dbHost := os.Getenv("DB_HOST")
	dbPort := os.Getenv("DB_PORT")
	dbUser := os.Getenv("DB_USER")
	dbPass := os.Getenv("DB_PASS")
	dbName := os.Getenv("DB_NAME")

	fmt.Printf("Testing PostgreSQL connection...\n")
	fmt.Printf("DB_TYPE: %s\n", dbType)
	fmt.Printf("DB_HOST: %s\n", dbHost)
	fmt.Printf("DB_PORT: %s\n", dbPort)
	fmt.Printf("DB_USER: %s\n", dbUser)
	fmt.Printf("DB_NAME: %s\n", dbName)
	fmt.Printf("DB_PASS: %s\n", "***hidden***")

	// Build DSN
	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=disable TimeZone=Asia/Jakarta",
		dbHost, dbUser, dbPass, dbName, dbPort)

	// Test connection
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	// Get underlying sql.DB
	sqlDB, err := db.DB()
	if err != nil {
		log.Fatalf("Failed to get underlying sql.DB: %v", err)
	}

	// Test ping
	if err := sqlDB.Ping(); err != nil {
		log.Fatalf("Failed to ping database: %v", err)
	}

	fmt.Printf("✅ PostgreSQL connection successful!\n")

	// Test simple query
	var version string
	if err := db.Raw("SELECT version()").Scan(&version).Error; err != nil {
		log.Fatalf("Failed to execute test query: %v", err)
	}

	fmt.Printf("✅ PostgreSQL version: %s\n", version)

	// Close connection
	sqlDB.Close()
	fmt.Printf("✅ Connection closed successfully!\n")
}