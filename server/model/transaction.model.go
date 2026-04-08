package model

import "go.mongodb.org/mongo-driver/bson/primitive"

// TransactionType represents the type of credit transaction
type TransactionType string

const (
	TransactionTypeVerification  TransactionType = "verification_bonus"
	TransactionTypeProjectCreate TransactionType = "project_creation"
	TransactionTypeDeposit       TransactionType = "deposit"
	// Add other transaction types as needed
)

// Transaction represents a credit transaction for a user
type Transaction struct {
	ID          primitive.ObjectID `json:"_id,omitempty" bson:"_id,omitempty"`
	UserID      primitive.ObjectID `json:"user_id" bson:"user_id"`
	Type        TransactionType    `json:"type" bson:"type"`
	Amount      float64            `json:"amount" bson:"amount"`   // Positive for credits, negative for debits
	Balance     float64            `json:"balance" bson:"balance"` // Balance after transaction
	Description string             `json:"description,omitempty" bson:"description,omitempty"`

	// Related entity (optional)
	ProjectID *primitive.ObjectID `json:"project_id,omitempty" bson:"project_id,omitempty"`

	// Timestamps
	CreatedAt primitive.DateTime `json:"created_at" bson:"created_at"`
}
