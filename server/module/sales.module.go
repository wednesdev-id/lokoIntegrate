package module

import (
	"context"
	"io"
	"loko/server/middleware"
	"loko/server/model"
	"loko/server/storage"
	"loko/server/variable"
	"os"
	"path/filepath"
	"time"
	"fmt"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type Sales struct{}

func (ref Sales) Route(api fiber.Router) {
	handler := SalesHandler{}

	// Protect with Auth
	sales := api.Group("/sales", middleware.UseAuth)

	// Revenue Dashboard
	api.Get("/sales/revenue", middleware.UseAuth, handler.GetRevenue)

	// Payments
	pay := sales.Group("/payments")
	pay.Get("/", handler.ListPayments)
	pay.Get("/:id", handler.GetPayment)
	pay.Post("/", middleware.RoleAccess([]string{variable.SuperAdmin}), handler.CreatePayment)
	pay.Put("/:id", middleware.RoleAccess([]string{variable.SuperAdmin}), handler.UpdatePayment)
	pay.Delete("/:id", middleware.RoleAccess([]string{variable.SuperAdmin}), handler.DeletePayment)

	// Payment Proofs
	proof := sales.Group("/proofs")
	proof.Get("/", handler.ListProofs)
	proof.Post("/", handler.CreateProof)
	proof.Put("/:id/verify", middleware.RoleAccess([]string{variable.SuperAdmin}), handler.VerifyProof)
}

type SalesHandler struct{}

// --- Revenue Dashboard ---

func (h SalesHandler) GetRevenue(c *fiber.Ctx) error {
	db, err := dbConnect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Database connection failed"})
	}

	userID := c.Locals("user_id").(string)
	
	startDateStr := c.Query("start_date")
	endDateStr := c.Query("end_date")
	groupBy := c.Query("group_by", "daily") // daily, weekly, monthly
	
	now := time.Now()
	var startDate, endDate time.Time
	
	if endDateStr != "" {
		endDate, _ = time.Parse("2006-01-02", endDateStr)
		endDate = time.Date(endDate.Year(), endDate.Month(), endDate.Day(), 23, 59, 59, 0, endDate.Location())
	} else {
		endDate = time.Date(now.Year(), now.Month(), now.Day(), 23, 59, 59, 0, now.Location())
	}
	
	if startDateStr != "" {
		startDate, _ = time.Parse("2006-01-02", startDateStr)
		startDate = time.Date(startDate.Year(), startDate.Month(), startDate.Day(), 0, 0, 0, 0, startDate.Location())
	} else {
		// Default to 'This month'
		startDate = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	}

	var totalOrders int64
	var totalRevenue float64
	
	db.Model(&model.Order{}).
		Where("user_id = ? AND payment_status IN ? AND created_at >= ? AND created_at <= ?", userID, []string{"paid", "completed"}, startDate, endDate).
		Count(&totalOrders)
		
	db.Model(&model.Order{}).
		Where("user_id = ? AND payment_status IN ? AND created_at >= ? AND created_at <= ?", userID, []string{"paid", "completed"}, startDate, endDate).
		Select("COALESCE(SUM(total_amount), 0)").
		Row().Scan(&totalRevenue)

	var totalProfit float64
	db.Table("order_items").
		Joins("JOIN orders ON orders.id = order_items.order_id").
		Where("orders.user_id = ? AND orders.payment_status IN ? AND orders.created_at >= ? AND orders.created_at <= ?", userID, []string{"paid", "completed"}, startDate, endDate).
		Select("COALESCE(SUM((order_items.price - order_items.cost_price) * order_items.quantity), 0)").
		Row().Scan(&totalProfit)

	type BestSeller struct {
		ProductID   string  `json:"product_id"`
		ProductName string  `json:"product_name"`
		TotalSold   int     `json:"total_sold"`
		Revenue     float64 `json:"revenue"`
	}
	var bestSellers []BestSeller
	db.Table("order_items").
		Select("order_items.product_id, order_items.product_name, SUM(order_items.quantity) as total_sold, SUM(order_items.subtotal) as revenue").
		Joins("JOIN orders ON orders.id = order_items.order_id").
		Where("orders.user_id = ? AND orders.payment_status IN ? AND orders.created_at >= ? AND orders.created_at <= ?", userID, []string{"paid", "completed"}, startDate, endDate).
		Group("order_items.product_id, order_items.product_name").
		Order("total_sold DESC").
		Limit(5).
		Scan(&bestSellers)

	var lowStockProducts []model.Product
	db.Where("user_id = ? AND stock <= min_stock", userID).
		Order("stock ASC").
		Limit(10).
		Find(&lowStockProducts)

	var recentOrders []model.Order
	db.Where("user_id = ? AND payment_status IN ? AND created_at >= ? AND created_at <= ?", userID, []string{"paid", "completed"}, startDate, endDate).
		Find(&recentOrders)

	// Aggregate in Go based on grouping
	chartDataMap := make(map[string]float64)
	var keys []string
	
	importFmt := false
	if groupBy == "weekly" {
		importFmt = true
	}
	// We handle formatting here to avoid fmt import issues if we don't need it.
	_ = importFmt
	
	curr := startDate
	var lastKey string
	for curr.Before(endDate) || curr.Format("2006-01-02") == endDate.Format("2006-01-02") {
		var key string
		if groupBy == "monthly" {
			key = curr.Format("2006-01")
		} else if groupBy == "weekly" {
			year, week := curr.ISOWeek()
			key = fmt.Sprintf("%d-W%02d", year, week)
		} else {
			key = curr.Format("2006-01-02")
		}
		
		if key != lastKey {
			keys = append(keys, key)
			chartDataMap[key] = 0 // Initialize to 0
			lastKey = key
		}
		curr = curr.AddDate(0, 0, 1) // Advance by 1 day
	}

	for _, o := range recentOrders {
		var key string
		if groupBy == "monthly" {
			key = o.CreatedAt.Format("2006-01")
		} else if groupBy == "weekly" {
			year, week := o.CreatedAt.ISOWeek()
			key = fmt.Sprintf("%d-W%02d", year, week)
		} else {
			key = o.CreatedAt.Format("2006-01-02")
		}
		if _, exists := chartDataMap[key]; exists {
			chartDataMap[key] += o.TotalAmount
		}
	}

	type ChartData struct {
		Date    string  `json:"date"`
		Revenue float64 `json:"revenue"`
	}
	var chartData []ChartData
	for _, key := range keys {
		chartData = append(chartData, ChartData{
			Date:    key,
			Revenue: chartDataMap[key],
		})
	}

	return c.JSON(fiber.Map{
		"data": fiber.Map{
			"total_orders":       totalOrders,
			"total_revenue":      totalRevenue,
			"total_profit":       totalProfit,
			"best_sellers":       bestSellers,
			"low_stock_products": lowStockProducts,
			"chart_data":         chartData,
		},
	})
}

