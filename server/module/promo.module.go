package module

import (
	"context"
	"fmt"
	"io"
	"loko/server/middleware"
	"loko/server/model"
	"loko/server/storage"
	"loko/server/variable"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type Promo struct{}

func (ref Promo) Route(api fiber.Router) {
	handler := PromoHandler{}

	sub := api.Group("/promos", middleware.UseAuth, middleware.RoleAccess([]string{variable.SuperAdmin}))
	sub.Get("/", handler.ListPromos)
	sub.Post("/", handler.CreatePromo)
	sub.Delete("/:id", handler.DeletePromo)

	aff := api.Group("/affiliates", middleware.UseAuth, middleware.RoleAccess([]string{variable.SuperAdmin}))
	aff.Get("/", handler.ListAffiliates)
	aff.Post("/", handler.CreateAffiliate)
	aff.Delete("/:id", handler.DeleteAffiliate)

	// Admin Revenue Extensions
	api.Get("/subscription-transactions", middleware.UseAuth, middleware.RoleAccess([]string{variable.SuperAdmin}), handler.ListTransactions)
	api.Post("/subscription-transactions", middleware.UseAuth, middleware.RoleAccess([]string{variable.SuperAdmin}), handler.CreateTransaction)
}

type PromoHandler struct{}

// --- Promos ---

func (handler PromoHandler) ListPromos(c *fiber.Ctx) error {
	db, err := dbConnect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Database connection failed"})
	}

	var promos []model.PromoCode
	if err := db.Order("created_at DESC").Find(&promos).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to retrieve promos"})
	}

	return c.JSON(fiber.Map{"data": promos})
}

func (handler PromoHandler) CreatePromo(c *fiber.Ctx) error {
	var promo model.PromoCode
	if err := c.BodyParser(&promo); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Invalid request body"})
	}

	if promo.Code == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Code is required"})
	}

	db, err := dbConnect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Database connection failed"})
	}

	if err := db.Create(&promo).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to create promo"})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"message": "Promo created", "data": promo})
}

func (handler PromoHandler) DeletePromo(c *fiber.Ctx) error {
	id := c.Params("id")
	db, err := dbConnect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Database connection failed"})
	}

	if err := db.Where("id = ?", id).Delete(&model.PromoCode{}).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to delete promo"})
	}

	return c.JSON(fiber.Map{"message": "Promo deleted"})
}

// --- Affiliates ---

func (handler PromoHandler) ListAffiliates(c *fiber.Ctx) error {
	db, err := dbConnect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Database connection failed"})
	}

	var affiliates []model.AffiliateCode
	if err := db.Preload("User").Order("created_at DESC").Find(&affiliates).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to retrieve affiliates"})
	}

	return c.JSON(fiber.Map{"data": affiliates})
}

func (handler PromoHandler) CreateAffiliate(c *fiber.Ctx) error {
	type CreateAffiliateBody struct {
		UserID         string  `json:"user_id"`
		Code           string  `json:"code"`
		CommissionRate float64 `json:"commission_rate"`
	}
	var body CreateAffiliateBody
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Invalid request body"})
	}

	uid, err := uuid.Parse(body.UserID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Invalid UserID"})
	}

	aff := model.AffiliateCode{
		UserID:         uid,
		Code:           body.Code,
		CommissionRate: body.CommissionRate,
		IsActive:       true,
	}

	db, err := dbConnect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Database connection failed"})
	}

	if err := db.Create(&aff).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to create affiliate"})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"message": "Affiliate created", "data": aff})
}

func (handler PromoHandler) DeleteAffiliate(c *fiber.Ctx) error {
	id := c.Params("id")
	db, err := dbConnect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Database connection failed"})
	}

	if err := db.Where("id = ?", id).Delete(&model.AffiliateCode{}).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to delete affiliate"})
	}

	return c.JSON(fiber.Map{"message": "Affiliate deleted"})
}

// --- Transactions ---

