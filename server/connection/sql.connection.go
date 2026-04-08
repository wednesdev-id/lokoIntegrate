package connection

import (
	"fmt"
	"log"
	"loko/server/env"
	"loko/server/initialize"
	"loko/server/structure"

	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/driver/sqlserver"
	"gorm.io/gorm"
)

type SQL struct{}

var opts = &gorm.Config{
	// options...
}

var isConnected = false

func (ref SQL) Connect() (*gorm.DB, error) {
	dsn := structure.GormDSN{
		Host: env.GetDbHost(),
		Port: env.GetDbPort(),
		User: env.GetDbUser(),
		Pass: env.GetDbPass(),
		Name: env.GetDbName(),
	}
	db_type := env.GetDbType()
	var db *gorm.DB
	var err error
	if db_type == "mysql" {
		db, err = ref.MySQL(dsn)
	} else if db_type == "postgres" {
		db, err = ref.PostgreSQL(dsn)
	} else if db_type == "mssql" {
		db, err = ref.MSSQL(dsn)
	} else {
		db, err = ref.MySQL(dsn)
	}
	if err != nil {
		log.Fatalf("❌ Database error: %s", err)
	}
	if !isConnected {
		log.Println("✅ Database Connected")
		isConnected = true
	}

	// Always run migration if enabled
	if env.GetDbMigration() {
		if migrationErr := db.AutoMigrate(initialize.AutoMigrationTables()...); migrationErr != nil {
			panic("failed to auto migrate database: " + migrationErr.Error())
		}

		// Add composite indexes for better query performance
		// Index for GetChats query (session_id, timestamp DESC, chat_j_id)
		db.Exec(`CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_session_timestamp_chat 
				 ON whatsapp_messages(session_id, timestamp DESC, chat_j_id) 
				 WHERE deleted_at IS NULL`)

		// Index for unread count aggregation
		db.Exec(`CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_unread 
				 ON whatsapp_messages(chat_j_id, is_from_me, is_read) 
				 WHERE deleted_at IS NULL`)

		// CRITICAL: Unique index on message_id for fast ON CONFLICT check
		// Without this, INSERT with ON CONFLICT is 282ms, with this: <5ms
		db.Exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_messages_message_id 
				 ON whatsapp_messages(message_id) 
				 WHERE deleted_at IS NULL`)

		log.Println("✅ Auto Migration")
	} else {
		log.Println("👌 Auto Migration Skipped")
	}
	return db, err
}

// ---------------------------------------------------------------------------------------------------------------

// SQLite functions removed - using MySQL instead

func (ref SQL) MySQL(dsn structure.GormDSN) (*gorm.DB, error) {
	dsn_str := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s", dsn.User, dsn.Pass, dsn.Host, dsn.Port, dsn.Name)
	db, err := gorm.Open(mysql.Open(dsn_str), opts)
	if err != nil {
		return nil, err
	}
	return db, nil
}

func (ref SQL) PostgreSQL(dsn structure.GormDSN) (*gorm.DB, error) {
	dsn_str := fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=disable", dsn.Host, dsn.Port, dsn.User, dsn.Pass, dsn.Name)
	db, err := gorm.Open(postgres.Open(dsn_str), opts)
	if err != nil {
		return nil, err
	}
	return db, nil
}

func (ref SQL) MSSQL(dsn structure.GormDSN) (*gorm.DB, error) {
	dsn_str := fmt.Sprintf("server=%s;user id=%s;password=%s;port=%d;database=%s;", dsn.Host, dsn.User, dsn.Pass, dsn.Port, dsn.Name)
	db, err := gorm.Open(sqlserver.Open(dsn_str), opts)
	if err != nil {
		return nil, err
	}
	return db, nil
}
