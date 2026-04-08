package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// OrderStatus constants
const (
	OrderStatusPending     = "pending_payment"
	OrderStatusWaitingVerif = "waiting_verification"
	OrderStatusPaid        = "paid"
	OrderStatusProcessing  = "processing"
	OrderStatusCompleted   = "completed"
	OrderStatusCancelled   = "cancelled"
)

// Order model
type Order struct {
	ID                 uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	OrderCode          string         `gorm:"uniqueIndex;not null" json:"order_code"`
	UserID             uuid.UUID      `gorm:"type:uuid;index" json:"user_id"` // Merchant/Admin ID
	PhoneNumber        string         `gorm:"index;not null" json:"phone_number"` // Customer phone
	CustomerName       string         `json:"customer_name"`
	CustomerNote       string         `gorm:"type:text" json:"customer_note"`
	Subtotal           float64        `gorm:"not null;default:0" json:"subtotal"`
	DiscountAmount     float64        `gorm:"default:0" json:"discount_amount"`
	TaxAmount          float64        `gorm:"default:0" json:"tax_amount"`
	TotalAmount        float64        `gorm:"not null;default:0" json:"total_amount"`
	PaymentStatus      string         `gorm:"default:'unpaid'" json:"payment_status"`
	OrderStatus        string         `gorm:"default:'pending_payment'" json:"order_status"`
	ShippingName       string         `json:"shipping_name"`
	ShippingPhone      string         `json:"shipping_phone"`
	ShippingAddress    string         `gorm:"type:text" json:"shipping_address"`
	ShippingCity       string         `json:"shipping_city"`
	ShippingProvince   string         `json:"shipping_province"`
	ShippingPostalCode string         `json:"shipping_postal_code"`
	CreatedAt          time.Time      `json:"created_at"`
	UpdatedAt          time.Time      `json:"updated_at"`
	DeletedAt          gorm.DeletedAt `gorm:"index" json:"-"`

	// Relationships
	Items         []OrderItem    `gorm:"foreignKey:OrderID" json:"items,omitempty"`
	PaymentProofs []PaymentProof `gorm:"foreignKey:OrderID" json:"payment_proofs,omitempty"`
}

func (o *Order) BeforeCreate(tx *gorm.DB) (err error) {
	if o.ID == uuid.Nil {
		o.ID, err = uuid.NewV7()
	}
	return
}

func (Order) TableName() string {
	return "orders"
}

// OrderItem model
type OrderItem struct {
	ID          uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	OrderID     uuid.UUID      `gorm:"type:uuid;not null;index" json:"order_id"`
	ProductID   uuid.UUID      `gorm:"type:uuid;not null;index" json:"product_id"`
	ProductName string         `json:"product_name"`
	ProductType string         `json:"product_type"`
	SKU         string         `json:"sku"`
	Price       float64        `gorm:"not null" json:"price"`
	CostPrice   float64        `gorm:"default:0" json:"cost_price"`
	Quantity    int            `gorm:"not null" json:"quantity"`
	Subtotal    float64        `gorm:"not null" json:"subtotal"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

func (oi *OrderItem) BeforeCreate(tx *gorm.DB) (err error) {
	if oi.ID == uuid.Nil {
		oi.ID, err = uuid.NewV7()
	}
	return
}

func (OrderItem) TableName() string {
	return "order_items"
}
