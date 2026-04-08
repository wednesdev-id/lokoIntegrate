package initialize

import (
	"loko/server/model"
)

// AutoMigrationTables returns GORM models for PostgreSQL auto-migration
func AutoMigrationTables() []interface{} {
	return []interface{}{
		// User & Auth
		&model.User{},
		&model.Role{},
		&model.Revoke{},
		&model.SubscriptionPackage{},
		&model.SubscriptionLicense{},
		&model.PromoCode{},
		&model.AffiliateCode{},
		&model.SubscriptionTransaction{},

		&model.Bot{},
		&model.BotTemplate{},
		&model.AutoReplyRule{},

		// WhatsApp Multi-Session Models
		&model.WhatsAppSessionModel{},
		&model.WhatsAppMessage{},
		&model.WhatsAppContact{},
		&model.WhatsAppGroup{},
		&model.GroupParticipant{},
		&model.WhatsAppChat{},
		&model.WhatsAppReceipt{},
		&model.WhatsAppPresence{},
		&model.WhatsAppStatus{},
		&model.WhatsAppDevice{},
		&model.BroadcastSchedule{},
		&model.BroadcastRecipientStatus{},

		// Commerce - Inventory & Sales
		&model.Product{},
		&model.ProductDigitalAsset{},
		&model.Order{},
		&model.OrderItem{},
		&model.PaymentMethod{},
		&model.PaymentProof{},
		&model.InventoryMovement{},
		&model.Cart{},
		&model.CartItem{},
		&model.CustomerSession{},

		// System Settings
		&model.SystemSetting{},
		&model.ApiKey{},
		&model.AiModel{},
		&model.CsNumber{},
	}
}

