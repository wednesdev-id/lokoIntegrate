package model

import (
	"context"
	"fmt"
	"log"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

type BillingSchedule struct {
	ID            primitive.ObjectID  `json:"id" bson:"_id,omitempty"`
	ProjectID     primitive.ObjectID  `json:"project_id" bson:"project_id"`
	UserID        primitive.ObjectID  `json:"user_id" bson:"user_id"`
	Amount        float64             `json:"amount" bson:"amount"` // Monthly fee
	ScheduledDate primitive.DateTime  `json:"scheduled_date" bson:"scheduled_date"`
	Status        string              `json:"status" bson:"status"` // "pending", "processed", "failed"
	LastProcessed *primitive.DateTime `json:"last_processed,omitempty" bson:"last_processed,omitempty"`
	FailureReason string              `json:"failure_reason,omitempty" bson:"failure_reason,omitempty"`
	RetryCount    int                 `json:"retry_count" bson:"retry_count"`
	CreatedAt     primitive.DateTime  `json:"created_at" bson:"created_at"`
	UpdatedAt     primitive.DateTime  `json:"updated_at" bson:"updated_at"`
}

// ScheduleMonthlyBilling creates a new billing schedule for a project
func ScheduleMonthlyBilling(ctx context.Context, collection *mongo.Collection, projectID, userID primitive.ObjectID, amount float64) error {
	// Calculate next billing date (30 days from now)
	nextBillingDate := time.Now().AddDate(0, 1, 0)

	billing := BillingSchedule{
		ID:            primitive.NewObjectID(),
		ProjectID:     projectID,
		UserID:        userID,
		Amount:        amount,
		ScheduledDate: primitive.NewDateTimeFromTime(nextBillingDate),
		Status:        "pending",
		RetryCount:    0,
		CreatedAt:     primitive.NewDateTimeFromTime(time.Now()),
		UpdatedAt:     primitive.NewDateTimeFromTime(time.Now()),
	}

	_, err := collection.InsertOne(ctx, billing)
	if err != nil {
		return fmt.Errorf("failed to schedule billing: %w", err)
	}

	log.Printf("Scheduled billing for project %s, user %s, amount: %.2f", projectID.Hex(), userID.Hex(), amount)
	return nil
}

// ProcessDueBillings processes all billing schedules that are due
func ProcessDueBillings(ctx context.Context, billingCollection, userCollection, projectCollection *mongo.Collection) error {
	var dueBillings []BillingSchedule

	// Find all pending billings that are due (scheduled_date <= now)
	filter := bson.M{
		"status": "pending",
		"scheduled_date": bson.M{
			"$lte": primitive.NewDateTimeFromTime(time.Now()),
		},
	}

	cursor, err := billingCollection.Find(ctx, filter)
	if err != nil {
		return fmt.Errorf("failed to fetch due billings: %w", err)
	}
	defer cursor.Close(ctx)

	if err = cursor.All(ctx, &dueBillings); err != nil {
		return fmt.Errorf("failed to decode due billings: %w", err)
	}

	log.Printf("Found %d due billings to process", len(dueBillings))

	for _, billing := range dueBillings {
		if err := processSingleBilling(ctx, billingCollection, userCollection, projectCollection, billing); err != nil {
			log.Printf("Failed to process billing %s: %v", billing.ID.Hex(), err)
			// Continue processing other billings even if one fails
		}
	}

	return nil
}

// processSingleBilling processes a single billing schedule
func processSingleBilling(ctx context.Context, billingCollection, userCollection, projectCollection *mongo.Collection, billing BillingSchedule) error {
	// MongoDB doesn't have transactions like GORM, but we can use sessions for multi-document transactions
	// For simplicity, we'll handle this without transactions for now

	// Get user details
	var user User
	err := userCollection.FindOne(ctx, bson.M{"_id": billing.UserID}).Decode(&user)
	if err != nil {
		return fmt.Errorf("failed to get user: %w", err)
	}

	// Check if user has sufficient credits
	if user.Credits < billing.Amount {
		// Handle insufficient credits
		result, err := handleInsufficientCredits(ctx, billingCollection, userCollection, projectCollection, billing, user)
		if err != nil {
			return err
		}

		// Update billing status based on result
		if result == "suspended" {
			billing.Status = "failed"
			billing.FailureReason = "Insufficient credits - project suspended"
		} else {
			billing.Status = "failed"
			billing.FailureReason = "Insufficient credits"
		}
		billing.RetryCount++
		now := primitive.NewDateTimeFromTime(time.Now())
		billing.LastProcessed = &now
		billing.UpdatedAt = primitive.NewDateTimeFromTime(time.Now()) // Assuming this was the intended line to update

		_, err = billingCollection.UpdateOne(ctx,
			bson.M{"_id": billing.ID},
			bson.M{"$set": billing})
		if err != nil {
			return fmt.Errorf("failed to update billing status: %w", err)
		}

		return nil
	}

	// Deduct credits from user
	user.Credits -= billing.Amount
	user.UpdatedAt = time.Now()
	_, err = userCollection.UpdateOne(ctx,
		bson.M{"_id": user.ID},
		bson.M{"$set": bson.M{
			"credits":    user.Credits,
			"updated_at": user.UpdatedAt,
		}})
	if err != nil {
		return fmt.Errorf("failed to deduct credits: %w", err)
	}

	// Update billing status to processed
	billing.Status = "processed"
	now := primitive.NewDateTimeFromTime(time.Now())
	billing.LastProcessed = &now
	billing.UpdatedAt = primitive.NewDateTimeFromTime(time.Now())
	_, err = billingCollection.UpdateOne(ctx,
		bson.M{"_id": billing.ID},
		bson.M{"$set": billing})
	if err != nil {
		return fmt.Errorf("failed to update billing status: %w", err)
	}

	// Schedule next billing (30 days from now)
	nextBilling := BillingSchedule{
		ID:            primitive.NewObjectID(),
		ProjectID:     billing.ProjectID,
		UserID:        billing.UserID,
		Amount:        billing.Amount,
		ScheduledDate: primitive.NewDateTimeFromTime(time.Now().AddDate(0, 1, 0)),
		Status:        "pending",
		RetryCount:    0,
		CreatedAt:     primitive.NewDateTimeFromTime(time.Now()),
		UpdatedAt:     primitive.NewDateTimeFromTime(time.Now()),
	}

	_, err = billingCollection.InsertOne(ctx, nextBilling)
	if err != nil {
		return fmt.Errorf("failed to schedule next billing: %w", err)
	}

	log.Printf("Successfully processed billing %s for user %s, deducted %.2f credits",
		billing.ID.Hex(), user.ID.String(), billing.Amount)

	return nil
}

// handleInsufficientCredits handles cases where user doesn't have enough credits
func handleInsufficientCredits(ctx context.Context, billingCollection, userCollection, projectCollection *mongo.Collection, billing BillingSchedule, user User) (string, error) {
	// Check if this is the first failure or if we should suspend
	if billing.RetryCount >= 2 { // After 3 attempts (0, 1, 2), suspend the project
		err := suspendProject(ctx, projectCollection, billing.ProjectID)
		if err != nil {
			return "", fmt.Errorf("failed to suspend project: %w", err)
		}
		return "suspended", nil
	}

	// Send notification about insufficient credits
	err := sendInsufficientCreditsNotification(ctx, user, billing)
	if err != nil {
		log.Printf("Failed to send insufficient credits notification: %v", err)
		// Don't fail the billing process if notification fails
	}

	return "retry", nil
}

// suspendProject suspends a project due to billing issues
func suspendProject(ctx context.Context, projectCollection *mongo.Collection, projectID primitive.ObjectID) error {
	// Update project status to suspended
	result, err := projectCollection.UpdateOne(ctx,
		bson.M{"_id": projectID},
		bson.M{"$set": bson.M{
			"status":     "suspended",
			"updated_at": primitive.NewDateTimeFromTime(time.Now()),
		}})
	if err != nil {
		return fmt.Errorf("failed to suspend project: %w", err)
	}

	if result.MatchedCount == 0 {
		return fmt.Errorf("project %s not found", projectID.Hex())
	}

	log.Printf("Project %s suspended due to billing issues", projectID.Hex())
	return nil
}

// sendInsufficientCreditsNotification sends a notification to the user about insufficient credits
func sendInsufficientCreditsNotification(ctx context.Context, user User, billing BillingSchedule) error {
	// This is a placeholder for notification logic
	// In a real implementation, you would integrate with an email service, push notification service, etc.

	email := "unknown"
	if user.Email != nil {
		email = *user.Email
	}

	log.Printf("Sending insufficient credits notification to user %s (email: %s) for billing amount %.2f",
		user.ID.String(), email, billing.Amount)

	// For now, we'll just log the notification
	// In a real implementation, you would:
	// 1. Send an email using an email service
	// 2. Create a notification record in a notifications collection
	// 3. Send push notifications, etc.

	return nil
}