// --- Payment Methods ---

func (h SalesHandler) ListPayments(c *fiber.Ctx) error {
	db, err := dbConnect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Database connection failed"})
	}

	var payments []model.PaymentMethod
	if err := db.Order("created_at DESC").Find(&payments).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to retrieve payments"})
	}

	return c.JSON(fiber.Map{"data": payments})
}

func (h SalesHandler) GetPayment(c *fiber.Ctx) error {
	id := c.Params("id")
	db, err := dbConnect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Database connection failed"})
	}

	var payment model.PaymentMethod
	if err := db.Where("id = ?", id).First(&payment).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"message": "Payment method not found"})
	}

	return c.JSON(fiber.Map{"data": payment})
}

func (h SalesHandler) CreatePayment(c *fiber.Ctx) error {
	var payment model.PaymentMethod
	if err := c.BodyParser(&payment); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Invalid request body"})
	}

	db, err := dbConnect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Database connection failed"})
	}

	// Get User ID from context
	userID := c.Locals("user_id").(string)
	payment.UserID = uuid.MustParse(userID)

	if err := db.Create(&payment).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to create payment method"})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"message": "Payment method created successfully", "data": payment})
}

func (h SalesHandler) UpdatePayment(c *fiber.Ctx) error {
	id := c.Params("id")
	var body model.PaymentMethod
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Invalid request body"})
	}

	db, err := dbConnect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Database connection failed"})
	}

	var payment model.PaymentMethod
	if err := db.Where("id = ?", id).First(&payment).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"message": "Payment method not found"})
	}

	// Update fields
	payment.PaymentName = body.PaymentName
	payment.PaymentType = body.PaymentType
	payment.Provider = body.Provider
	payment.AccountName = body.AccountName
	payment.AccountNumber = body.AccountNumber
	payment.PaymentImageURL = body.PaymentImageURL
	payment.Instructions = body.Instructions
	payment.Status = body.Status
	payment.UpdatedAt = time.Now()

	if err := db.Save(&payment).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to update payment method"})
	}

	return c.JSON(fiber.Map{"message": "Payment method updated successfully", "data": payment})
}

