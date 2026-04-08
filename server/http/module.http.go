package http

import (
	"loko/server/module"
	"loko/server/module/whatsapp"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

func Module(app *fiber.App, db *gorm.DB) {
	api := app.Group("/api")

	// --------------------------
	// --------------------------

	Example := module.Example{}
	Example.Route(api)

	// register modul: supaya route terdaftar
	Auth := module.Auth{}
	Auth.Route(api)

	Setting := module.Setting{}
	Setting.Route(api)

	ApiKey := module.ApiKey{}
	ApiKey.Route(api)

	AiModel := module.AiModel{}
	AiModel.Route(api)

	CsNumber := module.CsNumber{}
	CsNumber.Route(api)


	// User module added back for admin AI Quota management
	User := module.User{}
	User.Route(api)

	Subscription := module.Subscription{}
	Subscription.Route(api)

	Profile := module.Profile{}
	Profile.Route(api)

	// Public Subscription - no authentication required (for landing page)
	PublicSubscription := module.PublicSubscription{}
	PublicSubscription.Route(api)

	Promo := module.Promo{}
	Promo.Route(api)

	// Bot Module
	Bot := module.Bot{}
	Bot.Route(api)

	// Bot Template Module
	BotTemplate := module.BotTemplate{}
	BotTemplate.Route(api)

	// Auto-Reply Rule Module
	AutoReplyRule := module.AutoReplyRule{}
	AutoReplyRule.Route(api)

	// Commerce Modules
	Inventory := module.Inventory{}
	Inventory.Route(api)

	Sales := module.Sales{}
	Sales.Route(api)

	// WhatsApp Module with Contact Sync for CRM/Sales
	sqlDB, err := db.DB()
	if err != nil {
		panic("Failed to get SQL DB: " + err.Error())
	}
	whatsapp.InitWhatsAppModule(api, db, sqlDB)

	// User := module.User{}
	// User.Route(api)

	// --------------------------
	// --------------------------

}
