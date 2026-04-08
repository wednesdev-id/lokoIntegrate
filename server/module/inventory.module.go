package module

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	"loko/server/middleware"
	"loko/server/model"
	"loko/server/storage"
	"loko/server/variable"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type Inventory struct{}

func (ref Inventory) Route(api fiber.Router) {
	handler := InventoryHandler{}

	// Protect with Auth
	inv := api.Group("/inventory", middleware.UseAuth)

	// Products
	prod := inv.Group("/products")
	prod.Get("/", handler.ListProducts)
	prod.Get("/:id", handler.GetProduct)
	prod.Post("/", handler.CreateProduct)
	prod.Post("/upload", handler.UploadImage)
	prod.Put("/:id", handler.UpdateProduct)
	prod.Delete("/:id", handler.DeleteProduct)

	// Orders
	ord := inv.Group("/orders")
	ord.Get("/", handler.ListOrders)
	ord.Get("/:id", handler.GetOrder)
	ord.Put("/:id/status", middleware.RoleAccess([]string{variable.SuperAdmin}), handler.UpdateOrderStatus)
}

type InventoryHandler struct{}

// --- Products ---

func (h InventoryHandler) ListProducts(c *fiber.Ctx) error {
	db, err := dbConnect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Database connection failed"})
	}

	userID := c.Locals("user_id").(string)

	var products []model.Product
	if err := db.Where("user_id = ?", userID).Order("created_at DESC").Find(&products).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to retrieve products"})
	}

	return c.JSON(fiber.Map{"data": products})
}

func (h InventoryHandler) GetProduct(c *fiber.Ctx) error {
	id := c.Params("id")
	db, err := dbConnect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Database connection failed"})
	}

	userID := c.Locals("user_id").(string)

	var product model.Product
	if err := db.Preload("DigitalAssets").Where("id = ? AND user_id = ?", id, userID).First(&product).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"message": "Product not found"})
	}

	return c.JSON(fiber.Map{"data": product})
}

func (h InventoryHandler) CreateProduct(c *fiber.Ctx) error {
	var product model.Product
	if err := c.BodyParser(&product); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Invalid request body"})
	}

	db, err := dbConnect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Database connection failed"})
	}

	// Get User ID from context
	userID := c.Locals("user_id").(string)
	product.UserID = uuid.MustParse(userID) // Assuming ID is UUID

	// Auto-generate SKU if empty
	if product.SKU == "" {
		product.SKU = fmt.Sprintf("PRD-%d-%s", time.Now().Unix(), uuid.New().String()[:6])
	}

	if err := db.Create(&product).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to create product"})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"message": "Product created successfully", "data": product})
}

func (h InventoryHandler) UpdateProduct(c *fiber.Ctx) error {
	id := c.Params("id")
	var body model.Product
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Invalid request body"})
	}

	db, err := dbConnect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Database connection failed"})
	}

	userID := c.Locals("user_id").(string)

	var product model.Product
	if err := db.Where("id = ? AND user_id = ?", id, userID).First(&product).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"message": "Product not found"})
	}

	// Update fields
	product.Name = body.Name
	product.Description = body.Description
	product.Price = body.Price
	product.CostPrice = body.CostPrice
	product.Stock = body.Stock
	product.MinStock = body.MinStock
	product.Weight = body.Weight
	product.SKU = body.SKU
	product.ProductType = body.ProductType
	product.ImageURL = body.ImageURL
	product.Images = body.Images
	product.UpdatedAt = time.Now()

	if err := db.Save(&product).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to update product"})
	}

	return c.JSON(fiber.Map{"message": "Product updated successfully", "data": product})
}

func (h InventoryHandler) DeleteProduct(c *fiber.Ctx) error {
	id := c.Params("id")
	db, err := dbConnect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Database connection failed"})
	}

	userID := c.Locals("user_id").(string)

	if err := db.Where("id = ? AND user_id = ?", id, userID).Delete(&model.Product{}).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to delete product"})
	}

	return c.JSON(fiber.Map{"message": "Product deleted successfully"})
}

func (h InventoryHandler) UploadImage(c *fiber.Ctx) error {
	file, err := c.FormFile("file")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "File is required"})
	}

	// Read file contents
	fileContent, err := file.Open()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to read file"})
	}
	defer fileContent.Close()

	fileBytes, err := io.ReadAll(fileContent)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to read file bytes"})
	}

	// Generate safe filename
	ext := filepath.Ext(file.Filename)
	filename := fmt.Sprintf("%d_%s%s", time.Now().UnixNano(), uuid.New().String()[:8], ext)

	var fileURL string
	s3Client := storage.GetS3Client()

	if os.Getenv("SAVE_MEDIA_LOCAL") == "false" && s3Client != nil && s3Client.IsAvailable() {
		// Upload to S3
		mimeType := file.Header.Get("Content-Type")
		if mimeType == "" {
			mimeType = "application/octet-stream"
		}
		
		s3URL, err := s3Client.Upload(context.Background(), "products/"+filename, fileBytes, mimeType)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to upload to S3", "error": err.Error()})
		}
		fileURL = s3URL
	} else {
		// Save locally
		saveDir := "./uploads/products"
		if err := os.MkdirAll(saveDir, 0755); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to create upload directory"})
		}
		
		savePath := filepath.Join(saveDir, filename)
		if err := c.SaveFile(file, savePath); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to save file locally"})
		}
		
		// Map it to public URL assuming /uploads is served statically
		fileURL = "/uploads/products/" + filename
	}

	return c.JSON(fiber.Map{
		"message": "File uploaded successfully",
		"url":     strings.TrimSpace(fileURL),
	})
}

// --- Orders ---

func (h InventoryHandler) ListOrders(c *fiber.Ctx) error {
	db, err := dbConnect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Database connection failed"})
	}

	userID := c.Locals("user_id").(string)

	var orders []model.Order
	if err := db.Preload("Items").Where("user_id = ?", userID).Order("created_at DESC").Find(&orders).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to retrieve orders"})
	}

	return c.JSON(fiber.Map{"data": orders})
}

func (h InventoryHandler) GetOrder(c *fiber.Ctx) error {
	id := c.Params("id")
	db, err := dbConnect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Database connection failed"})
	}

	userID := c.Locals("user_id").(string)

	var order model.Order
	if err := db.Preload("Items").Preload("PaymentProofs").Where("id = ? AND user_id = ?", id, userID).First(&order).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"message": "Order not found"})
	}

	return c.JSON(fiber.Map{"data": order})
}

func (h InventoryHandler) UpdateOrderStatus(c *fiber.Ctx) error {
	id := c.Params("id")
	type StatusBody struct {
		Status string `json:"status"`
	}
	var body StatusBody
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Invalid request body"})
	}

	db, err := dbConnect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Database connection failed"})
	}

	userID := c.Locals("user_id").(string)

	var order model.Order
	if err := db.Where("id = ? AND user_id = ?", id, userID).First(&order).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"message": "Order not found"})
	}

	order.OrderStatus = body.Status
	order.UpdatedAt = time.Now()

	if err := db.Save(&order).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to update order status"})
	}

	return c.JSON(fiber.Map{"message": "Order status updated successfully", "data": order})
}