func (h SalesHandler) DeletePayment(c *fiber.Ctx) error {
	id := c.Params("id")
	db, err := dbConnect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Database connection failed"})
	}

	if err := db.Where("id = ?", id).Delete(&model.PaymentMethod{}).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to delete payment method"})
	}

	return c.JSON(fiber.Map{"message": "Payment method deleted successfully"})
}

// --- Payment Proofs ---

func (h SalesHandler) ListProofs(c *fiber.Ctx) error {
	db, err := dbConnect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Database connection failed"})
	}

	userID := c.Locals("user_id").(string)

	var proofs []model.PaymentProof
	if err := db.Joins("JOIN orders ON orders.id = payment_proofs.order_id").
		Where("orders.user_id = ?", userID).
		Order("payment_proofs.created_at DESC").
		Find(&proofs).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to retrieve payment proofs"})
	}

	return c.JSON(fiber.Map{"data": proofs})
}

func (h SalesHandler) VerifyProof(c *fiber.Ctx) error {
	id := c.Params("id")
	type VerifyBody struct {
		Status string `json:"status"` // verified, rejected
		Notes  string `json:"notes"`
	}
	var body VerifyBody
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Invalid request body"})
	}

	db, err := dbConnect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Database connection failed"})
	}

	var proof model.PaymentProof
	if err := db.Where("id = ?", id).First(&proof).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"message": "Payment proof not found"})
	}

	// Update verification status
	proof.VerificationStatus = body.Status
	if body.Notes != "" {
		proof.Notes = body.Notes
	}
	
	userID := c.Locals("user_id").(string)
	adminID := uuid.MustParse(userID)
	proof.VerifiedBy = &adminID
	now := time.Now()
	proof.VerifiedAt = &now
	proof.UpdatedAt = now

	if err := db.Save(&proof).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to verify payment proof"})
	}

	// TODO: Update Order status if verified
	if body.Status == "verified" {
		var order model.Order
		if err := db.Where("id = ?", proof.OrderID).First(&order).Error; err == nil {
			order.PaymentStatus = "paid"
			order.OrderStatus = "paid" // Or processing
			order.UpdatedAt = time.Now()
			db.Save(&order)
			
			// TODO: Reduce inventory
		}
	}

	return c.JSON(fiber.Map{"message": "Payment proof verified successfully", "data": proof})
}

func (h SalesHandler) CreateProof(c *fiber.Ctx) error {
	orderIDStr := c.FormValue("order_id")
	if orderIDStr == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "order_id is required"})
	}
	orderID, err := uuid.Parse(orderIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Invalid order_id"})
	}

	notes := c.FormValue("notes")

	file, err := c.FormFile("file")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "File is required"})
	}

	db, err := dbConnect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Database connection failed"})
	}

	userID := c.Locals("user_id").(string)

	var order model.Order
	if err := db.Where("id = ? AND user_id = ?", orderID, userID).First(&order).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"message": "Order not found"})
	}

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
	filename := fmt.Sprintf("proof_%d_%s%s", time.Now().UnixNano(), uuid.New().String()[:8], ext)

	var fileURL string
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
		
		savePath := filepath.Join(saveDir, filename)
		if err := c.SaveFile(file, savePath); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to save file locally"})
		}
		fileURL = "/uploads/proofs/" + filename
	}

	proof := model.PaymentProof{
		OrderID:            orderID,
		PhoneNumber:        order.PhoneNumber,
		MediaURL:           fileURL,
		Notes:              notes,
		VerificationStatus: "pending",
	}

	if err := db.Create(&proof).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to create payment proof"})
	}

	order.OrderStatus = "waiting_verification"
	order.UpdatedAt = time.Now()
	db.Save(&order)

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"message": "Payment proof uploaded successfully", "data": proof})
}