func (handler PromoHandler) ListTransactions(c *fiber.Ctx) error {
	db, err := dbConnect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Database connection failed"})
	}

	var txs []model.SubscriptionTransaction
	if err := db.Preload("User").Preload("SubscriptionPackage").Order("created_at DESC").Find(&txs).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to retrieve transactions"})
	}

	return c.JSON(fiber.Map{"data": txs})
}

func (handler PromoHandler) CreateTransaction(c *fiber.Ctx) error {
	userIDStr := c.FormValue("user_id")
	packageIDStr := c.FormValue("package_id")
	actualPaidStr := c.FormValue("actual_paid")
	notes := c.FormValue("notes")

	if userIDStr == "" || packageIDStr == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "user_id and package_id are required"})
	}

	uid, err := uuid.Parse(userIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Invalid user_id"})
	}

	pkgID, err := uuid.Parse(packageIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Invalid package_id"})
	}

	db, err := dbConnect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Database connection failed"})
	}

	var user model.User
	if err := db.Where("id = ?", uid).First(&user).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"message": "User not found"})
	}

	var pkg model.SubscriptionPackage
	if err := db.Where("id = ?", pkgID).First(&pkg).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"message": "Subscription package not found"})
	}

	// File Upload Processing
	file, err := c.FormFile("file")
	var fileURL string
	if err == nil { // File is optional for Super Admin
		fileContent, err := file.Open()
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to read file"})
		}
		defer fileContent.Close()

		fileBytes, err := io.ReadAll(fileContent)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to read file bytes"})
		}

		ext := filepath.Ext(file.Filename)
		filename := fmt.Sprintf("sub_proof_%d_%s%s", time.Now().UnixNano(), uuid.New().String()[:8], ext)

		s3Client := storage.GetS3Client()
		if os.Getenv("SAVE_MEDIA_LOCAL") == "false" && s3Client != nil && s3Client.IsAvailable() {
			mimeType := file.Header.Get("Content-Type")
			if mimeType == "" {
				mimeType = "application/octet-stream"
			}
			s3URL, err := s3Client.Upload(context.Background(), "proofs/"+filename, fileBytes, mimeType)
			if err != nil {
				return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to upload to S3", "error": err.Error()})
			}
			fileURL = s3URL
		} else {
			saveDir := "./uploads/proofs"
			if err := os.MkdirAll(saveDir, 0755); err != nil {
				return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to create upload directory"})
			}
			localPath := filepath.Join(saveDir, filename)
			if err := os.WriteFile(localPath, fileBytes, 0644); err != nil {
				return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to save file locally"})
			}
			fileURL = "/uploads/proofs/" + filename
		}
	}

	actualPaid := pkg.Price
	if actualPaidStr != "" {
		if parsed, err := strconv.ParseFloat(actualPaidStr, 64); err == nil {
			actualPaid = parsed
		}
	}

	// Activate Subscription
	tx := db.Begin()
	now := time.Now()
	expiresAt := now.Add(time.Duration(pkg.DurationDays) * 24 * time.Hour)

	user.SubscriptionPackageID = &pkg.ID
	user.SubscriptionExpiredAt = &expiresAt
	user.BroadcastQuota = pkg.BroadcastLimit
	user.AIQuota = pkg.AILimit

	if err := tx.Save(&user).Error; err != nil {
		tx.Rollback()
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to update user subscription"})
	}

	transaction := model.SubscriptionTransaction{
		UserID:        uid,
	    PackageID:     pkg.ID,
		OriginalPrice: pkg.Price,
		DiscountAmount: 0,
		ActualPaid:    actualPaid,
		MediaURL:      fileURL,
		Notes:         notes,
		CreatedAt:     now,
	}

	if err := tx.Create(&transaction).Error; err != nil {
		tx.Rollback()
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to create subscription transaction"})
	}

	tx.Commit()

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message": "Subscription transaction recorded and activated successfully",
		"data":    transaction,
	})
}
