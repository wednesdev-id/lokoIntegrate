package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ProductType constants
const (
	ProductTypePhysical = "physical"
	ProductTypeDigital  = "digital"
	ProductTypeService  = "service"
)

// ProductStatus constants
const (
	ProductStatusActive   = "active"
	ProductStatusInactive = "inactive"
	ProductStatusArchived = "archived"
)

// Product model
type Product struct {
	ID          uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	Name        string         `gorm:"not null" json:"name"`
	Description string         `gorm:"type:text" json:"description"`
	ProductType string         `gorm:"not null;default:'physical'" json:"product_type"` // physical, digital, service
	SKU         string         `gorm:"uniqueIndex" json:"sku"`
	Price       float64        `gorm:"not null;default:0" json:"price"`
	CostPrice   float64        `gorm:"default:0" json:"cost_price"`
	Currency    string         `gorm:"default:'IDR'" json:"currency"`
	ImageURL    string         `json:"image_url"`
	Images      []string       `gorm:"serializer:json" json:"images"`
	Status      string         `gorm:"default:'active'" json:"status"`
	IsActive    bool           `gorm:"default:true" json:"is_active"`
	Stock       int            `gorm:"default:0" json:"stock"`
	MinStock    int            `gorm:"default:0" json:"min_stock"`
	Weight      float64        `gorm:"default:0" json:"weight"` // in grams or kg
	UserID      uuid.UUID      `gorm:"type:uuid;index" json:"user_id"` // Owner of the product
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`

	// Relationships
	DigitalAssets []ProductDigitalAsset `gorm:"foreignKey:ProductID" json:"digital_assets,omitempty"`
}

func (p *Product) BeforeCreate(tx *gorm.DB) (err error) {
	if p.ID == uuid.Nil {
		p.ID, err = uuid.NewV7()
	}
	return
}

func (Product) TableName() string {
	return "products"
}

// ProductDigitalAsset model for digital products
type ProductDigitalAsset struct {
	ID          uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	ProductID   uuid.UUID      `gorm:"type:uuid;not null;index" json:"product_id"`
	FileURL     string         `json:"file_url"`
	DownloadURL string         `json:"download_url"`
	LicenseKey  string         `json:"license_key"`
	AccessType  string         `json:"access_type"` // file, link, key
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

func (p *ProductDigitalAsset) BeforeCreate(tx *gorm.DB) (err error) {
	if p.ID == uuid.Nil {
		p.ID, err = uuid.NewV7()
	}
	return
}

func (ProductDigitalAsset) TableName() string {
	return "product_digital_assets"
}
